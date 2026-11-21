import React, { useState, useMemo, useEffect } from "react";
import { getApiUrl } from "../hooks/apiUrl";
import { APP_VERSION } from "../version";
import {
  Action,
  Container,
  Product,
  ModalType,
  InventoryState,
  ControlSourceType,
  CustomList,
} from "../types";
import {
  EditIcon,
  PlusIcon,
  SearchIcon,
  PackageIcon,
  BinIcon,
} from "../components/icons";
import { DataImportView } from "./DataImportView";
import { PhotoManagerView } from "./PhotoManagerView";
import { MediaSelector } from "../components/MediaSelector";
import { SearchableProductSelect } from "../components/SearchableProductSelect";
import { PWAInstallButton } from "../components/PWAInstallButton";
import { UsersAndDevicesPanel } from "../components/UsersAndDevicesPanel";
import { VoiceDictionaryManager } from "../components/VoiceDictionaryManager";
import { ButcherSettingsPanel } from "../components/ButcherSettingsPanel";
import { SpeciesPrimalsManager } from "../components/SpeciesPrimalsManager";
import { PrimalSelect, BULK_PRIMAL_NO_CHANGE, BULK_PRIMAL_CLEAR } from "../components/PrimalSelect";
import { ManagementForms, ManageFreezers } from "../components/ManagementForms";
import { CatalogSearchFilterBar } from "../components/CatalogSearchFilterBar";
import {
  buildSpeciesPrimalIndex,
  resolveProductPrimal,
  UNASSIGNED_PRIMAL_ID,
} from "../utils/speciesPrimals";
import { getTagActionIcon } from "../utils/tagRestockRules";
import {
  getContainerIcon,
  CONTAINER_ICONS,
} from "../components/ContainerIconsMap";
import {
  Palette,
  ClipboardList,
  Trash2,
  Edit2,
  AlertCircle,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  MapPin,
  Phone,
  User,
  Truck,
  Home,
  Warehouse,
  Check,
  X,
  Edit3,
  Sparkles,
  Bell,
  Mail,
  Settings,
  Send,
  Save,
  RefreshCw,
  Scale,
  History,
  Table,
  Sliders,
  ExternalLink,
  Copy,
  Smartphone,
  Globe,
  Download,
  Upload,
  RotateCcw,
  Snowflake,
  Beef,
  Fish,
  Package,
  Thermometer,
  QrCode,
  Layers,
  Shield,
  KeyRound,
  Menu,
  ArrowLeft,
  Tag as TagIcon,
  Images,
  Database,
  Users,
  Mic
} from "lucide-react";
import { isCloudflareTokenRefreshEnabled, setCloudflareTokenRefreshEnabled, CF_TOKEN_REFRESH_ENABLED_KEY } from "../utils/authSecurity";
import { authFetch } from "../utils/clientDevice";
import { useUserAuth } from "../hooks/useUserAuth";
import { OffSiteSettingsPanel } from "../components/OffSiteSettingsPanel";
import {
  LibraryTab,
  LibrarySectionMeta,
  getVisibleLibraryGroups,
  getLibrarySectionMeta,
  normalizeLibraryTab,
  isSectionAdminOnly,
} from "../utils/libraryNavigation";
import {
  NotificationCenterPanel,
  NotificationCenterSubTab,
} from "../components/NotificationCenterPanel";
import {
  WEEKDAY_LABELS,
  formatListNotificationSummary,
  getChannelTypeLabel,
  resolveEffectiveDailyDigestMode,
} from "../utils/notifications";

export type { LibraryTab };

export const FreezerAppLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="256,232 276.78,244 276.78,268 256,280 235.22,268 235.22,244" fill="#e0f2fe" stroke="#0284c7" strokeWidth="6"/>
    <g transform="translate(256, 256)">
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <line x1="0" y1="-24" x2="0" y2="-150" stroke="#38bdf8" strokeWidth="16" strokeLinecap="round"/>
          <line x1="0" y1="-80" x2="-45" y2="-120" stroke="#38bdf8" strokeWidth="14" strokeLinecap="round"/>
          <line x1="0" y1="-80" x2="45" y2="-120" stroke="#38bdf8" strokeWidth="14" strokeLinecap="round"/>
          <line x1="0" y1="-120" x2="-30" y2="-145" stroke="#38bdf8" strokeWidth="12" strokeLinecap="round"/>
          <line x1="0" y1="-120" x2="30" y2="-145" stroke="#38bdf8" strokeWidth="12" strokeLinecap="round"/>
          <circle cx="0" cy="-155" r="9" fill="#ffffff"/>
        </g>
      ))}
    </g>
  </svg>
);

const InlineEdit: React.FC<{
  value: string;
  onSave: (newValue: string) => void;
  textClass?: string;
}> = ({ value, onSave, textClass }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (text.trim() && text.trim() !== value) {
      onSave(text.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-2 flex-grow"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
          className="flex-grow px-2 py-1 bg-cool-gray-900 border border-cool-gray-650 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs text-white"
        />
      </div>
    );
  }

  return (
    <div
      className="flex justify-between items-center w-full group cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      <span className={textClass || "text-cool-gray-200"}>{value}</span>
      <button
        className="p-1 text-cool-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        title="Rename"
      >
        <EditIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const CategoryStyleEditor: React.FC<{
  name: string;
  type: "primary" | "sub";
  parentPrimary?: string;
  categories: any[] | undefined;
  onSave: (icon: string | undefined) => void;
  onClose: () => void;
}> = ({ name, type, parentPrimary, categories, onSave, onClose }) => {
  const current = categories?.find(
    (c) =>
      c.type === type &&
      c.name.toLowerCase().trim() === name.toLowerCase().trim() &&
      (type === "primary" ||
        c.parentPrimary?.toLowerCase().trim() ===
          parentPrimary?.toLowerCase().trim()),
  );

  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(
    current?.icon || undefined,
  );

  const AVAILABLE_EMOJIS = [
    // Farm Animals
    "🐂",
    "🐄",
    "🐖",
    "🐑",
    "🐐",
    "🐓",
    "🦃",
    "🦆",
    "🐇",
    "🐏",
    // Meat & Food
    "🥩",
    "🍗",
    "🍖",
    "🌭",
    "🍔",
    "🥓",
    "🐟",
    "🍤",
    "🦞",
    "🦀",
    // Fruits/Veg/Grocery
    "🥦",
    "🥬",
    "🥔",
    "🥕",
    "🌽",
    "🌶️",
    "🧅",
    "🧄",
    "🍅",
    "🍄",
    "🥚",
    "🧀",
    "🍞",
    "🥟",
    "🥫",
    // Storage/Utility
    "❄️",
    "📦",
    "🏷️",
    "🍽️",
    "🏺",
    "🔪",
  ];

  const handleSelectIcon = (emoji: string) => {
    setSelectedIcon(emoji);
    onSave(emoji);
  };

  const handleClearIcon = () => {
    setSelectedIcon(undefined);
    onSave("");
  };

  return (
    <div
      className="space-y-4 text-xs p-3.5 bg-cool-gray-900 border border-cool-gray-750 rounded-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-cool-gray-800 pb-2 mb-2 select-none">
        <div>
          <span className="font-extrabold text-cool-gray-300 capitalize text-xs">
            {type} category icon:{" "}
          </span>
          <span className="text-cyan-400 font-semibold text-xs capitalize">
            {name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-2.5 py-1 bg-cool-gray-800 hover:bg-cool-gray-750 transition rounded text-[11px] text-cool-gray-250 font-extrabold border border-cool-gray-700/60"
        >
          Done
        </button>
      </div>

      {/* Icon Picker */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] font-bold text-cool-gray-450 uppercase tracking-widest select-none">
          <span>Select Icon (Emoji)</span>
          {selectedIcon && (
            <button
              onClick={handleClearIcon}
              className="text-rose-450 hover:text-rose-400 transition font-black lowercase"
            >
              Clear Icon ×
            </button>
          )}
        </div>
        <div className="grid grid-cols-7 sm:grid-cols-10 gap-2 bg-cool-gray-950/40 p-2.5 rounded-lg border border-cool-gray-800 scrollbar-thin max-h-40 overflow-y-auto">
          {AVAILABLE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelectIcon(emoji)}
              className={`w-9 h-9 flex items-center justify-center text-lg rounded-lg transition-all cursor-pointer ${selectedIcon === emoji ? "bg-cyan-950/80 border border-cyan-400 font-bold scale-[1.08] shadow-md" : "hover:bg-cool-gray-800 hover:scale-105 active:scale-95"}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const CloudflareTokenHelperCard: React.FC<{
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}> = ({ enabled, onToggle }) => {
  return (
    <div className="bg-cool-gray-900/80 p-4 rounded-xl border border-cool-gray-800 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5 max-w-xl">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-cool-gray-200">Cloudflare Access Security Token Helper</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              enabled 
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                : 'bg-cool-gray-800 text-cool-gray-400 border-cool-gray-700'
            }`}>
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-[11px] text-cool-gray-400 leading-relaxed font-medium mt-1">
            Displays a 1-click token re-authentication button in the status menu and header badge when disconnected.
            Enable if your Home Assistant instance is protected by Cloudflare Zero Trust / Cloudflare Access.
            Disable if you connect directly via local LAN, WireGuard / Tailscale VPN, or Home Assistant Nabu Casa without Cloudflare.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-cool-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cool-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-cool-gray-800 text-[11px] text-cool-gray-450">
        <span>Test connection headers, run auth probes, or configure non-expiring machine Service Tokens.</span>
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('freezer-open-security-token-modal'));
          }}
          className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-200 border border-cool-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0"
          title="Open Security Token Diagnostics & Setup Modal"
        >
          <KeyRound className="w-3 h-3 text-amber-400" />
          <span>Open Security Token Setup</span>
        </button>
      </div>
    </div>
  );
};

const LibraryView: React.FC<{
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  openModal: (modal: ModalType) => void;
  navigateToFreezer: (containerId: string) => void;
  initialTab?: LibraryTab;
  onTabChange?: (tab: LibraryTab) => void;
  theme?: string;
  onThemeChange?: (newTheme: string) => void;
  onNavigateToView?: (view: any) => void;
  onRefreshState?: () => Promise<void> | void;
  isLoading?: boolean;
}> = ({
  state,
  dispatch,
  openModal,
  navigateToFreezer,
  initialTab,
  onTabChange,
  theme: parentTheme,
  onThemeChange,
  onNavigateToView,
  onRefreshState,
  isLoading = false,
}) => {
  const { authLoaded, usersConfigured, isAuthenticated, isAdmin, canAccessAdmin, requireLoginForEdits, openAccountModal } = useUserAuth();
  const isAdminGated = usersConfigured && !isAdmin;

  const [activeTab, setActiveTab] = useState<LibraryTab>(() => normalizeLibraryTab(initialTab));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Unified internal segmented mode states controlled from Section Header
  const [listsViewMode, setListsViewMode] = useState<'overview' | 'matrix'>('overview');
  const [photosSubTab, setPhotosSubTab] = useState<'library' | 'missing'>('library');
  const [importSubTab, setImportSubTab] = useState<'backup' | 'wipe'>('backup');
  const [notificationsSubTab, setNotificationsSubTab] = useState<NotificationCenterSubTab>('channels');
  const [listCreateTrigger, setListCreateTrigger] = useState(0);
  const [tagCreateTrigger, setTagCreateTrigger] = useState(0);
  const [locationCreateTrigger, setLocationCreateTrigger] = useState(0);
  const [channelCreateTrigger, setChannelCreateTrigger] = useState(0);
  const [activeListItemView, setActiveListItemView] = useState(false);
  const [activeTagDetailView, setActiveTagDetailView] = useState(false);

  useEffect(() => {
    const normalized = normalizeLibraryTab(initialTab);
    if (initialTab && normalized !== activeTab) {
      setActiveTab(normalized);
    }
  }, [initialTab]);

  const handleSwitchTab = (tab: LibraryTab) => {
    const normalized = normalizeLibraryTab(tab);
    setActiveTab(normalized);
    setMobileNavOpen(false);
    setShowAddForm(false);
    if (onTabChange) {
      onTabChange(normalized);
    }
  };
  const [productArchiveFilter, setProductArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [showProductFilters, setShowProductFilters] = useState(false);
  const [showTemplateFilters, setShowTemplateFilters] = useState(false);
  const [showContainerFilters, setShowContainerFilters] = useState(false);
  const [localTheme, setLocalThemeState] = useState<string>(
    () => localStorage.getItem("freezer-theme") || "dark",
  );

  const [defaultFromName, setDefaultFromName] = useState(() => localStorage.getItem("report-from-name") || "");
  const [defaultFromAddress, setDefaultFromAddress] = useState(() => localStorage.getItem("report-from-address") || "");
  const [theoreticalBoxWeight, setTheoreticalBoxWeight] = useState<number>(() => {
    const val = localStorage.getItem("offsite-theoretical-box-weight");
    return val ? parseFloat(val) : 40;
  });
  React.useEffect(() => {
    const handleSubTabEvent = (e: any) => {
      if (e?.detail === "voice_dictionary") {
        handleSwitchTab("voice_dictionary");
      } else if (e?.detail === "pwa" || e?.detail === "users_devices") {
        handleSwitchTab("users_devices");
      } else if (e?.detail === "offsite_settings") {
        handleSwitchTab("offsite_settings");
      } else if (e?.detail === "butcher_settings") {
        handleSwitchTab("butcher_settings");
      } else if (e?.detail === "general") {
        handleSwitchTab("settings");
      }
    };
    window.addEventListener("freezer-switch-settings-subtab", handleSubTabEvent);
    return () => window.removeEventListener("freezer-switch-settings-subtab", handleSubTabEvent);
  }, []);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [customPwaUrl, setCustomPwaUrl] = useState("");
  const [isEditingPwaUrl, setIsEditingPwaUrl] = useState(false);
  const [isSavingPwaUrl, setIsSavingPwaUrl] = useState(false);
  const [pwaUrlError, setPwaUrlError] = useState("");

  // PWA Branding: App Name, Mobile Short Name, & Icon states
  const [pwaAppName, setPwaAppName] = useState("Freezer Inventory Tracker");
  const [pwaShortName, setPwaShortName] = useState("FreezerApp");
  const [pwaIconType, setPwaIconType] = useState<"preset" | "custom">("preset");
  const [pwaPresetIcon, setPwaPresetIcon] = useState("snowflake");
  const [pwaIconColor, setPwaIconColor] = useState("#0f172a");
  const [pwaCustomImage, setPwaCustomImage] = useState<string | null>(null);
  const [isSavingPwaBranding, setIsSavingPwaBranding] = useState(false);
  const [pwaBrandingMessage, setPwaBrandingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cloudflare Access Security Token Refresh preference
  const [cfTokenRefreshEnabled, setCfTokenRefreshEnabled] = useState<boolean>(() => {
    return isCloudflareTokenRefreshEnabled(state.appConfig);
  });

  React.useEffect(() => {
    setCfTokenRefreshEnabled(isCloudflareTokenRefreshEnabled(state.appConfig));
  }, [state.appConfig]);

  const handleToggleCfTokenRefresh = (enabled: boolean) => {
    setCfTokenRefreshEnabled(enabled);
    setCloudflareTokenRefreshEnabled(enabled);
    saveAppConfigKey(CF_TOKEN_REFRESH_ENABLED_KEY, String(enabled));
  };

  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [serverVersionStatus, setServerVersionStatus] = useState<'checking' | 'connected' | 'mismatch' | 'offline'>('checking');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const checkAppVersion = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await authFetch(getApiUrl("api/version?_t=" + Date.now()), {
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.version) {
          setServerVersion(data.version);
          if (data.version === APP_VERSION) {
            setServerVersionStatus('connected');
          } else {
            setServerVersionStatus('mismatch');
          }
        } else {
          setServerVersionStatus('connected');
        }
      } else {
        setServerVersionStatus('offline');
      }
    } catch {
      setServerVersionStatus('offline');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === "settings") {
      checkAppVersion();
    }
  }, [activeTab]);

  const handleForceCheckAndUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateMessage("Checking for updates and querying server...");
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update().catch(() => {});
        }
      }
      const res = await authFetch(getApiUrl("api/version?_t=" + Date.now()), {
        headers: { 'Cache-Control': 'no-cache, no-store' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        setServerVersion(data.version);
        if (data.version !== APP_VERSION) {
          setServerVersionStatus('mismatch');
          setUpdateMessage(`New version v${data.version} detected on server! Reloading application...`);
          setTimeout(() => {
            window.location.reload();
          }, 800);
          return;
        } else {
          setServerVersionStatus('connected');
          setUpdateMessage(`Up to date! Running latest release v${APP_VERSION}.`);
        }
      } else {
        setServerVersionStatus('offline');
        setUpdateMessage("Server unreachable. Running offline with cached app shell.");
      }
    } catch {
      setServerVersionStatus('offline');
      setUpdateMessage("Offline mode: Client is running version v" + APP_VERSION);
    } finally {
      setIsCheckingUpdate(false);
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  const handlePurgeCacheAndReload = async () => {
    setIsCheckingUpdate(true);
    setUpdateMessage("Purging local caches, unregistering service workers, and reloading...");
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch (e) {
      console.warn("Error purging cache:", e);
    }
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  // Synchronize PWA branding states with state.appConfig updates
  React.useEffect(() => {
    const appConfigs = state.appConfig || [];
    const nameCfg = appConfigs.find(i => i.key === 'pwa_app_name');
    const shortCfg = appConfigs.find(i => i.key === 'pwa_short_name');
    const iconCfg = appConfigs.find(i => i.key === 'pwa_app_icon');
    const colorCfg = appConfigs.find(i => i.key === 'pwa_app_icon_color');
    const icon192Cfg = appConfigs.find(i => i.key === 'pwa_icon_192');

    if (nameCfg?.value) setPwaAppName(nameCfg.value);
    if (shortCfg?.value) setPwaShortName(shortCfg.value);
    if (colorCfg?.value) setPwaIconColor(colorCfg.value);
    if (iconCfg?.value) {
      if (iconCfg.value === 'custom' && icon192Cfg?.value) {
        setPwaIconType('custom');
        setPwaCustomImage(icon192Cfg.value);
      } else {
        setPwaIconType('preset');
        setPwaPresetIcon(iconCfg.value);
      }
    } else if (icon192Cfg?.value && !iconCfg) {
      setPwaIconType('custom');
      setPwaCustomImage(icon192Cfg.value);
    }
  }, [state.appConfig]);

  // Helper to render preset or custom icon onto canvas for crisp PWA PNG generation
  const generateIconDataUrl = async (
    type: 'preset' | 'custom',
    preset: string,
    bgColor: string,
    customImgSrc: string | null,
    size: number
  ): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas 2d context');

    // Draw background squircle
    const cornerRadius = size * 0.22;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(0, 0, size, size, cornerRadius);
    } else {
      ctx.rect(0, 0, size, size);
    }
    ctx.fill();

    if (type === 'custom' && customImgSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load custom icon image'));
        img.src = customImgSrc;
      });
      const padding = size * 0.14;
      const drawSize = size - padding * 2;
      ctx.drawImage(img, padding, padding, drawSize, drawSize);
    } else {
      const svgMap: Record<string, string> = {
        freezer_logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}" fill="none">
          <polygon points="256,232 276.78,244 276.78,268 256,280 235.22,268 235.22,244" fill="#e0f2fe" stroke="#0284c7" stroke-width="6"/>
          <g transform="translate(256, 256)">
            <g>
              <line x1="0" y1="-24" x2="0" y2="-150" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="-45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="-30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <circle cx="0" cy="-155" r="9" fill="#ffffff"/>
            </g>
            <g transform="rotate(60)">
              <line x1="0" y1="-24" x2="0" y2="-150" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="-45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="-30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <circle cx="0" cy="-155" r="9" fill="#ffffff"/>
            </g>
            <g transform="rotate(120)">
              <line x1="0" y1="-24" x2="0" y2="-150" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="-45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="-30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <circle cx="0" cy="-155" r="9" fill="#ffffff"/>
            </g>
            <g transform="rotate(180)">
              <line x1="0" y1="-24" x2="0" y2="-150" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="-45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="-30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <circle cx="0" cy="-155" r="9" fill="#ffffff"/>
            </g>
            <g transform="rotate(240)">
              <line x1="0" y1="-24" x2="0" y2="-150" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="-45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="-30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <circle cx="0" cy="-155" r="9" fill="#ffffff"/>
            </g>
            <g transform="rotate(300)">
              <line x1="0" y1="-24" x2="0" y2="-150" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="-45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-80" x2="45" y2="-120" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="-30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <line x1="0" y1="-120" x2="30" y2="-145" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
              <circle cx="0" cy="-155" r="9" fill="#ffffff"/>
            </g>
          </g>
        </svg>`,
        snowflake: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4"/><path d="m17 3-3 6 1.5 3"/><path d="M2 12h6.5L10 9"/><path d="m20 10-1.5 2 1.5 2"/><path d="M22 12h-6.5L14 15"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h4"/></svg>`,
        beef: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3"/><path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5"/><circle cx="12.5" cy="8.5" r="2.5"/></svg>`,
        package: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg>`,
        pallet: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`,
        truck: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
        warehouse: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11"/><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z"/><path d="M6 13h12"/><path d="M6 17h12"/></svg>`,
        fish: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/></svg>`,
        thermometer: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`,
        qrcode: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>`
      };
      const svgCode = svgMap[preset] || svgMap.freezer_logo || svgMap.snowflake;
      const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to render preset SVG'));
        img.src = url;
      });
      const padding = size * 0.18;
      const drawSize = size - padding * 2;
      ctx.drawImage(img, padding, padding, drawSize, drawSize);
      URL.revokeObjectURL(url);
    }

    return canvas.toDataURL('image/png');
  };

  const handleSavePwaBranding = async () => {
    setIsSavingPwaBranding(true);
    setPwaBrandingMessage(null);
    try {
      const finalPreset = pwaPresetIcon || 'freezer_logo';
      const icon192 = await generateIconDataUrl(pwaIconType, finalPreset, pwaIconColor, pwaCustomImage, 192);
      const icon512 = await generateIconDataUrl(pwaIconType, finalPreset, pwaIconColor, pwaCustomImage, 512);

      const cleanName = pwaAppName.trim() || 'Freezer Inventory Tracker';
      const cleanShort = pwaShortName.trim() || 'FreezerApp';

      const payload = {
        configs: {
          pwa_app_name: cleanName,
          pwa_short_name: cleanShort,
          pwa_app_icon: pwaIconType === 'custom' ? 'custom' : finalPreset,
          pwa_app_icon_color: pwaIconColor,
          pwa_icon_192: icon192,
          pwa_icon_512: icon512
        }
      };

      const res = await authFetch(getApiUrl('api/app-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.configs) {
          const newAppConfig = Object.entries(data.configs).map(([k, v]) => ({
            key: k,
            value: v as string,
            updatedAt: new Date().toISOString()
          }));
          dispatch({
            type: 'REPLACE_STATE',
            payload: {
              ...state,
              appConfig: newAppConfig
            }
          });
        }

        // Immediately update DOM title and meta tags
        if (typeof document !== 'undefined') {
          document.title = cleanName;
          const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
          if (appleMeta) appleMeta.setAttribute('content', cleanShort);
          const appNameMeta = document.querySelector('meta[name="application-name"]');
          if (appNameMeta) appNameMeta.setAttribute('content', cleanName);
          const themeMeta = document.querySelector('meta[name="theme-color"]');
          if (themeMeta) themeMeta.setAttribute('content', pwaIconColor);

          const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
          if (manifestLink) {
            manifestLink.href = `./manifest.json?v=${Date.now()}`;
          }
          const iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (iconLink) {
            iconLink.href = icon192;
          }
          const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
          if (appleIconLink) {
            appleIconLink.href = icon192;
          }
        }

        setPwaBrandingMessage({
          type: 'success',
          text: `App branding saved! Name "${cleanName}" & label "${cleanShort}" applied.`
        });
        setTimeout(() => setPwaBrandingMessage(null), 5000);
      } else {
        setPwaBrandingMessage({
          type: 'error',
          text: 'Failed to save branding configurations to server.'
        });
      }
    } catch (err: any) {
      setPwaBrandingMessage({
        type: 'error',
        text: err?.message || 'Error generating custom PWA icons.'
      });
    } finally {
      setIsSavingPwaBranding(false);
    }
  };

  const handleResetPwaBranding = async () => {
    setIsSavingPwaBranding(true);
    setPwaBrandingMessage(null);
    try {
      const payload = {
        configs: {
          pwa_app_name: 'Freezer Inventory Tracker',
          pwa_short_name: 'FreezerApp',
          pwa_app_icon: 'freezer_logo',
          pwa_app_icon_color: '#0f172a',
          pwa_icon_192: '',
          pwa_icon_512: ''
        }
      };

      const res = await authFetch(getApiUrl('api/app-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.configs) {
          const newAppConfig = Object.entries(data.configs).map(([k, v]) => ({
            key: k,
            value: v as string,
            updatedAt: new Date().toISOString()
          }));
          dispatch({
            type: 'REPLACE_STATE',
            payload: {
              ...state,
              appConfig: newAppConfig
            }
          });
        }
        setPwaAppName('Freezer Inventory Tracker');
        setPwaShortName('FreezerApp');
        setPwaIconType('preset');
        setPwaPresetIcon('freezer_logo');
        setPwaIconColor('#0f172a');
        setPwaCustomImage(null);

        if (typeof document !== 'undefined') {
          document.title = 'Freezer Inventory Tracker';
          const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
          if (appleMeta) appleMeta.setAttribute('content', 'FreezerApp');
          const appNameMeta = document.querySelector('meta[name="application-name"]');
          if (appNameMeta) appNameMeta.setAttribute('content', 'Freezer Inventory Tracker');
          const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
          if (manifestLink) manifestLink.href = `./manifest.json?v=${Date.now()}`;
          const iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (iconLink) iconLink.href = './icon.svg';
          const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
          if (appleIconLink) appleIconLink.href = './apple-touch-icon.png';
        }

        setPwaBrandingMessage({
          type: 'success',
          text: 'Reset to default app name and official icon.'
        });
        setTimeout(() => setPwaBrandingMessage(null), 4000);
      }
    } catch (err: any) {
      setPwaBrandingMessage({
        type: 'error',
        text: 'Error resetting branding.'
      });
    } finally {
      setIsSavingPwaBranding(false);
    }
  };

  // Synchronize local customPwaUrl with state.appConfig updates (e.g. from Server SSE)
  React.useEffect(() => {
    const customUrlConfig = (state.appConfig || []).find(item => item.key === 'pwa_custom_url');
    if (customUrlConfig && customUrlConfig.value && customUrlConfig.value.trim()) {
      setCustomPwaUrl(customUrlConfig.value.trim());
    } else {
      setCustomPwaUrl("");
    }
  }, [state.appConfig]);

  // Helper to persist preferences directly to database app_config table
  const saveAppConfigKey = (key: string, value: string) => {
    authFetch(getApiUrl('api/app-config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.configs) {
          const newAppConfig = Object.entries(data.configs).map(([k, v]) => ({
            key: k,
            value: v as string,
            updatedAt: new Date().toISOString()
          }));
          dispatch({
            type: 'REPLACE_STATE',
            payload: {
              ...state,
              appConfig: newAppConfig
            }
          });
        }
      })
      .catch(err => console.warn(`Could not save app_config key "${key}":`, err));
  };

  // Synchronize preferences from database app_config table on mount, migrating any local data seamlessly
  React.useEffect(() => {
    let isMounted = true;
    authFetch(getApiUrl('api/app-config'))
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!isMounted || !data || !data.configs) return;
        const configs = data.configs;
        const dbFromName = configs['report-from-name'];
        const dbFromAddress = configs['report-from-address'];
        const dbBoxWeight = configs['offsite-theoretical-box-weight'];

        let needsMigration = false;
        const toMigrate: Record<string, string> = {};

        if (dbFromName !== undefined) {
          setDefaultFromName(dbFromName);
          localStorage.setItem("report-from-name", dbFromName);
        } else {
          const localName = localStorage.getItem("report-from-name");
          if (localName) {
            toMigrate['report-from-name'] = localName;
            needsMigration = true;
          }
        }

        if (dbFromAddress !== undefined) {
          setDefaultFromAddress(dbFromAddress);
          localStorage.setItem("report-from-address", dbFromAddress);
        } else {
          const localAddr = localStorage.getItem("report-from-address");
          if (localAddr) {
            toMigrate['report-from-address'] = localAddr;
            needsMigration = true;
          }
        }

        if (dbBoxWeight !== undefined) {
          const parsed = parseFloat(dbBoxWeight);
          if (!isNaN(parsed) && parsed > 0) {
            setTheoreticalBoxWeight(parsed);
            localStorage.setItem("offsite-theoretical-box-weight", parsed.toString());
          }
        } else {
          const localWeight = localStorage.getItem("offsite-theoretical-box-weight");
          if (localWeight) {
            toMigrate['offsite-theoretical-box-weight'] = localWeight;
            needsMigration = true;
          }
        }

        const canWriteOffsiteConfig = canAccessAdmin || !usersConfigured || !requireLoginForEdits || isAuthenticated;
        if (needsMigration && authLoaded && canWriteOffsiteConfig) {
          authFetch(getApiUrl('api/app-config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configs: toMigrate })
          }).catch(err => console.warn('Could not auto-migrate localStorage to app_config:', err));
        }
      })
      .catch(err => console.warn('Could not load app_config on mount:', err));

    return () => { isMounted = false; };
  }, [authLoaded, canAccessAdmin, usersConfigured, requireLoginForEdits, isAuthenticated]);

  const [showDemoStartConfirm, setShowDemoStartConfirm] = useState(false);
  const [showDemoEndConfirm, setShowDemoEndConfirm] = useState(false);
  const [isDemoActionLoading, setIsDemoActionLoading] = useState(false);

  const handleStartDemoAction = async () => {
    setIsDemoActionLoading(true);
    try {
      if ((window as any).__startDemoMode) {
        await (window as any).__startDemoMode();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDemoActionLoading(false);
      setShowDemoStartConfirm(false);
    }
  };

  const handleEndDemoAction = async () => {
    setIsDemoActionLoading(true);
    try {
      if ((window as any).__endDemoMode) {
        await (window as any).__endDemoMode();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDemoActionLoading(false);
      setShowDemoEndConfirm(false);
    }
  };

  const theme = parentTheme || localTheme;

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleThemeChange = (newTheme: string) => {
    if (onThemeChange) {
      onThemeChange(newTheme);
    } else {
      setLocalThemeState(newTheme);
      localStorage.setItem("freezer-theme", newTheme);
      if (newTheme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState<
    "name_asc" | "name_desc" | "stock_asc" | "stock_desc" | "understock" | "primal_asc"
  >("name_asc");
  const [stockLocationFilter, setStockLocationFilter] = useState<
    "all" | "onsite" | "offsite" | "both" | "instock" | "out_of_stock"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("all");
  const [speciesFilter, setSpeciesFilter] = useState<string>("");
  const [primalFilter, setPrimalFilter] = useState<string>("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "primary" | "sub";
    name: string;
    parentPrimary?: string;
    count: number;
  } | null>(null);
  const [activeDecEditor, setActiveDecEditor] = useState<{
    name: string;
    type: "primary" | "sub";
    parentPrimary?: string;
  } | null>(null);

  // Container-specific filter & sorting & bulk editing states
  const [containerSubTab, setContainerSubTab] = useState<'templates' | 'active'>('templates');
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; name: string; imageUrl?: string } | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [templateImageInput, setTemplateImageInput] = useState('');
  const [templateUsageFilter, setTemplateUsageFilter] = useState<"all" | "in_use" | "unused">("all");
  const [templateImageFilter, setTemplateImageFilter] = useState<"all" | "has_image" | "no_image">("all");
  const [templateSortBy, setTemplateSortBy] = useState<"name_asc" | "name_desc" | "usage_desc" | "usage_asc" | "newest">("name_asc");

  const [containerStatusFilter, setContainerStatusFilter] = useState<
    "all" | "placed" | "templates"
  >("all");
  const [containerRetireFilter, setContainerRetireFilter] = useState<
    "all" | "from_template" | "retire_on_empty"
  >("all");
  const [containerLocFilter, setContainerLocFilter] = useState<string>("all");
  const [containerSortBy, setContainerSortBy] = useState<
    "name_asc" | "name_desc" | "items_desc" | "items_asc" | "location_asc"
  >("name_asc");
  const [selectedContainers, setSelectedContainers] = useState<
    Record<string, boolean>
  >({});
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Custom bulk edit fields inside sub-modal
  const [bulkDeleteOnEmpty, setBulkDeleteOnEmpty] = useState<
    "no_change" | "retire" | "keep"
  >("no_change");

  // Product bulk actions states
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, boolean>>({});
  const [isProductBulkEditOpen, setIsProductBulkEditOpen] = useState(false);
  const [isProductBulkDeleteOpen, setIsProductBulkDeleteOpen] = useState(false);
  const [bulkProductPrimary, setBulkProductPrimary] = useState("");
  const [bulkProductSub, setBulkProductSub] = useState("");
  const [bulkProductPrimal, setBulkProductPrimal] = useState<string>(BULK_PRIMAL_NO_CHANGE);
  const [bulkDefaultTagIds, setBulkDefaultTagIds] = useState<string[]>([]);
  const [bulkDefaultTagsMode, setBulkDefaultTagsMode] = useState<'append' | 'replace'>('append');
  const [bulkModifyTags, setBulkModifyTags] = useState<boolean>(false);

  const speciesPrimalIndex = useMemo(
    () => buildSpeciesPrimalIndex(state.speciesPrimals),
    [state.speciesPrimals],
  );

  const currentQuantityMap = useMemo(() => {
    return state.meatCuts.reduce(
      (acc, mc) => {
        acc[mc.productId] = (acc[mc.productId] || 0) + mc.quantity;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [state.meatCuts]);

  const offSiteQuantityMap = useMemo(() => {
    const map: Record<string, number> = {};
    const rawEntries = (state.offSiteEntries || []).filter((e: any) => {
      if (e.archived) return false;
      if (e.box) {
        const boxLower = e.box.toLowerCase().trim();
        const isArchived = (state.boxes || []).some((b: any) => b.isArchived && ((b.name && b.name.toLowerCase().trim() === boxLower) || (b.id && b.id.toLowerCase().trim() === boxLower))) ||
                           (state.containers || []).some((c: any) => c.isBox && c.isArchived && c.name && c.name.toLowerCase().trim() === boxLower);
        if (isArchived) return false;
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
  }, [state.offSiteEntries, state.products, state.containers, state.boxes]);

  const offSiteWeightMap = useMemo(() => {
    const map: Record<string, number> = {};
    const rawEntries = (state.offSiteEntries || []).filter((e: any) => {
      if (e.archived) return false;
      if (e.box) {
        const boxLower = e.box.toLowerCase().trim();
        const isArchived = (state.boxes || []).some((b: any) => b.isArchived && ((b.name && b.name.toLowerCase().trim() === boxLower) || (b.id && b.id.toLowerCase().trim() === boxLower))) ||
                           (state.containers || []).some((c: any) => c.isBox && c.isArchived && c.name && c.name.toLowerCase().trim() === boxLower);
        if (isArchived) return false;
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
  }, [state.offSiteEntries, state.products, state.containers, state.boxes]);

  const handleProductAdded = () => {
    setShowAddForm(false);
  };

  const handleRenameCategory = (
    type: "primary" | "sub",
    oldName: string,
    newName: string,
  ) => {
    dispatch({ type: "RENAME_CATEGORY", payload: { oldName, newName, type } });
  };

  const handleDeleteCategory = (
    type: "primary" | "sub",
    name: string,
    parentPrimary?: string,
  ) => {
    let matchingProductsCount = 0;
    if (type === "primary") {
      matchingProductsCount = state.products.filter(
        (p) => p.primaryCategory === name,
      ).length;
    } else {
      matchingProductsCount = state.products.filter(
        (p) =>
          p.subCategory === name &&
          (!parentPrimary || p.primaryCategory === parentPrimary),
      ).length;
    }
    setConfirmDelete({
      type,
      name,
      parentPrimary,
      count: matchingProductsCount,
    });
  };

  const toggleCategoryCollapse = (primaryName: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [primaryName]: !prev[primaryName],
    }));
  };

  const handleExpandAll = () => {
    setCollapsedCategories({});
  };

  const handleCollapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    const primaryCats = Array.from(
      new Set(state.products.map((p) => p.primaryCategory || "Uncategorized")),
    ) as string[];
    primaryCats.forEach((cat) => {
      collapsed[cat] = true;
    });
    setCollapsedCategories(collapsed);
  };

  const availableCategoryHierarchy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (state.products || []).forEach((p) => {
      const primary = p.primaryCategory || "Uncategorized";
      const sub = p.subCategory || "General";
      if (!map.has(primary)) {
        map.set(primary, new Set<string>());
      }
      map.get(primary)!.add(sub);
    });

    const sortedPrimaries = Array.from(map.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    return sortedPrimaries.map((primary) => {
      const subs = Array.from(map.get(primary)!).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
      return { primary, subs };
    });
  }, [state.products]);

  const categoriesMap = useMemo(() => {
    const map: Record<string, Record<string, Product[]>> = {};
    const searchWords = searchTerm
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    let productsToGroup = state.products || [];
    if (productArchiveFilter === 'active') {
      productsToGroup = productsToGroup.filter(p => !p.isArchived);
    } else if (productArchiveFilter === 'archived') {
      productsToGroup = productsToGroup.filter(p => p.isArchived);
    }

    if (categoryFilter !== "all") {
      productsToGroup = productsToGroup.filter(
        (p) => (p.primaryCategory || "Uncategorized") === categoryFilter,
      );
    }

    if (subCategoryFilter !== "all") {
      productsToGroup = productsToGroup.filter(
        (p) => (p.subCategory || "General") === subCategoryFilter,
      );
    }

    if (stockLocationFilter !== "all") {
      productsToGroup = productsToGroup.filter((p) => {
        const onsite = currentQuantityMap[p.id] || 0;
        const offsiteQty = offSiteQuantityMap[p.id] || 0;
        const offsiteWgt = offSiteWeightMap[p.id] || 0;
        const hasOffsite = offsiteQty > 0 || offsiteWgt > 0;

        if (stockLocationFilter === "onsite") return onsite > 0;
        if (stockLocationFilter === "offsite") return hasOffsite;
        if (stockLocationFilter === "both") return onsite > 0 && hasOffsite;
        if (stockLocationFilter === "instock") return onsite > 0 || hasOffsite;
        if (stockLocationFilter === "out_of_stock") return onsite === 0 && !hasOffsite;
        return true;
      });
    }

    if (speciesFilter) {
      productsToGroup = productsToGroup.filter((p) => {
        const resolved = resolveProductPrimal(p, speciesPrimalIndex);
        return resolved?.species?.id === speciesFilter;
      });
    }

    if (primalFilter) {
      if (primalFilter === UNASSIGNED_PRIMAL_ID) {
        productsToGroup = productsToGroup.filter((p) => !resolveProductPrimal(p, speciesPrimalIndex)?.primal);
      } else {
        productsToGroup = productsToGroup.filter((p) => p.primalId === primalFilter);
      }
    }

    if (searchWords.length > 0) {
      productsToGroup = productsToGroup.filter((p) => {
        const nameLower = p.name.toLowerCase();
        const primaryLower = (
          p.primaryCategory || "Uncategorized"
        ).toLowerCase();
        const subLower = (p.subCategory || "General").toLowerCase();
        const resolved = resolveProductPrimal(p, speciesPrimalIndex);
        const primalLower = (resolved?.primal?.name || "").toLowerCase();
        const speciesLower = (resolved?.species?.name || "").toLowerCase();
        return searchWords.every(
          (word) =>
            nameLower.includes(word) ||
            primaryLower.includes(word) ||
            subLower.includes(word) ||
            primalLower.includes(word) ||
            speciesLower.includes(word) ||
            (p.productNumbers || []).some((n) =>
              n.toLowerCase().includes(word),
            ) ||
            (p.barcode && p.barcode.toLowerCase().includes(word)),
        );
      });
    }

    productsToGroup.forEach((p) => {
      const primary = p.primaryCategory || "Uncategorized";
      const sub = p.subCategory || "General";
      if (!map[primary]) map[primary] = {};
      if (!map[primary][sub]) map[primary][sub] = [];
      map[primary][sub].push(p);
    });

    return map;
  }, [state.products, searchTerm, productArchiveFilter, categoryFilter, subCategoryFilter, stockLocationFilter, speciesFilter, primalFilter, speciesPrimalIndex, currentQuantityMap, offSiteQuantityMap, offSiteWeightMap]);

  const sortedCategoriesMap = useMemo(() => {
    const sortedMap: Record<string, Record<string, Product[]>> = {};

    Object.keys(categoriesMap)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((primary) => {
        sortedMap[primary] = {};
        Object.keys(categoriesMap[primary])
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
          .forEach((sub) => {
            const productsList = [...categoriesMap[primary][sub]];

            productsList.sort((a, b) => {
              const qtyA = currentQuantityMap[a.id] || 0;
              const qtyB = currentQuantityMap[b.id] || 0;

              switch (sortBy) {
                case "name_desc":
                  return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
                case "stock_asc":
                  return qtyA - qtyB;
                case "stock_desc":
                  return qtyB - qtyA;
                case "understock": {
                  const checkProductUnder = (prod: Product, onsiteQty: number) => {
                    if (!prod.listThresholds) return { isUnder: false, limit: 0, deficit: 0 };
                    let maxLimit = 0;
                    let isUnder = false;
                    let maxDeficit = -999999;

                    Object.entries(prod.listThresholds).forEach(([listId, val]) => {
                      const cl = state.customLists?.find((l) => l.id === listId);
                      if (cl && cl.isInventoryControlled && cl.controlCondition !== "max" && val > 0) {
                        const item = cl.items?.find(i => i.productId === prod.id);
                        const source = item?.controlSource || "onsite_count";
                        let valToCheck = onsiteQty;
                        if (source === "offsite_count") {
                          valToCheck = offSiteQuantityMap[prod.id] || 0;
                        } else if (source === "offsite_weight") {
                          valToCheck = offSiteWeightMap[prod.id] || 0;
                        } else if (source === "total_count") {
                          valToCheck = onsiteQty + (offSiteQuantityMap[prod.id] || 0);
                        }

                        if (val > maxLimit) maxLimit = val;
                        if (valToCheck <= val) {
                          isUnder = true;
                          const deficit = val - valToCheck;
                          if (deficit > maxDeficit) {
                            maxDeficit = deficit;
                          }
                        }
                      }
                    });

                    return { isUnder, limit: maxLimit, deficit: maxDeficit === -999999 ? 0 : maxDeficit };
                  };

                  const resA = checkProductUnder(a, qtyA);
                  const resB = checkProductUnder(b, qtyB);

                  if (resA.isUnder && !resB.isUnder) return -1;
                  if (!resA.isUnder && resB.isUnder) return 1;
                  if (resA.isUnder && resB.isUnder) {
                    if (resA.deficit !== resB.deficit) return resB.deficit - resA.deficit;
                  }
                  if (resA.limit !== resB.limit) return resB.limit - resA.limit;
                  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                }
                case "primal_asc": {
                  const resA = resolveProductPrimal(a, speciesPrimalIndex);
                  const resB = resolveProductPrimal(b, speciesPrimalIndex);
                  const labelA = resA?.primal ? resA.fullLabel : "\uffff";
                  const labelB = resB?.primal ? resB.fullLabel : "\uffff";
                  const cmp = labelA.localeCompare(labelB, undefined, { numeric: true, sensitivity: 'base' });
                  if (cmp !== 0) return cmp;
                  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                }
                case "name_asc":
                default:
                  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
              }
            });

            sortedMap[primary][sub] = productsList;
          });
      });

    return sortedMap;
  }, [categoriesMap, sortBy, speciesPrimalIndex, currentQuantityMap, offSiteQuantityMap, offSiteWeightMap, state.customLists]);

  // Product bulk action helpers
  const actualSelectedProductIds = useMemo(() => {
    const existingIds = new Set(state.products.map((p) => p.id));
    return Object.keys(selectedProductIds).filter(
      (id) => selectedProductIds[id] && existingIds.has(id)
    );
  }, [selectedProductIds, state.products]);

  const selectedProductsCount = actualSelectedProductIds.length;

  const handleProductDeselectAll = () => {
    setSelectedProductIds({});
  };

  // Get list of all currently visible products (matching the search term / filters)
  const allVisibleProducts = useMemo(() => {
    const list: Product[] = [];
    Object.keys(sortedCategoriesMap).forEach((primary) => {
      const subMap = sortedCategoriesMap[primary];
      Object.keys(subMap).forEach((sub) => {
        subMap[sub].forEach((prod) => {
          list.push(prod);
        });
      });
    });
    return list;
  }, [sortedCategoriesMap]);

  const catalogTotals = useMemo(() => {
    let targetProducts = state.products || [];
    if (productArchiveFilter === "active") {
      targetProducts = targetProducts.filter((p) => !p.isArchived);
    } else if (productArchiveFilter === "archived") {
      targetProducts = targetProducts.filter((p) => p.isArchived);
    }

    const onSitePacksAll = targetProducts.reduce(
      (sum, p) => sum + (currentQuantityMap[p.id] || 0),
      0,
    );
    const offSitePacksAll = targetProducts.reduce(
      (sum, p) => sum + (offSiteQuantityMap[p.id] || 0),
      0,
    );
    const offSiteLbsAll = targetProducts.reduce(
      (sum, p) => sum + (offSiteWeightMap[p.id] || 0),
      0,
    );
    const combinedPacksAll = onSitePacksAll + offSitePacksAll;

    const onSitePacksVisible = allVisibleProducts.reduce(
      (sum, p) => sum + (currentQuantityMap[p.id] || 0),
      0,
    );
    const offSitePacksVisible = allVisibleProducts.reduce(
      (sum, p) => sum + (offSiteQuantityMap[p.id] || 0),
      0,
    );
    const offSiteLbsVisible = allVisibleProducts.reduce(
      (sum, p) => sum + (offSiteWeightMap[p.id] || 0),
      0,
    );
    const combinedPacksVisible = onSitePacksVisible + offSitePacksVisible;

    const isFiltered =
      searchTerm.trim() !== "" ||
      categoryFilter !== "all" ||
      subCategoryFilter !== "all" ||
      stockLocationFilter !== "all" ||
      speciesFilter !== "" ||
      primalFilter !== "" ||
      productArchiveFilter !== "active";

    return {
      onSitePacksAll,
      offSitePacksAll,
      offSiteLbsAll,
      combinedPacksAll,
      onSitePacksVisible,
      offSitePacksVisible,
      offSiteLbsVisible,
      combinedPacksVisible,
      isFiltered,
    };
  }, [
    state.products,
    productArchiveFilter,
    currentQuantityMap,
    offSiteQuantityMap,
    offSiteWeightMap,
    allVisibleProducts,
    searchTerm,
    categoryFilter,
    subCategoryFilter,
    stockLocationFilter,
    speciesFilter,
    primalFilter,
  ]);

  const handleProductToggleAllMatched = () => {
    const allSelected = allVisibleProducts.length > 0 && allVisibleProducts.every((p) => selectedProductIds[p.id]);
    const nextSelected = { ...selectedProductIds };
    if (allSelected) {
      allVisibleProducts.forEach((p) => {
        delete nextSelected[p.id];
      });
    } else {
      allVisibleProducts.forEach((p) => {
        nextSelected[p.id] = true;
      });
    }
    setSelectedProductIds(nextSelected);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = true;
      }
      return next;
    });
  };

  const handleProductBulkDelete = () => {
    dispatch({
      type: 'BULK_DELETE_PRODUCTS',
      payload: { productIds: actualSelectedProductIds }
    });
    setSelectedProductIds({});
    setIsProductBulkDeleteOpen(false);
  };

  const handleProductBulkEdit = () => {
    const hasPrimalUpdate = bulkProductPrimal !== BULK_PRIMAL_NO_CHANGE;
    if (!bulkProductPrimary.trim() && !bulkProductSub.trim() && !bulkModifyTags && !hasPrimalUpdate) {
      alert('Please specify at least a Category update, a Primal Cut change, or enable Default Tag modifications.');
      return;
    }
    const updates: { 
      primaryCategory?: string; 
      subCategory?: string; 
      primalId?: string | null;
      defaultTagIds?: string[]; 
      defaultTagsMode?: 'append' | 'replace' 
    } = {};
    if (bulkProductPrimary.trim()) updates.primaryCategory = bulkProductPrimary.trim();
    if (bulkProductSub.trim()) updates.subCategory = bulkProductSub.trim();
    if (hasPrimalUpdate) {
      updates.primalId = bulkProductPrimal === BULK_PRIMAL_CLEAR ? null : bulkProductPrimal;
    }
    
    if (bulkModifyTags) {
      updates.defaultTagIds = bulkDefaultTagIds;
      updates.defaultTagsMode = bulkDefaultTagsMode;
    }

    dispatch({
      type: 'BULK_EDIT_PRODUCTS',
      payload: {
        productIds: actualSelectedProductIds,
        updates
      }
    });
    setSelectedProductIds({});
    setIsProductBulkEditOpen(false);
    setBulkProductPrimary('');
    setBulkProductSub('');
    setBulkProductPrimal(BULK_PRIMAL_NO_CHANGE);
    setBulkDefaultTagIds([]);
    setBulkDefaultTagsMode('append');
    setBulkModifyTags(false);
  };

  const handleProductBulkCancel = () => {
    setIsProductBulkEditOpen(false);
    setBulkProductPrimary('');
    setBulkProductSub('');
    setBulkProductPrimal(BULK_PRIMAL_NO_CHANGE);
    setBulkDefaultTagIds([]);
    setBulkDefaultTagsMode('append');
    setBulkModifyTags(false);
  };

  const uniquePrimaryCategories = useMemo(() => {
    const set = new Set<string>();
    state.categories?.filter((c) => c.type === 'primary').forEach((c) => set.add(c.name));
    state.products.forEach((p) => {
      if (p.primaryCategory) set.add(p.primaryCategory);
    });
    return Array.from(set).sort();
  }, [state.categories, state.products]);

  const uniqueSubCategories = useMemo(() => {
    const set = new Set<string>();
    state.categories?.filter((c) => c.type === 'sub').forEach((c) => set.add(c.name));
    state.products.forEach((p) => {
      if (p.subCategory) set.add(p.subCategory);
    });
    return Array.from(set).sort();
  }, [state.categories, state.products]);

  const filteredContainers = useMemo(() => {
    const searchWords = searchTerm
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    let list = state.containers;

    // Exclude the internal loose container layout if necessary and exclude archived containers
    list = list.filter(
      (c) => c.id !== "staging_loose" && !c.id.endsWith("_loose") && !c.isArchived,
    );

    if (searchWords.length > 0) {
      list = list.filter((c) => {
        const nameLower = c.name.toLowerCase();
        let freezerMatch = false;
        if (c.freezerId) {
          const freezer = state.freezers.find((f) => f.id === c.freezerId);
          if (freezer) {
            const freezerNameLower = freezer.name.toLowerCase();
            freezerMatch = searchWords.every((word) =>
              freezerNameLower.includes(word),
            );
          }
        }
        const containerNameMatch = searchWords.every((word) =>
          nameLower.includes(word),
        );
        return containerNameMatch || freezerMatch;
      });
    }

    // Apply type/status filter
    if (containerStatusFilter === "placed") {
      list = list.filter((c) => !!c.freezerId);
    } else if (containerStatusFilter === "templates") {
      list = list.filter((c) => !c.freezerId);
    }

    // Apply container rule/template filter
    if (containerRetireFilter === "from_template") {
      list = list.filter((c) => !!c.templateId || (state.containerTemplates || []).some(t => t.id === c.templateId || t.name.toLowerCase().trim() === c.name.toLowerCase().trim()));
    } else if (containerRetireFilter === "retire_on_empty") {
      list = list.filter((c) => c.deleteOnEmpty);
    }

    // Apply freezer location filter
    if (containerLocFilter !== "all") {
      if (containerLocFilter === "unassigned") {
        list = list.filter((c) => !c.freezerId);
      } else {
        list = list.filter((c) => c.freezerId === containerLocFilter);
      }
    }

    return list;
  }, [
    state.containers,
    state.containerTemplates,
    state.freezers,
    state.meatCuts,
    searchTerm,
    containerStatusFilter,
    containerRetireFilter,
    containerLocFilter,
  ]);

  const sortedContainerGroups = useMemo(() => {
    // Group filteredContainers by exact trimmed lowercase name
    const groupsMap: { [key: string]: Container[] } = {};
    filteredContainers.forEach((c) => {
      const key = c.name.trim().toLowerCase();
      if (!groupsMap[key]) {
        groupsMap[key] = [];
      }
      groupsMap[key].push(c);
    });

    // Convert map to array of ContainerGroups
    const groupsList = Object.entries(groupsMap).map(([key, list]) => {
      const placedInstances = list.filter((c) => c.freezerId);
      const templateInstances = list.filter((c) => !c.freezerId);
      const hasPlaced = placedInstances.length > 0;

      // Choose representative instance for image / icon / deleteOnEmpty
      const representative = hasPlaced
        ? placedInstances[0]
        : templateInstances[0];

      // Sum of quantity across all placed instances inside this group
      const totalItems = list.reduce((sumGroup, c) => {
        const containerCuts = state.meatCuts.filter(
          (mc) => mc.containerId === c.id,
        );
        return (
          sumGroup + containerCuts.reduce((sum, mc) => sum + mc.quantity, 0)
        );
      }, 0);

      return {
        name: representative.name,
        hasPlaced,
        deleteOnEmpty: representative.deleteOnEmpty || false,
        imageUrl: representative.imageUrl,
        icon: representative.icon || "generic",
        placedInstances,
        templateInstances,
        totalItems,
        key,
        allInstances: list,
      };
    });

    // Sort groups
    return groupsList.sort((a, b) => {
      switch (containerSortBy) {
        case "name_desc":
          return b.key.localeCompare(a.key, undefined, { numeric: true, sensitivity: 'base' });
        case "items_desc":
          return b.totalItems - a.totalItems;
        case "items_asc":
          return a.totalItems - b.totalItems;
        case "location_asc": {
          const getFreezerSortName = (groupObj: typeof a) => {
            if (!groupObj.hasPlaced) return "ZZZZZZ unassigned";
            const firstId = groupObj.placedInstances[0]?.freezerId;
            const freezerName =
              state.freezers.find((f) => f.id === firstId)?.name || "";
            return freezerName;
          };
          return (
            getFreezerSortName(a).localeCompare(getFreezerSortName(b), undefined, { numeric: true, sensitivity: 'base' }) ||
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          );
        }
        case "name_asc":
        default:
          return a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' });
      }
    });
  }, [filteredContainers, containerSortBy, state.freezers, state.meatCuts]);

  const filteredTemplates = useMemo(() => {
    const templates = state.containerTemplates || [];
    const activeContainers = (state.containers || []).filter(c => 
      c.id !== "staging_loose" && !c.id.endsWith("_loose")
    );
    const nonArchivedActive = activeContainers.filter(c => !c.isArchived);

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let list = templates;

    if (searchWords.length > 0) {
      list = list.filter(tpl => {
        const nameLower = (tpl.name || '').toLowerCase();
        return searchWords.every(word => nameLower.includes(word));
      });
    }

    if (templateImageFilter === "has_image") {
      list = list.filter(tpl => !!tpl.imageUrl);
    } else if (templateImageFilter === "no_image") {
      list = list.filter(tpl => !tpl.imageUrl);
    }

    if (templateUsageFilter !== "all") {
      list = list.filter(tpl => {
        const linkedCount = nonArchivedActive.filter(c => 
          c.templateId === tpl.id || c.name.toLowerCase().trim() === tpl.name.toLowerCase().trim()
        ).length;
        return templateUsageFilter === "in_use" ? linkedCount > 0 : linkedCount === 0;
      });
    }

    return [...list].sort((a, b) => {
      const linkedA = nonArchivedActive.filter(c => c.templateId === a.id || c.name.toLowerCase().trim() === a.name.toLowerCase().trim()).length;
      const linkedB = nonArchivedActive.filter(c => c.templateId === b.id || c.name.toLowerCase().trim() === b.name.toLowerCase().trim()).length;

      switch (templateSortBy) {
        case "name_desc":
          return (b.name || '').localeCompare(a.name || '', undefined, { numeric: true, sensitivity: 'base' });
        case "usage_desc":
          return linkedB - linkedA;
        case "usage_asc":
          return linkedA - linkedB;
        case "newest":
          return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
        case "name_asc":
        default:
          return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
      }
    });
  }, [state.containerTemplates, state.containers, searchTerm, templateImageFilter, templateUsageFilter, templateSortBy]);

  const actualSelectedIds = useMemo(() => {
    const existingIds = new Set(state.containers.map((c) => c.id));
    return Object.keys(selectedContainers).filter(
      (id) => selectedContainers[id] && existingIds.has(id),
    );
  }, [selectedContainers, state.containers]);

  const selectedCount = actualSelectedIds.length;

  const handleDeselectAll = () => {
    setSelectedContainers({});
  };

  const handleSelectAllMatched = () => {
    const newSelected: Record<string, boolean> = {};
    sortedContainerGroups.forEach((group) => {
      const repId = group.templateInstances[0]?.id || group.placedInstances[0]?.id;
      if (repId) {
        newSelected[repId] = true;
      }
    });
    setSelectedContainers(newSelected);
  };

  const isGroupSelected = (groupKey: string) => {
    const group = sortedContainerGroups.find((g) => g.key === groupKey);
    if (!group) return false;
    const repId = group.templateInstances[0]?.id || group.placedInstances[0]?.id;
    return repId ? !!selectedContainers[repId] : false;
  };

  const toggleGroupSelection = (groupKey: string) => {
    const group = sortedContainerGroups.find((g) => g.key === groupKey);
    if (!group) return;
    const repId = group.templateInstances[0]?.id || group.placedInstances[0]?.id;
    if (!repId) return;

    setSelectedContainers((prev) => {
      const next = { ...prev };
      if (next[repId]) {
        delete next[repId];
      } else {
        next[repId] = true;
      }
      return next;
    });
  };

  const renderUnifiedContainerGroups = () => {
    if (sortedContainerGroups.length === 0) {
      return (
        <div className="text-center py-12 bg-cool-gray-900/10 rounded-xl border-2 border-dashed border-cool-gray-800 mt-4">
          <p className="text-cool-gray-400 text-sm">
            No containers on record matching your criteria.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {sortedContainerGroups.map((group) => {
          const Icon = getContainerIcon(group.icon || "generic");
          const groupSelected = isGroupSelected(group.key);
          const isFromTemplate = group.allInstances.some(c => !!c.templateId) || (state.containerTemplates || []).some(t => t.id === group.key || t.name.toLowerCase().trim() === group.name.toLowerCase().trim());

          return (
            <div
              key={group.key}
              className={`bg-cool-gray-800/80 rounded-xl border ${groupSelected ? "border-cyan-500 bg-cool-gray-800/95 shadow-md shadow-cyan-950/15" : "border-cool-gray-700/60"} shadow-md overflow-hidden transition-all duration-200`}
            >
              {/* Group Header block */}
              <div
                className={`p-4 ${groupSelected ? "bg-cyan-950/15" : "bg-cool-gray-850/60"} border-b border-cool-gray-750/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <label
                    className="flex items-center justify-center p-1 cursor-pointer select-none shrink-0"
                    title="Select this container group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={groupSelected}
                      onChange={() => toggleGroupSelection(group.key)}
                      className="w-4 h-4 rounded text-cyan-500 bg-cool-gray-905 border-cool-gray-650 focus:ring-cyan-500 focus:ring-offset-cool-gray-850 focus:ring-2 cursor-pointer"
                    />
                  </label>

                  {group.imageUrl ? (
                    <div className="relative shrink-0">
                      <img
                        src={group.imageUrl}
                        alt={group.name}
                        className="w-12 h-12 rounded-lg object-cover border border-cool-gray-700/50 cursor-zoom-in hover:scale-105 active:scale-95 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          (window as any).__showImagePreview?.(
                            group.imageUrl,
                            group.name,
                          );
                        }}
                        title="Click to zoom in"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-cool-gray-750 border border-cool-gray-700/55 flex items-center justify-center shrink-0 shadow-inner">
                      <Icon className="w-6 h-6 text-cyan-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-white shrink-0 truncate">
                        {group.name}
                      </h3>

                      {group.hasPlaced && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>{" "}
                          {group.placedInstances.length} Placed
                        </span>
                      )}

                      {isFromTemplate && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-950/75 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-inner">
                          📋 From Template
                        </span>
                      )}

                      {group.deleteOnEmpty && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] bg-amber-950/70 text-amber-400 border border-amber-800/60 px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider animate-pulse"
                          title="These containers delete/retire when completely empty."
                        >
                          🗑️ Retire on Empty
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group Locations Hierarchy */}
              <div className="p-1 sm:p-2.5 bg-cool-gray-900/10">
                {group.hasPlaced ? (
                  <div className="space-y-1.5">
                    {group.placedInstances.map(
                      (container: Container, index: number) => {
                        const freezer = state.freezers.find(
                          (f) => f.id === container.freezerId,
                        );
                        const containerCuts = state.meatCuts.filter(
                          (mc) => mc.containerId === container.id,
                        );
                        const totalItems = containerCuts.reduce(
                          (sum, mc) => sum + mc.quantity,
                          0,
                        );
                        const instanceIsFromTemplate = !!container.templateId || (state.containerTemplates || []).some(t => t.id === container.templateId || t.name.toLowerCase().trim() === container.name.toLowerCase().trim());

                        return (
                          <div
                            key={container.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition gap-3 bg-cool-gray-800/45 hover:bg-cool-gray-750 border-cool-gray-750 hover:border-cool-gray-700`}
                          >
                            <div className="flex-1 min-w-0 flex items-start gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className="text-xs text-cool-gray-500 font-mono">
                                    #{index + 1}
                                  </span>
                                  <span className="text-xs text-cool-gray-450 font-bold">
                                    Location:
                                  </span>
                                  <span className="text-xs text-cyan-300 font-semibold bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-900/30">
                                    {freezer?.name || "Freezer"} ➔{" "}
                                    {container.name}
                                  </span>
                                  {instanceIsFromTemplate && (
                                    <span className="text-[9px] bg-indigo-950/70 text-indigo-300 border border-indigo-800/40 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider shrink-0">
                                      From Template
                                    </span>
                                  )}
                                  {container.deleteOnEmpty && (
                                    <span className="text-[9px] bg-amber-950/70 text-amber-400 border border-amber-800/40 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider shrink-0">
                                      Retire on Empty
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-cool-gray-500 font-medium">
                                    Contents:
                                  </span>
                                  <span
                                    className={`font-bold ${totalItems > 0 ? "text-emerald-400" : "text-cool-gray-500 italic"}`}
                                  >
                                    {totalItems} item(s) ({containerCuts.length}{" "}
                                    item type
                                    {containerCuts.length !== 1 ? "s" : ""})
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-2 self-end sm:self-center shrink-0"
                            >
                              <button
                                onClick={() => navigateToFreezer(container.id)}
                                className="px-2.5 py-1.5 text-xs bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 font-semibold rounded-md transition cursor-pointer"
                                title="Locate container on visual freezer board"
                              >
                                Locate ➔
                              </button>
                              <button
                                role="button"
                                onClick={() =>
                                  openModal({
                                    type: "EDIT_CONTAINER",
                                    containerId: container.id,
                                  })
                                }
                                className="p-1 px-1.5 hover:bg-cool-gray-700 text-cool-gray-400 hover:text-white transition rounded-md border border-cool-gray-700/50 cursor-pointer"
                                title="Edit this active instance properties"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  // Render single unplaced spare container
                  <div
                    onClick={() =>
                      toggleGroupSelection(group.key)
                    }
                    className={`p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition cursor-pointer ${isGroupSelected(group.key) ? "bg-cyan-950/15 border-cyan-500/55 hover:bg-cyan-950/20 shadow-sm shadow-cyan-950/5" : "bg-cool-gray-800/40 border-cool-gray-750/30 hover:bg-cool-gray-800/60"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div>
                        {isFromTemplate && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-950/75 text-indigo-300 border border-indigo-800/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              📋 From Template
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-cool-gray-400 italic">
                          Unassigned spare container definition. Clicking "+ Container" inside a freezer places a container.
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2 self-end sm:self-center shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        role="button"
                        onClick={() =>
                          openModal({
                            type: "EDIT_CONTAINER",
                            containerId: group.templateInstances[0].id,
                          })
                        }
                        className="p-2 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-white transition rounded-lg border border-cool-gray-700/50 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                        title="Edit container definition properties"
                      >
                        <EditIcon className="w-4 h-4" /> Edit Container
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderContainersTab = () => {
    const templates = state.containerTemplates || [];
    const activeContainers = (state.containers || []).filter(c => 
      c.id !== "staging_loose" && !c.id.endsWith("_loose")
    );
    const nonArchivedActive = activeContainers.filter(c => !c.isArchived);

    return (
      <div className="space-y-4 font-sans">
        {/* SUB-TAB 1: TEMPLATES CATALOG */}
        {containerSubTab === 'templates' && (
          <div className="space-y-4">
            <CatalogSearchFilterBar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search container templates by name..."
              isFiltersOpen={showTemplateFilters}
              onToggleFilters={() => setShowTemplateFilters(prev => !prev)}
              activeFilterCount={
                (templateUsageFilter !== 'all' ? 1 : 0) +
                (templateImageFilter !== 'all' ? 1 : 0) +
                (templateSortBy !== 'name_asc' ? 1 : 0)
              }
              onResetFilters={() => {
                setSearchTerm('');
                setTemplateUsageFilter('all');
                setTemplateImageFilter('all');
                setTemplateSortBy('name_asc');
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Active Usage
                  </label>
                  <select
                    value={templateUsageFilter}
                    onChange={(e) => setTemplateUsageFilter(e.target.value as any)}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer font-sans"
                  >
                    <option value="all">All Templates ({templates.length})</option>
                    <option value="in_use">In Use ({templates.filter(t => nonArchivedActive.some(c => c.templateId === t.id || c.name.toLowerCase().trim() === t.name.toLowerCase().trim())).length})</option>
                    <option value="unused">Unused ({templates.filter(t => !nonArchivedActive.some(c => c.templateId === t.id || c.name.toLowerCase().trim() === t.name.toLowerCase().trim())).length})</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Photo Asset
                  </label>
                  <select
                    value={templateImageFilter}
                    onChange={(e) => setTemplateImageFilter(e.target.value as any)}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer font-sans"
                  >
                    <option value="all">All Templates</option>
                    <option value="has_image">Has Custom Photo</option>
                    <option value="no_image">No Photo Attached</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Sort Order
                  </label>
                  <select
                    value={templateSortBy}
                    onChange={(e) => setTemplateSortBy(e.target.value as any)}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer font-sans"
                  >
                    <option value="name_asc">Name: A to Z</option>
                    <option value="name_desc">Name: Z to A</option>
                    <option value="usage_desc">Most Active Containers First</option>
                    <option value="usage_asc">Least Active Containers First</option>
                    <option value="newest">Recently Added First</option>
                  </select>
                </div>
              </div>
            </CatalogSearchFilterBar>

            <div className="bg-cool-gray-850/60 p-3 rounded-xl border border-cool-gray-750/70 text-xs text-cool-gray-300 flex items-center justify-between gap-2">
              <p>
                📋 <strong>Container Templates Catalog:</strong> Templates store reusable container definitions. Active containers linked to a template inherit updates automatically.
              </p>
              <span className="text-[11px] font-bold text-cool-gray-400 shrink-0 tabular-nums">
                {filteredTemplates.length} / {templates.length}
              </span>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-12 bg-cool-gray-900/20 rounded-xl border-2 border-dashed border-cool-gray-800">
                <p className="text-cool-gray-400 text-sm mb-3">No container templates cataloged yet.</p>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateNameInput('');
                    setTemplateImageInput('');
                    setShowAddTemplateModal(true);
                  }}
                  className="px-4 py-2 bg-cyan-600 text-white font-bold text-xs rounded-lg hover:bg-cyan-500 transition cursor-pointer"
                >
                  + Create First Container Template
                </button>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-10 bg-cool-gray-900/10 rounded-xl border border-cool-gray-800">
                <p className="text-cool-gray-400 text-sm font-medium">No templates matching your search and filter criteria.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTemplates.map(tpl => {
                  const linkedActive = nonArchivedActive.filter(c => c.templateId === tpl.id || c.name.toLowerCase().trim() === tpl.name.toLowerCase().trim());
                  const Icon = getContainerIcon(tpl.icon || 'generic');

                  return (
                    <div
                      key={tpl.id}
                      className="bg-cool-gray-850 rounded-xl border border-cool-gray-750 hover:border-cyan-500/50 p-3.5 shadow-sm transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {tpl.imageUrl ? (
                          <img
                            src={tpl.imageUrl}
                            alt={tpl.name}
                            className="w-12 h-12 rounded-lg object-cover border border-cool-gray-700 cursor-zoom-in shrink-0 hover:scale-105 transition-transform"
                            onClick={() => (window as any).__showImagePreview?.(tpl.imageUrl, tpl.name)}
                            title="Click to zoom preview"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-cool-gray-750 border border-cool-gray-700/60 flex items-center justify-center shrink-0 shadow-inner">
                            <Icon className="w-6 h-6 text-cyan-300" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <h4 className="text-sm font-extrabold text-white truncate">{tpl.name}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${linkedActive.length > 0 ? 'bg-cyan-950/70 text-cyan-300 border-cyan-800/40' : 'bg-cool-gray-800 text-cool-gray-400 border-cool-gray-700'}`}>
                              {linkedActive.length > 0 ? `${linkedActive.length} Active` : 'Unused'}
                            </span>
                          </div>
                          <p className="text-xs text-cool-gray-400 truncate">
                            {linkedActive.length > 0
                              ? `In use by ${linkedActive.length} active placement${linkedActive.length === 1 ? '' : 's'} across freezers`
                              : 'Reusable container template definition'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate({ id: tpl.id, name: tpl.name, imageUrl: tpl.imageUrl });
                          }}
                          className="py-1.5 px-3 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 rounded-lg border border-cool-gray-700 transition cursor-pointer text-xs font-semibold flex items-center gap-1.5"
                          title="Edit Template Properties"
                        >
                          <EditIcon className="w-3.5 h-3.5 text-cyan-400" /> Edit Template
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateToDelete({ id: tpl.id, name: tpl.name });
                          }}
                          className="p-1.5 bg-red-955/40 hover:bg-red-900/60 text-red-400 rounded-lg border border-red-900/40 transition cursor-pointer"
                          title="Delete Template from Catalog"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: ACTIVE CONTAINERS */}
        {containerSubTab === 'active' && (
          <div className="space-y-4">
            {renderUnifiedContainers()}
          </div>
        )}
      </div>
    );
  };

  const renderUnifiedContainers = (containersList?: Container[]) => {
    const activeContainerFilterCount =
      (containerStatusFilter !== 'all' ? 1 : 0) +
      (containerRetireFilter !== 'all' ? 1 : 0) +
      (containerLocFilter !== 'all' ? 1 : 0) +
      (containerSortBy !== 'name_asc' ? 1 : 0);

    return (
      <div className="space-y-4">
        <CatalogSearchFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search containers or freezer placements..."
          isFiltersOpen={showContainerFilters}
          onToggleFilters={() => setShowContainerFilters(prev => !prev)}
          activeFilterCount={activeContainerFilterCount}
          onResetFilters={() => {
            setSearchTerm('');
            setContainerStatusFilter('all');
            setContainerRetireFilter('all');
            setContainerLocFilter('all');
            setContainerSortBy('name_asc');
            setSelectedContainers({});
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Placement Status
              </label>
              <select
                value={containerStatusFilter}
                onChange={(e) => {
                  setContainerStatusFilter(e.target.value as any);
                  setSelectedContainers({});
                }}
                className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer font-sans"
              >
                <option value="all">All Statuses</option>
                <option value="placed">Active Placements Only</option>
                <option value="templates">Spare Blueprints Only</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Type / Rule Filter
              </label>
              <select
                value={containerRetireFilter}
                onChange={(e) => {
                  setContainerRetireFilter(e.target.value as any);
                  setSelectedContainers({});
                }}
                className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer font-sans"
              >
                <option value="all">All Containers</option>
                <option value="from_template">From Template</option>
                <option value="retire_on_empty">Retire on Empty</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Location Freezer
              </label>
              <select
                value={containerLocFilter}
                onChange={(e) => {
                  setContainerLocFilter(e.target.value);
                  setSelectedContainers({});
                }}
                className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer font-sans"
              >
                <option value="all">All Locations</option>
                <option value="unassigned">Spare Blueprints</option>
                {state.freezers.filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Arrangement Sort
              </label>
              <select
                value={containerSortBy}
                onChange={(e) => setContainerSortBy(e.target.value as any)}
                className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer font-sans"
              >
                <option value="name_asc">Name: A to Z</option>
                <option value="name_desc">Name: Z to A</option>
                <option value="items_desc">Contents Size: High to Low</option>
                <option value="items_asc">Contents Size: Low to High</option>
                <option value="location_asc">Freezer Placement Group</option>
              </select>
            </div>
          </div>
        </CatalogSearchFilterBar>

        {filteredContainers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-cool-gray-900/40 border border-cool-gray-750/30 rounded-xl text-xs select-none">
            <span className="text-cool-gray-400 font-semibold">
              Showing <strong className="text-cool-gray-200 tabular-nums">{filteredContainers.length}</strong> container{filteredContainers.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllMatched}
                className="text-[11px] px-2.5 py-1 bg-cyan-950/45 hover:bg-cyan-900/40 text-cyan-300 rounded font-bold border border-cyan-800/35 transition-all cursor-pointer"
                title="Select all active filtered containers"
              >
                Select All Matching ({filteredContainers.length})
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-[11px] px-2.5 py-1 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-300 rounded font-semibold border border-cool-gray-700 transition-all cursor-pointer"
                >
                  Deselect All ({selectedCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main dynamic container list */}
        {renderUnifiedContainerGroups()}

        {/* Floating/Sticky Bulk Actions Tray */}
        {selectedCount > 0 && (
          <div className="sticky bottom-4 left-0 right-0 z-40 p-4 bg-cool-gray-850 border border-cyan-500/50 rounded-xl shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-4 animate-slide-up mt-6">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-black">
                {selectedCount}
              </span>
              <span className="text-sm font-semibold text-cool-gray-850 dark:text-cool-gray-200">
                container{selectedCount === 1 ? "" : "s"} selected in catalog
              </span>
              <button
                onClick={handleDeselectAll}
                className="text-xs text-cyan-500 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 underline font-semibold transition ml-1 cursor-pointer"
              >
                Deselect All
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
              <button
                onClick={() => {
                  setBulkDeleteOnEmpty("no_change");
                  setBulkModalOpen(true);
                }}
                className="text-xs px-3 py-2 bg-cool-gray-100 hover:bg-cool-gray-200 dark:bg-cool-gray-800 dark:hover:bg-cool-gray-750 text-cool-gray-800 dark:text-cool-gray-100 rounded-lg border border-cool-gray-300 dark:border-cool-gray-700 transition-all font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Bulk edit icon or empty rules for selection"
              >
                ✏️ Bulk Edit Properties
              </button>

              <button
                onClick={() => {
                  actualSelectedIds.forEach((id) => {
                    dispatch({
                      type: "EDIT_CONTAINER",
                      payload: {
                        containerId: id,
                        updates: { deleteOnEmpty: true },
                      },
                    });
                  });
                }}
                className="text-xs px-3 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-900/40 rounded-lg transition-all font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                title="Set selection to retire as soon as they become empty"
              >
                🗑️ Set Retire on Empty
              </button>

              <button
                onClick={() => {
                  actualSelectedIds.forEach((id) => {
                    dispatch({
                      type: "EDIT_CONTAINER",
                      payload: {
                        containerId: id,
                        updates: { deleteOnEmpty: false },
                      },
                    });
                  });
                }}
                className="text-xs px-3 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/40 rounded-lg transition-all font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
                title="Set selection to keep inside spare pool when they become empty"
              >
                ♻️ Set Kept on Empty
              </button>

              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="text-xs px-3 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-750 dark:hover:bg-rose-700 active:scale-95 text-white rounded-lg transition-all font-black flex items-center gap-1.5 shadow-md border border-rose-600 dark:border-rose-800 cursor-pointer"
                title="Permanently remove selected containers and contents"
              >
                <BinIcon className="w-3.5 h-3.5" /> Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (showAddForm && activeTab === "products") {
      return (
        <div className="mt-4 p-4 bg-cool-gray-800 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Create New Product</h3>
          <ManagementForms.ProductForm
            dispatch={dispatch}
            onClose={handleProductAdded}
            products={state.products}
            state={state}
          />
        </div>
      );
    }

    switch (activeTab) {
      case "products": {
        if (state.products.length === 0) {
          return (
            <div className="text-center py-12 bg-cool-gray-900/10 rounded-xl border-2 border-dashed border-cool-gray-800">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-4">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  <p className="text-cool-gray-400 text-sm font-medium animate-pulse">Loading products from database...</p>
                </div>
              ) : (
                <p className="text-cool-gray-400 text-sm">
                  No products found. Click "+ Add Product" to create one.
                </p>
              )}
            </div>
          );
        }

        const activeProductFilterCount =
          (categoryFilter !== "all" ? 1 : 0) +
          (stockLocationFilter !== "all" ? 1 : 0) +
          (speciesFilter ? 1 : 0) +
          (primalFilter ? 1 : 0) +
          (sortBy !== "name_asc" ? 1 : 0);

        return (
          <div className="space-y-4">
            <CatalogSearchFilterBar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search products, categories, primals, SKU, or barcode..."
              isFiltersOpen={showProductFilters}
              onToggleFilters={() => setShowProductFilters((prev) => !prev)}
              activeFilterCount={activeProductFilterCount}
              onResetFilters={() => {
                setCategoryFilter('all');
                setSubCategoryFilter('all');
                setStockLocationFilter('all');
                setSpeciesFilter('');
                setPrimalFilter('');
                setSortBy('name_asc');
                setSearchTerm('');
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Category / Subcategory
                  </label>
                  <select
                    value={
                      categoryFilter === "all"
                        ? "all"
                        : subCategoryFilter === "all"
                        ? `cat:${categoryFilter}`
                        : `sub:${categoryFilter}|${subCategoryFilter}`
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "all") {
                        setCategoryFilter("all");
                        setSubCategoryFilter("all");
                      } else if (val.startsWith("cat:")) {
                        setCategoryFilter(val.slice(4));
                        setSubCategoryFilter("all");
                      } else if (val.startsWith("sub:")) {
                        const [pCat, sCat] = val.slice(4).split("|");
                        setCategoryFilter(pCat);
                        setSubCategoryFilter(sCat);
                      }
                    }}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white font-semibold outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="all" className="bg-cool-gray-900 text-white font-bold">
                      All Categories &amp; Subcategories
                    </option>
                    {availableCategoryHierarchy.map(({ primary, subs }) => (
                      <optgroup key={primary} label={primary} className="bg-cool-gray-900 text-cyan-400 font-bold">
                        <option value={`cat:${primary}`} className="bg-cool-gray-900 text-white font-bold">
                          {primary} (All)
                        </option>
                        {subs.map((sub) => (
                          <option key={`${primary}|${sub}`} value={`sub:${primary}|${sub}`} className="bg-cool-gray-900 text-cool-gray-200 font-normal">
                            {primary} / {sub}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Stock Location
                  </label>
                  <select
                    value={stockLocationFilter}
                    onChange={(e) => setStockLocationFilter(e.target.value as any)}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white font-semibold outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="all" className="bg-cool-gray-900 text-white">All Stock Locations</option>
                    <option value="onsite" className="bg-cool-gray-900 text-emerald-300">On-Site Stock (&gt;0 pkgs)</option>
                    <option value="offsite" className="bg-cool-gray-900 text-indigo-300">Off-Site Stock (&gt;0 pkgs/lbs)</option>
                    <option value="both" className="bg-cool-gray-900 text-cyan-300">Both On &amp; Off-Site (&gt;0)</option>
                    <option value="instock" className="bg-cool-gray-900 text-emerald-400">In Stock Anywhere (&gt;0)</option>
                    <option value="out_of_stock" className="bg-cool-gray-900 text-rose-300">Out of Stock / Neither (0)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Species
                  </label>
                  <select
                    value={speciesFilter}
                    onChange={(e) => {
                      const nextSp = e.target.value;
                      setSpeciesFilter(nextSp);
                      if (nextSp && primalFilter && primalFilter !== UNASSIGNED_PRIMAL_ID) {
                        const pr = speciesPrimalIndex.primalById.get(primalFilter);
                        if (pr && pr.parentSpeciesId !== nextSp) setPrimalFilter("");
                      }
                    }}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white font-semibold outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">All Species</option>
                    {speciesPrimalIndex.speciesList.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.icon ? `${sp.icon} ${sp.name}` : sp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Primal Cut
                  </label>
                  <PrimalSelect
                    speciesPrimals={state.speciesPrimals}
                    speciesFilterId={speciesFilter || undefined}
                    value={primalFilter}
                    onChange={setPrimalFilter}
                    includeEmptyOption
                    emptyOptionLabel="All Primals"
                    emptyOptionValue=""
                    includeUnassignedFilterOption
                    unassignedFilterLabel="Unassigned Primal"
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white font-semibold outline-none focus:border-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Sort Order
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white font-semibold outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="name_asc">Name: A to Z</option>
                    <option value="name_desc">Name: Z to A</option>
                    <option value="primal_asc">Primal Cut: A to Z</option>
                    <option value="stock_asc">Stock: Low to High</option>
                    <option value="stock_desc">Stock: High to Low</option>
                    <option value="understock">Understocked First</option>
                  </select>
                </div>
              </div>
            </CatalogSearchFilterBar>

            {Object.keys(sortedCategoriesMap).length === 0 ? (
              <div className="text-center py-12 bg-cool-gray-900/10 rounded-xl border-2 border-dashed border-cool-gray-800 space-y-3">
                <p className="text-cool-gray-400 text-sm">
                  No products or categories found matching your current filters.
                </p>
                {catalogTotals.isFiltered && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('all');
                      setSubCategoryFilter('all');
                      setStockLocationFilter('all');
                      setSpeciesFilter('');
                      setPrimalFilter('');
                      setProductArchiveFilter('active');
                      setSortBy('name_asc');
                      setSearchTerm('');
                    }}
                    className="px-3.5 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 border border-cool-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <>
            {/* Catalog-Wide Cumulative Quantities Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-cool-gray-850/40 p-3.5 border border-cool-gray-750/70 rounded-xl">
              {/* On-Site Stock */}
              <div className="flex items-center gap-3 p-2 bg-cool-gray-900/40 rounded-lg border border-emerald-500/20">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-emerald-950/50 text-emerald-400 flex items-center justify-center text-lg font-bold border border-emerald-800/40">
                  🏠
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">On-Site Stock</span>
                  <span className="text-base font-extrabold text-emerald-400 leading-tight font-mono">
                    {catalogTotals.isFiltered
                      ? `${catalogTotals.onSitePacksVisible.toLocaleString()} / ${catalogTotals.onSitePacksAll.toLocaleString()}`
                      : catalogTotals.onSitePacksAll.toLocaleString()}{' '}
                    <span className="text-[10px] font-bold uppercase text-emerald-300">pkgs</span>
                  </span>
                  <span className="text-[9px] text-cool-gray-400 leading-none truncate mt-0.5">
                    On-site freezer packages
                  </span>
                </div>
              </div>

              {/* Off-Site Stock */}
              <div className="flex items-center gap-3 p-2 bg-cool-gray-900/40 rounded-lg border border-indigo-500/20">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-indigo-950/50 text-indigo-400 flex items-center justify-center text-lg font-bold border border-indigo-800/40">
                  🏭
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">Off-Site Stock</span>
                  <span className="text-base font-extrabold text-indigo-300 leading-tight font-mono">
                    {catalogTotals.isFiltered
                      ? `${catalogTotals.offSitePacksVisible.toLocaleString()} / ${catalogTotals.offSitePacksAll.toLocaleString()}`
                      : catalogTotals.offSitePacksAll.toLocaleString()}{' '}
                    <span className="text-[10px] font-bold uppercase text-indigo-300">pkgs</span>
                    <span className="text-xs text-indigo-400 font-semibold ml-1">
                      ({catalogTotals.isFiltered ? catalogTotals.offSiteLbsVisible.toFixed(1) : catalogTotals.offSiteLbsAll.toFixed(1)} lbs)
                    </span>
                  </span>
                  <span className="text-[9px] text-cool-gray-400 leading-none truncate mt-0.5">
                    Cold storage packages & weight
                  </span>
                </div>
              </div>

              {/* Combined Total Stock */}
              <div className="flex items-center gap-3 p-2 bg-cool-gray-900/40 rounded-lg border border-cyan-500/30">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-cyan-950/50 text-cyan-400 flex items-center justify-center text-lg font-bold border border-cyan-800/40">
                  ⚡
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">Combined Stock</span>
                  <span className="text-base font-extrabold text-cyan-300 leading-tight font-mono">
                    {catalogTotals.isFiltered
                      ? `${catalogTotals.combinedPacksVisible.toLocaleString()} / ${catalogTotals.combinedPacksAll.toLocaleString()}`
                      : catalogTotals.combinedPacksAll.toLocaleString()}{' '}
                    <span className="text-[10px] font-bold uppercase text-cyan-300">pkgs</span>
                    {(catalogTotals.isFiltered ? catalogTotals.offSiteLbsVisible : catalogTotals.offSiteLbsAll) > 0 && (
                      <span className="text-xs text-cyan-400/90 font-semibold ml-1">
                        (+{(catalogTotals.isFiltered ? catalogTotals.offSiteLbsVisible : catalogTotals.offSiteLbsAll).toFixed(1)} lbs)
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-cool-gray-400 leading-none truncate mt-0.5">
                    Total across On-site + Off-site
                  </span>
                </div>
              </div>

              {/* Catalog Reference Count */}
              <div className="flex items-center gap-3 p-2 bg-cool-gray-900/40 rounded-lg border border-cool-gray-700/40">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-cool-gray-800 text-cool-gray-200 flex items-center justify-center text-lg font-bold border border-cool-gray-700/50">
                  🏷️
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">Catalog Items</span>
                  <span className="text-base font-extrabold text-cool-gray-150 leading-tight">
                    {catalogTotals.isFiltered ? `${allVisibleProducts.length} / ${state.products.length}` : state.products.length}{' '}
                    <span className="text-[10px] font-semibold text-cool-gray-450 uppercase">items</span>
                  </span>
                  <span className="text-[9px] text-cool-gray-400 leading-none truncate mt-0.5">
                    Across {Object.keys(sortedCategoriesMap).length} active categories
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Selection & Collapse Header/Toolbar for Catalog */}
            {allVisibleProducts.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-cool-gray-900/40 border border-cool-gray-750/30 rounded-xl text-xs select-none">
                <div className="flex items-center gap-2">
                  <span className="text-cool-gray-400 font-semibold">
                    Catalog items matching filters: <strong className="text-cool-gray-200">{allVisibleProducts.length}</strong> product{allVisibleProducts.length === 1 ? '' : 's'}
                  </span>
                  {selectedProductsCount > 0 && (
                    <span className="text-cyan-400 font-bold bg-cyan-950/40 px-2.5 py-0.5 rounded border border-cyan-800/30">
                      {selectedProductsCount} Selected
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="px-2.5 py-1 bg-cool-gray-850 hover:bg-cool-gray-750 border border-cool-gray-700/60 text-cool-gray-200 hover:text-white rounded-md text-[11px] font-semibold transition cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="px-2.5 py-1 bg-cool-gray-850 hover:bg-cool-gray-750 border border-cool-gray-700/60 text-cool-gray-200 hover:text-white rounded-md text-[11px] font-semibold transition cursor-pointer"
                  >
                    Collapse All
                  </button>
                  <button
                    type="button"
                    onClick={handleProductToggleAllMatched}
                    className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 bg-cool-gray-850 hover:bg-cool-gray-750 border border-cool-gray-700/60 rounded-md transition cursor-pointer"
                  >
                    {allVisibleProducts.every(p => selectedProductIds[p.id]) ? 'Deselect All' : 'Select All Matching'}
                  </button>
                </div>
              </div>
            )}

            {/* Hierarchical Tree List */}
            <div className="space-y-3">
              {Object.keys(sortedCategoriesMap).map((primary) => {
                const isCollapsed = collapsedCategories[primary];
                const subMap = sortedCategoriesMap[primary];

                const totalProductsInPrimary = (
                  Object.values(subMap) as Product[][]
                ).reduce((sum, products) => sum + products.length, 0);
                if (totalProductsInPrimary === 0) return null;

                const primaryOnSitePacks = (
                  Object.values(subMap) as Product[][]
                ).reduce((sum, prods) => {
                  return sum + prods.reduce((subSum, prod) => subSum + (currentQuantityMap[prod.id] || 0), 0);
                }, 0);

                const primaryOffSitePacks = (
                  Object.values(subMap) as Product[][]
                ).reduce((sum, prods) => {
                  return sum + prods.reduce((subSum, prod) => subSum + (offSiteQuantityMap[prod.id] || 0), 0);
                }, 0);

                const primaryOffSiteLbs = (
                  Object.values(subMap) as Product[][]
                ).reduce((sum, prods) => {
                  return sum + prods.reduce((subSum, prod) => subSum + (offSiteWeightMap[prod.id] || 0), 0);
                }, 0);

                const primaryTotalPacks = primaryOnSitePacks + primaryOffSitePacks;

                // Find primary category decoration config
                const primaryDec = state.categories?.find(
                  (c) =>
                    c.type === "primary" &&
                    c.name.toLowerCase().trim() ===
                      primary.toLowerCase().trim(),
                );

                return (
                  <div
                    key={primary}
                    className="border border-cool-gray-750 bg-cool-gray-900/10 rounded-lg overflow-hidden transition-all duration-200"
                  >
                    {/* Primary Category Header */}
                    <div
                      onClick={() => toggleCategoryCollapse(primary)}
                      className="w-full flex items-center justify-between p-3 border-b bg-cool-gray-800/80 border-cool-gray-700/50 hover:bg-cool-gray-850/40 transition cursor-pointer select-none"
                    >
                      <div
                        className="flex items-center gap-3 flex-grow min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCategoryCollapse(primary);
                          }}
                          className="text-cool-gray-400 hover:text-white transition p-0.5"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                            stroke="currentColor"
                            className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m19.5 8.25-7.5 7.5-7.5-7.5"
                            />
                          </svg>
                        </button>

                        {primaryDec?.icon && (
                          <span className="text-base select-none shrink-0">
                            {primaryDec.icon}
                          </span>
                        )}

                        <div className="flex-grow min-w-0 max-w-sm">
                          <InlineEdit
                            value={primary}
                            onSave={(newName) =>
                              handleRenameCategory("primary", primary, newName)
                            }
                            textClass="font-bold text-sm md:text-base text-cool-gray-150 hover:text-cyan-400 transition"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-cool-gray-750/50 text-cool-gray-300 border-cool-gray-700/40">
                            {totalProductsInPrimary} {totalProductsInPrimary === 1 ? "product" : "products"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-emerald-950/40 text-emerald-300 border-emerald-800/30 font-mono" title="On-site freezer stock">
                            On-Site: {primaryOnSitePacks} pkgs
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-indigo-950/40 text-indigo-300 border-indigo-800/30 font-mono" title="Off-site cold storage stock">
                            Off-Site: {primaryOffSitePacks} pkgs{primaryOffSiteLbs > 0 ? ` (${primaryOffSiteLbs.toFixed(1)} lbs)` : ''}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold border bg-cyan-950/50 text-cyan-300 border-cyan-800/40 font-mono" title="Combined total stock (On-site + Off-site)">
                            Total: {primaryTotalPacks} pkgs{primaryOffSiteLbs > 0 ? ` (+${primaryOffSiteLbs.toFixed(1)} lbs)` : ''}
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-2 shrink-0 ml-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setActiveDecEditor(
                              activeDecEditor?.name === primary &&
                                activeDecEditor?.type === "primary"
                                ? null
                                : { name: primary, type: "primary" },
                            );
                          }}
                          className={`p-1.5 transition rounded-md ${activeDecEditor?.name === primary && activeDecEditor?.type === "primary" ? "bg-cyan-500/20 text-cyan-400" : "text-cool-gray-400 hover:text-cyan-400 hover:bg-cool-gray-800"}`}
                          title="Edit Category Icon"
                        >
                          <Palette className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteCategory("primary", primary)
                          }
                          className="p-1.5 text-rose-400 hover:text-rose-350 hover:bg-rose-500/10 transition rounded-md"
                          title="Delete category & all its products"
                        >
                          <BinIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Style Editor Panel for Primary Category */}
                    {activeDecEditor?.type === "primary" &&
                      activeDecEditor?.name === primary && (
                        <div
                          className="mx-3 mt-3 mb-3 p-1 animate-fadeIn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CategoryStyleEditor
                            name={primary}
                            type="primary"
                            categories={state.categories}
                            onSave={(icon) => {
                              dispatch({
                                type: "UPDATE_CATEGORY_DECORATION",
                                payload: {
                                  name: primary,
                                  type: "primary",
                                  icon,
                                },
                              });
                            }}
                            onClose={() => setActiveDecEditor(null)}
                          />
                        </div>
                      )}

                    {/* Subcategories and Products List */}
                    {!isCollapsed && (
                      <div className="p-3 space-y-4 bg-cool-gray-900/10">
                        {Object.keys(subMap).map((sub) => {
                          const productsList = subMap[sub];
                          if (productsList.length === 0) return null;

                          const subOnSitePacks = productsList.reduce(
                            (sum, prod) => sum + (currentQuantityMap[prod.id] || 0),
                            0,
                          );
                          const subOffSitePacks = productsList.reduce(
                            (sum, prod) => sum + (offSiteQuantityMap[prod.id] || 0),
                            0,
                          );
                          const subOffSiteLbs = productsList.reduce(
                            (sum, prod) => sum + (offSiteWeightMap[prod.id] || 0),
                            0,
                          );
                          const subTotalPacks = subOnSitePacks + subOffSitePacks;

                          // Find subcategory decoration config
                          const subDec = state.categories?.find(
                            (c) =>
                              c.type === "sub" &&
                              c.name.toLowerCase().trim() ===
                                sub.toLowerCase().trim() &&
                              c.parentPrimary?.toLowerCase().trim() ===
                                primary.toLowerCase().trim(),
                          );

                          return (
                            <div
                              key={sub}
                              className="pl-3 border-l border-cool-gray-700/30 space-y-2"
                            >
                              {/* Subcategory miniheader */}
                              <div className="flex items-center justify-between py-1 group/sub">
                                <div className="flex items-center gap-2 flex-grow min-w-0 max-w-xs">
                                  <div className="text-[11px] font-bold text-cool-gray-500 uppercase tracking-wider shrink-0">
                                    -
                                  </div>
                                  {subDec?.icon && (
                                    <span className="text-sm select-none shrink-0">
                                      {subDec.icon}
                                    </span>
                                  )}
                                  <div className="flex-grow min-w-0">
                                    <InlineEdit
                                      value={sub}
                                      onSave={(newName) =>
                                        handleRenameCategory(
                                          "sub",
                                          sub,
                                          newName,
                                        )
                                      }
                                      textClass="text-xs font-semibold tracking-wide text-cool-gray-300 hover:text-cyan-400 transition"
                                    />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold border bg-cool-gray-800/40 text-cool-gray-400 border-transparent">
                                      {productsList.length} {productsList.length === 1 ? "item" : "items"}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold border bg-emerald-950/30 text-emerald-400 border-emerald-800/20 font-mono">
                                      On: {subOnSitePacks} pkgs
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold border bg-indigo-950/30 text-indigo-400 border-indigo-800/20 font-mono">
                                      Off: {subOffSitePacks} pkgs{subOffSiteLbs > 0 ? ` (${subOffSiteLbs.toFixed(1)} lbs)` : ''}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-extrabold border bg-cyan-950/30 text-cyan-300 border-cyan-800/20 font-mono">
                                      Total: {subTotalPacks} pkgs{subOffSiteLbs > 0 ? ` (+${subOffSiteLbs.toFixed(1)} lbs)` : ''}
                                    </span>
                                  </div>
                                </div>

                                <div
                                  className="flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => {
                                      setActiveDecEditor(
                                        activeDecEditor?.name === sub &&
                                          activeDecEditor?.type === "sub" &&
                                          activeDecEditor?.parentPrimary ===
                                            primary
                                          ? null
                                          : {
                                              name: sub,
                                              type: "sub",
                                              parentPrimary: primary,
                                            },
                                      );
                                    }}
                                    className={`p-1 transition rounded ${activeDecEditor?.name === sub && activeDecEditor?.type === "sub" && activeDecEditor?.parentPrimary === primary ? "bg-cyan-500/20 text-cyan-400 opacity-100" : "p-1 text-cool-gray-500 hover:text-cyan-455 hover:bg-cool-gray-800 opacity-0 group-hover/sub:opacity-100 focus:opacity-100"}`}
                                    title="Edit Subcategory Icon"
                                  >
                                    <Palette className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteCategory("sub", sub, primary)
                                    }
                                    className="p-1 text-cool-gray-500 hover:text-rose-450 hover:bg-cool-gray-800 transition rounded opacity-0 group-hover/sub:opacity-100 focus:opacity-100"
                                    title="Delete subcategory and all products inside"
                                  >
                                    <BinIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Style Editor Panel for Subcategory */}
                              {activeDecEditor?.type === "sub" &&
                                activeDecEditor?.name === sub &&
                                activeDecEditor?.parentPrimary === primary && (
                                  <div
                                    className="my-2 p-1 animate-fadeIn"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <CategoryStyleEditor
                                      name={sub}
                                      type="sub"
                                      parentPrimary={primary}
                                      categories={state.categories}
                                      onSave={(icon) => {
                                        dispatch({
                                          type: "UPDATE_CATEGORY_DECORATION",
                                          payload: {
                                            name: sub,
                                            type: "sub",
                                            parentPrimary: primary,
                                            icon,
                                          },
                                        });
                                      }}
                                      onClose={() => setActiveDecEditor(null)}
                                    />
                                  </div>
                                )}

                              {/* Nested product rows */}
                              <ul className="space-y-1.5 pl-3">
                                {productsList.map((product) => (
                                  <li
                                    key={product.id}
                                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border shadow-xs transition-all duration-200 gap-2 ${selectedProductIds[product.id] ? "border-cyan-500 bg-cool-gray-850/70" : "bg-cool-gray-850/40 hover:bg-cool-gray-800/80 border-cool-gray-700/40"}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={!!selectedProductIds[product.id]}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleProductSelection(product.id);
                                        }}
                                        className="w-4 h-4 rounded text-cyan-500 bg-cool-gray-950 border-cool-gray-750/70 focus:ring-cyan-505 focus:ring-2 cursor-pointer shrink-0 mr-1.5"
                                        title="Select product for bulk actions"
                                      />
                                      {product.imageUrl ? (
                                        <img
                                          src={product.imageUrl}
                                          alt={product.name}
                                          className="w-11 h-11 rounded object-cover cursor-zoom-in hover:scale-110 active:scale-95 transition-transform duration-200 shadow"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            (
                                              window as any
                                            ).__showImagePreview?.(
                                              product.imageUrl,
                                              product.name,
                                            );
                                          }}
                                          title="Click to zoom in"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <div className="w-11 h-11 rounded bg-cool-gray-750 flex items-center justify-center border border-cool-gray-700/50">
                                          <PackageIcon className="w-5 h-5 text-cool-gray-500" />
                                        </div>
                                      )}
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-cool-gray-100 font-semibold text-sm">
                                            {product.name}
                                          </p>
                                          {(() => {
                                            const resolved = resolveProductPrimal(product, speciesPrimalIndex);
                                            if (!resolved?.primal) return null;
                                            return (
                                              <span className="text-xs text-cool-gray-400 font-medium">
                                                · {resolved.species ? `${resolved.species.name} · ${resolved.primal.name}` : resolved.primal.name}
                                              </span>
                                            );
                                          })()}
                                          {product.isArchived && (
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/80 shrink-0 shadow-xs">
                                              Archived
                                            </span>
                                          )}
                                        </div>
                                        {product.productNumbers &&
                                          product.productNumbers.length > 0 && (
                                            <p className="text-[11px] flex items-center gap-1 flex-wrap mt-0.5 text-cyan-400">
                                              <span className="text-[10px] text-cool-gray-500 uppercase font-bold tracking-wider text-[9px]">
                                                Item #s:
                                              </span>
                                              {product.productNumbers.map(
                                                (num, i) => (
                                                  <span
                                                    key={i}
                                                    className="bg-cyan-950/40 text-cyan-300 font-mono text-[9px] px-1.5 py-0.2 rounded border border-cyan-800/20"
                                                  >
                                                    {num}
                                                  </span>
                                                ),
                                              )}
                                            </p>
                                          )}
                                        {product.barcode && (
                                          <p className="text-[11px] flex items-center gap-1 flex-wrap mt-0.5">
                                            <span className="text-[10px] text-cool-gray-500 uppercase font-bold tracking-wider text-[9px]">
                                              Barcode:
                                            </span>
                                            <span 
                                              className="bg-cool-gray-900 text-cool-gray-300 font-mono text-[9px] px-1.5 py-0.2 rounded border border-cool-gray-700/60"
                                              title="Default 0-lb weight-embedded UPC-A barcode"
                                            >
                                              {product.barcode}
                                            </span>
                                          </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5 select-none">
                                          {/* On-Site Stock Pill */}
                                          {product.salePrice !== undefined && product.salePrice > 0 && (
                                            <div className="flex items-center bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[11px] sm:text-xs" title="Sales Price">
                                              <span className="text-emerald-400/80 font-bold mr-1 text-[9px] sm:text-[10px] uppercase tracking-wider font-mono">
                                                Price:
                                              </span>
                                              <span className="text-emerald-300 font-extrabold font-mono">
                                                ${Number(product.salePrice).toFixed(2)}/{product.salePriceUnit === 'package' ? 'pkg' : 'lb'}
                                              </span>
                                            </div>
                                          )}
                                          <div className="flex items-center bg-cool-gray-950 border border-emerald-500/15 px-2 py-0.5 rounded-lg text-[11px] sm:text-xs" title="On-Site Stock (Freezers)">
                                            <span className="text-cool-gray-400 font-bold mr-1 text-[9px] sm:text-[10px] uppercase tracking-wider font-mono">
                                              On-Site:
                                            </span>
                                            <span className="text-emerald-400 font-black font-mono">
                                              {currentQuantityMap[product.id] || 0} pkgs
                                            </span>
                                          </div>

                                          {/* Off-Site Stock Pill */}
                                          <div className="flex items-center bg-cool-gray-950 border border-indigo-500/20 px-2 py-0.5 rounded-lg text-[11px] sm:text-xs" title="Off-Site Stock (Cold Storage)">
                                            <span className="text-cool-gray-400 font-bold mr-1 text-[9px] sm:text-[10px] uppercase tracking-wider font-mono">
                                              Off-Site:
                                            </span>
                                            <span className="text-indigo-400 font-black font-mono">
                                              {offSiteQuantityMap[product.id] || 0} pkgs
                                              {(offSiteWeightMap[product.id] || 0) > 0 && (
                                                <span className="text-[10px] text-indigo-300 font-bold ml-1">
                                                  ({(offSiteWeightMap[product.id] || 0).toFixed(1)} lbs)
                                                </span>
                                              )}
                                            </span>
                                          </div>

                                          {/* Combined Total Stock Pill */}
                                          <div className="flex items-center bg-cool-gray-900 border border-cyan-500/40 px-2 py-0.5 rounded-lg text-[11px] sm:text-xs" title="Combined Total Stock (On-Site + Off-Site)">
                                            <span className="text-cyan-300/85 font-extrabold mr-1 text-[9px] sm:text-[10px] uppercase tracking-wider font-mono">
                                              Total:
                                            </span>
                                            <span className="text-cyan-300 font-black font-mono">
                                              {(currentQuantityMap[product.id] || 0) + (offSiteQuantityMap[product.id] || 0)} pkgs
                                              {(offSiteWeightMap[product.id] || 0) > 0 && (
                                                <span className="text-[10px] text-cyan-200 font-bold ml-1">
                                                  (+{(offSiteWeightMap[product.id] || 0).toFixed(1)} lbs)
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 self-end sm:self-center">
                                      {(() => {
                                        const prodTotalStock = (currentQuantityMap[product.id] || 0) + (offSiteQuantityMap[product.id] || 0);
                                        if (product.isArchived) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                dispatch({
                                                  type: 'EDIT_PRODUCT',
                                                  payload: {
                                                    productId: product.id,
                                                    updates: { isArchived: false }
                                                  }
                                                });
                                              }}
                                              className="px-2 py-1 text-xs font-bold text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/60 transition rounded-md flex items-center gap-1 cursor-pointer"
                                              title="Unarchive product to restore to active catalog"
                                            >
                                              Unarchive
                                            </button>
                                          );
                                        }
                                        return (
                                          <button
                                            type="button"
                                            disabled={prodTotalStock > 0}
                                            onClick={() => {
                                              if (prodTotalStock > 0) return;
                                              dispatch({
                                                type: 'EDIT_PRODUCT',
                                                payload: {
                                                  productId: product.id,
                                                  updates: { isArchived: true }
                                                }
                                              });
                                            }}
                                            className={`px-2 py-1 text-xs font-bold rounded-md transition flex items-center gap-1 ${
                                              prodTotalStock > 0
                                                ? 'text-cool-gray-500 bg-cool-gray-800/40 border border-cool-gray-750/50 cursor-not-allowed opacity-50'
                                                : 'text-cool-gray-300 hover:text-amber-300 hover:bg-cool-gray-750 border border-cool-gray-700 cursor-pointer'
                                            }`}
                                            title={
                                              prodTotalStock > 0
                                                ? `Cannot archive: Product has ${prodTotalStock} unit(s) in stock. Clear inventory first.`
                                                : 'Archive product (hides from everyday selection lists)'
                                            }
                                          >
                                            Archive
                                          </button>
                                        );
                                      })()}
                                      <button
                                        onClick={() =>
                                          openModal({
                                            type: "EDIT_PRODUCT",
                                            productId: product.id,
                                          })
                                        }
                                        className="p-1.5 text-cool-gray-400 hover:text-white hover:bg-cool-gray-700 transition rounded-md"
                                        title="Edit Product Details & Image"
                                      >
                                        <EditIcon className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              </>
            )}
          </div>
        );
      }
      case "species_primals":
        return <SpeciesPrimalsManager state={state} dispatch={dispatch} />;
      case "containers":
        return renderContainersTab();
      case "freezers":
        return <ManageFreezers state={state} dispatch={dispatch} type="freezers" />;
      case "pwa":
      case "users_devices": {
        if (!authLoaded) {
          return (
            <div className="mt-6 bg-cool-gray-850 border border-cool-gray-750 rounded-xl p-8 text-center text-cool-gray-400 text-xs">
              Verifying administrator permissions...
            </div>
          );
        }
        if (isAdminGated) {
          return (
            <div className="mt-6 max-w-xl mx-auto bg-cool-gray-850 border border-amber-500/40 rounded-2xl p-6 text-center space-y-4 shadow-xl animate-fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Shield className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-white">Administrator Access Required</h3>
                <p className="text-xs text-cool-gray-300 leading-relaxed">
                  Users &amp; Connected Devices management is restricted to administrators.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => openAccountModal('signin')}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Sign In as Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTab("products")}
                  className="px-4 py-2 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-300 text-xs font-bold transition cursor-pointer"
                >
                  Return to Catalog
                </button>
              </div>
            </div>
          );
        }
        return <UsersAndDevicesPanel hideInternalHeader />;
      }
      case "offsite_settings": {
        return (
          <OffSiteSettingsPanel
            state={state}
            dispatch={dispatch}
            fromName={defaultFromName}
            setFromName={setDefaultFromName}
            fromAddress={defaultFromAddress}
            setFromAddress={setDefaultFromAddress}
            theoreticalBoxWeight={theoreticalBoxWeight}
            setTheoreticalBoxWeight={setTheoreticalBoxWeight}
          />
        );
      }
      case "butcher_settings": {
        return (
          <ButcherSettingsPanel
            state={state}
            dispatch={dispatch}
            onNavigateToSpeciesPrimals={() => handleSwitchTab("species_primals")}
          />
        );
      }
      case "settings": {
        if (!authLoaded) {
          return (
            <div className="bg-cool-gray-850 border border-cool-gray-750 rounded-xl p-8 text-center text-cool-gray-400 text-xs">
              Verifying administrator permissions...
            </div>
          );
        }
        if (isAdminGated) {
          return (
            <div className="max-w-xl mx-auto bg-cool-gray-850 border border-amber-500/40 rounded-2xl p-6 text-center space-y-4 shadow-xl animate-fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Shield className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-white">Administrator Access Required</h3>
                <p className="text-xs text-cool-gray-300 leading-relaxed">
                  General Settings are restricted to administrators.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => openAccountModal('signin')}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Sign In as Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTab("products")}
                  className="px-4 py-2 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-300 text-xs font-bold transition cursor-pointer"
                >
                  Return to Catalog
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-6 max-w-4xl font-sans">
            <div className="space-y-6 animate-fade-in">
              {/* Standalone PWA / Open in Chrome & Home Screen Branding Card */}
              <div className="bg-cool-gray-850 rounded-xl border border-cool-gray-750 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-800">
                    <div>
                      <h3 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-cyan-400" />
                        Offline App Installation & Browser Launch
                      </h3>
                      <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
                        To install the tracker as a standalone home-screen app for true offline freezer usage, open it in an external browser window (<span className="text-cool-gray-200 font-semibold">Google Chrome</span> or <span className="text-cool-gray-200 font-semibold">Safari</span>) rather than inside the Home Assistant Companion App.
                      </p>
                    </div>
                    <span className="self-start sm:self-auto text-[11px] font-semibold text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      PWA Ready
                    </span>
                  </div>

                  {/* Direct Link Display */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-cool-gray-400 uppercase tracking-wider">
                        Direct PWA App URL
                      </label>
                      {!isEditingPwaUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const customUrlConfig = (state.appConfig || []).find(item => item.key === 'pwa_custom_url');
                            setCustomPwaUrl(customUrlConfig?.value || "");
                            setIsEditingPwaUrl(true);
                            setPwaUrlError("");
                          }}
                          className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none"
                        >
                          <span>⚙️ Configure Custom Link</span>
                        </button>
                      )}
                    </div>

                    {!isEditingPwaUrl ? (
                      /* Standard Link View */
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-cool-gray-950 p-2.5 rounded-xl border border-cool-gray-800">
                        <div className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 bg-cool-gray-900 rounded-lg border border-cool-gray-800/80">
                          <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="text-xs font-mono text-cool-gray-300 truncate select-all">
                            {(() => {
                              const customUrlConfig = (state.appConfig || []).find(item => item.key === 'pwa_custom_url');
                              if (customUrlConfig && customUrlConfig.value.trim()) {
                                return customUrlConfig.value.trim();
                              }
                              return typeof window !== 'undefined' ? window.location.href : 'http://homeassistant.local:3000';
                            })()}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              const customUrlConfig = (state.appConfig || []).find(item => item.key === 'pwa_custom_url');
                              const activeUrl = (customUrlConfig && customUrlConfig.value.trim()) 
                                ? customUrlConfig.value.trim() 
                                : window.location.href;
                              navigator.clipboard.writeText(activeUrl);
                              setCopiedUrl(true);
                              setTimeout(() => setCopiedUrl(false), 2500);
                            }
                          }}
                          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer select-none ${
                            copiedUrl
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-200 border border-cool-gray-700 hover:text-white'
                          }`}
                          title="Copy full URL to clipboard"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span>Copied Link!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>

                        <PWAInstallButton />
                      </div>
                    ) : (
                      /* Custom URL Edit Form */
                      <div className="space-y-3 p-4 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800/80 animate-fade-in">
                        <div>
                          <span className="text-[10px] font-bold text-cyan-300 block mb-1 uppercase tracking-wider">Set Custom Domain or IP Link</span>
                          <p className="text-[11px] text-cool-gray-400 leading-relaxed font-medium">
                            Enter your permanent public address (e.g. your Cloudflare Tunnel domain like <span className="text-cool-gray-300 font-semibold">https://freezer.nickweinstock.com</span>) or direct local IP address to allow your phone or tablet's Chrome browser to download, install, and run this application cleanly as an offline standalone PWA.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="relative flex-grow">
                              <input
                                type="text"
                                placeholder="e.g. https://freezer.nickweinstock.com"
                                value={customPwaUrl}
                                onChange={(e) => {
                                  setCustomPwaUrl(e.target.value);
                                  setPwaUrlError("");
                                }}
                                className="w-full bg-cool-gray-950 text-xs font-mono font-medium rounded-lg border border-cool-gray-750 px-3 py-2 text-cool-gray-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-cool-gray-600"
                              />
                            </div>
                          </div>

                          {pwaUrlError && (
                            <p className="text-[11px] text-red-400 font-bold flex items-center gap-1 animate-pulse">
                              ⚠️ {pwaUrlError}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1 justify-end">
                            {/* Reset to Default Button */}
                            {((state.appConfig || []).some(item => item.key === 'pwa_custom_url' && item.value.trim())) && (
                              <button
                                type="button"
                                disabled={isSavingPwaUrl}
                                onClick={async () => {
                                  setIsSavingPwaUrl(true);
                                  try {
                                    const res = await authFetch(getApiUrl('api/app-config/pwa_custom_url'), {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' }
                                    });
                                    if (res.ok) {
                                      const data = await res.json().catch(() => ({}));
                                      const remainingConfigs = (state.appConfig || []).filter(item => item.key !== 'pwa_custom_url');
                                      if (data.configs) {
                                        const newConfigs = Object.entries(data.configs)
                                          .filter(([k]) => k !== 'pwa_custom_url')
                                          .map(([k, v]) => ({
                                            key: k,
                                            value: v as string,
                                            updatedAt: new Date().toISOString()
                                          }));
                                        dispatch({
                                          type: 'REPLACE_STATE',
                                          payload: { ...state, appConfig: newConfigs }
                                        });
                                      } else {
                                        dispatch({
                                          type: 'REPLACE_STATE',
                                          payload: { ...state, appConfig: remainingConfigs }
                                        });
                                      }
                                      setCustomPwaUrl("");
                                      setIsEditingPwaUrl(false);
                                      setPwaUrlError("");
                                    } else {
                                      setPwaUrlError("Failed to clear custom URL.");
                                    }
                                  } catch (err) {
                                    setPwaUrlError("Network error clearing custom URL.");
                                  } finally {
                                    setIsSavingPwaUrl(false);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950/40 text-red-400 border border-red-900/30 hover:bg-red-900/35 hover:text-white transition cursor-pointer disabled:opacity-50"
                              >
                                Reset to Default Link
                              </button>
                            )}

                            <div className="flex gap-2 ml-auto">
                              <button
                                type="button"
                                disabled={isSavingPwaUrl}
                                onClick={() => {
                                  setIsEditingPwaUrl(false);
                                  setPwaUrlError("");
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 transition cursor-pointer disabled:opacity-50"
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                disabled={isSavingPwaUrl}
                                onClick={async () => {
                                  const trimmed = customPwaUrl.trim();
                                  if (trimmed) {
                                    // Simple URL validation helper: check if it starts with http:// or https://
                                    if (!/^https?:\/\//i.test(trimmed)) {
                                      setPwaUrlError("URL must start with http:// or https://");
                                      return;
                                    }
                                  }

                                  setIsSavingPwaUrl(true);
                                  try {
                                    const res = await authFetch(getApiUrl('api/app-config'), {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ key: 'pwa_custom_url', value: trimmed })
                                    });
                                    if (res.ok) {
                                      const data = await res.json().catch(() => ({}));
                                      if (data.configs) {
                                        const newConfigs = Object.entries(data.configs).map(([k, v]) => ({
                                          key: k,
                                          value: v as string,
                                          updatedAt: new Date().toISOString()
                                        }));
                                        dispatch({
                                          type: 'REPLACE_STATE',
                                          payload: { ...state, appConfig: newConfigs }
                                        });
                                      }
                                      setCustomPwaUrl(trimmed);
                                      setIsEditingPwaUrl(false);
                                      setPwaUrlError("");
                                    } else {
                                      setPwaUrlError("Failed to save custom URL.");
                                    }
                                  } catch (err) {
                                    setPwaUrlError("Network error saving custom URL.");
                                  } finally {
                                    setIsSavingPwaUrl(false);
                                  }
                                }}
                                className="px-4.5 py-1.5 rounded-lg text-xs font-extrabold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                              >
                                {isSavingPwaUrl ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                                    <span>Saving...</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5 text-white" />
                                    <span>Save Link</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PWA App Name & Icon Customization */}
                  <div className="pt-4 border-t border-cool-gray-750/70 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-cool-gray-200 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          App Name & Home Screen Icon
                        </h4>
                        <p className="text-[11px] text-cool-gray-400 mt-0.5 leading-relaxed">
                          Customize how the app appears when installed on your phone, tablet, or desktop home screen.
                        </p>
                      </div>
                      {pwaBrandingMessage && (
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 animate-fade-in ${
                          pwaBrandingMessage.type === 'success' 
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' 
                            : 'bg-red-950/80 text-red-400 border border-red-800/60'
                        }`}>
                          {pwaBrandingMessage.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          {pwaBrandingMessage.text}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Left 2 Cols: Form fields & Icon selection */}
                      <div className="md:col-span-2 space-y-3.5">
                        {/* App Full Name */}
                        <div>
                          <label className="text-[10px] font-extrabold text-cool-gray-400 uppercase tracking-wider block mb-1">
                            Application Name (Full Title)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Freezer Inventory Tracker"
                            value={pwaAppName}
                            onChange={(e) => setPwaAppName(e.target.value)}
                            className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-750 px-3 py-2 text-cool-gray-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-cool-gray-600"
                          />
                          <span className="text-[10px] text-cool-gray-500 mt-0.5 block">
                            Displayed in browser tabs, window headers, and full install dialogs.
                          </span>
                        </div>

                        {/* App Short Name */}
                        <div>
                          <label className="text-[10px] font-extrabold text-cool-gray-400 uppercase tracking-wider block mb-1">
                            Mobile Home Screen Short Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. FreezerApp"
                            maxLength={15}
                            value={pwaShortName}
                            onChange={(e) => setPwaShortName(e.target.value)}
                            className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-750 px-3 py-2 text-cool-gray-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-cool-gray-600"
                          />
                          <span className="text-[10px] text-cool-gray-500 mt-0.5 block">
                            Shown beneath the icon on your device home screen (recommended: 12 chars or fewer).
                          </span>
                        </div>

                        {/* Icon Mode Tabs: Preset vs Custom */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-extrabold text-cool-gray-400 uppercase tracking-wider">
                              Choose App Icon
                            </label>
                            <div className="flex items-center rounded-lg bg-cool-gray-950 p-0.5 border border-cool-gray-800 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => setPwaIconType('preset')}
                                className={`px-2.5 py-0.5 rounded-md transition cursor-pointer ${pwaIconType === 'preset' ? 'bg-cyan-600 text-white' : 'text-cool-gray-400 hover:text-white'}`}
                              >
                                Preset Icons
                              </button>
                              <button
                                type="button"
                                onClick={() => setPwaIconType('custom')}
                                className={`px-2.5 py-0.5 rounded-md transition cursor-pointer ${pwaIconType === 'custom' ? 'bg-cyan-600 text-white' : 'text-cool-gray-400 hover:text-white'}`}
                              >
                                Custom Image
                              </button>
                            </div>
                          </div>

                          {pwaIconType === 'preset' ? (
                            <div className="space-y-2.5">
                              {/* Preset Icons Selection */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {[
                                  { id: 'freezer_logo', name: 'App Logo (Freezer)', icon: FreezerAppLogoIcon, isOfficial: true },
                                  { id: 'snowflake', name: 'Snowflake', icon: Snowflake },
                                  { id: 'beef', name: 'Butcher / Beef', icon: Beef },
                                  { id: 'package', name: 'Storage Box', icon: Package },
                                  { id: 'pallet', name: 'Pallet / Staging', icon: Layers },
                                  { id: 'truck', name: 'Freight / Truck', icon: Truck },
                                  { id: 'warehouse', name: 'Depot Facility', icon: Warehouse },
                                  { id: 'fish', name: 'Seafood / Fish', icon: Fish },
                                  { id: 'thermometer', name: 'Sub-Zero Cryo', icon: Thermometer },
                                  { id: 'qrcode', name: 'QR Scanner', icon: QrCode },
                                ].map((preset) => {
                                  const IconComp = preset.icon;
                                  const isSelected = (pwaPresetIcon === preset.id) || (!pwaPresetIcon && preset.id === 'freezer_logo');
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      onClick={() => setPwaPresetIcon(preset.id)}
                                      className={`p-2.5 rounded-xl flex flex-col items-center gap-1.5 transition cursor-pointer border relative ${
                                        isSelected 
                                          ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300 ring-2 ring-cyan-500/40 shadow-sm' 
                                          : 'bg-cool-gray-950 border-cool-gray-800 text-cool-gray-400 hover:border-cool-gray-750 hover:text-cool-gray-200'
                                      }`}
                                    >
                                      {preset.isOfficial && (
                                        <span className="absolute -top-1.5 -right-1 px-1.5 py-0.2 bg-cyan-600 text-white text-[8px] font-extrabold rounded-full uppercase tracking-tight shadow-sm">
                                          Default
                                        </span>
                                      )}
                                      <IconComp className={`w-5 h-5 ${preset.isOfficial ? 'text-cyan-400' : ''}`} />
                                      <span className="text-[10px] font-semibold text-center truncate w-full">{preset.name}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Color Palette */}
                              <div>
                                <span className="text-[10px] font-extrabold text-cool-gray-400 uppercase tracking-wider block mb-1">
                                  Icon Background Color
                                </span>
                                <div className="flex flex-wrap gap-2 items-center">
                                  {[
                                    { color: '#0f172a', name: 'Navy' },
                                    { color: '#0284c7', name: 'Cyan' },
                                    { color: '#0ea5e9', name: 'Sky' },
                                    { color: '#991b1b', name: 'Crimson' },
                                    { color: '#d97706', name: 'Amber' },
                                    { color: '#047857', name: 'Emerald' },
                                    { color: '#6d28d9', name: 'Violet' },
                                    { color: '#334155', name: 'Slate' }
                                  ].map(({ color, name }) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => setPwaIconColor(color)}
                                      style={{ backgroundColor: color }}
                                      title={name}
                                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                                        pwaIconColor === color ? 'border-white scale-110 shadow-md shadow-cyan-500/20' : 'border-cool-gray-700 hover:scale-105'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Custom Image Upload */
                            <div className="space-y-2 p-3 bg-cool-gray-950 rounded-xl border border-cool-gray-800">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-cool-gray-300">
                                  Upload farm logo, crest, or custom icon (PNG, JPG, SVG, WebP)
                                </span>
                                {pwaCustomImage && (
                                  <button
                                    type="button"
                                    onClick={() => setPwaCustomImage(null)}
                                    className="text-[10px] text-red-400 hover:underline cursor-pointer"
                                  >
                                    Remove Image
                                  </button>
                                )}
                              </div>
                              <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-cool-gray-750 hover:border-cyan-500/60 rounded-lg cursor-pointer bg-cool-gray-900/40 hover:bg-cool-gray-900/80 transition-all">
                                <Upload className="w-5 h-5 text-cyan-400 mb-1" />
                                <span className="text-xs font-semibold text-cool-gray-200">
                                  {pwaCustomImage ? 'Change Image File' : 'Choose or Drag Image File'}
                                </span>
                                <span className="text-[10px] text-cool-gray-500 mt-0.5">
                                  Square transparent PNG or SVG recommended
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (loadEv) => {
                                        if (loadEv.target?.result) {
                                          setPwaCustomImage(loadEv.target.result as string);
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Col: Live Interactive Mobile Home Screen Preview */}
                      <div className="flex flex-col items-center justify-center p-4 bg-cool-gray-950/80 rounded-xl border border-cool-gray-800 text-center">
                        <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-3">
                          Home Screen Preview
                        </span>
                        <div className="flex flex-col items-center gap-1.5 my-auto">
                          {/* Squircle App Icon */}
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl border border-white/10 relative overflow-hidden transition-all duration-300"
                            style={{ backgroundColor: pwaIconColor }}
                          >
                            {pwaIconType === 'custom' && pwaCustomImage ? (
                              <img src={pwaCustomImage} alt="App Icon" className="w-11 h-11 object-contain" />
                            ) : (
                              <div className="text-white">
                                {(!pwaPresetIcon || pwaPresetIcon === 'freezer_logo') && <FreezerAppLogoIcon className="w-11 h-11 text-white" />}
                                {pwaPresetIcon === 'snowflake' && <Snowflake className="w-9 h-9 stroke-[1.8]" />}
                                {pwaPresetIcon === 'beef' && <Beef className="w-9 h-9 stroke-[1.8]" />}
                                {pwaPresetIcon === 'package' && <Package className="w-9 h-9 stroke-[1.8]" />}
                                {pwaPresetIcon === 'pallet' && <Layers className="w-9 h-9 stroke-[1.8]" />}
                                {pwaPresetIcon === 'truck' && <Truck className="w-9 h-9 stroke-[1.8]" />}
                                {pwaPresetIcon === 'warehouse' && <Warehouse className="w-9 h-9 stroke-[1.8]" />}
                                {pwaPresetIcon === 'fish' && <Fish className="w-9 h-9 stroke-[1.8]" />}
                                {pwaPresetIcon === 'thermometer' && <Thermometer className="w-9 h-9 stroke-[1.8]" />}
                                {pwaPresetIcon === 'qrcode' && <QrCode className="w-9 h-9 stroke-[1.8]" />}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/25 pointer-events-none rounded-2xl"></div>
                          </div>
                          {/* Short Name Label Under Icon */}
                          <span className="text-xs font-bold text-cool-gray-200 tracking-tight max-w-[100px] truncate">
                            {pwaShortName || 'FreezerApp'}
                          </span>
                        </div>
                        <span className="text-[10px] text-cool-gray-500 mt-3">
                          Rendered on device home screen
                        </span>
                      </div>
                    </div>

                    {/* Save and Reset Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cool-gray-800">
                      <button
                        type="button"
                        disabled={isSavingPwaBranding}
                        onClick={handleResetPwaBranding}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 border border-cool-gray-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-cool-gray-400" />
                        <span>Reset to Defaults</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSavingPwaBranding}
                        onClick={handleSavePwaBranding}
                        className="px-4.5 py-1.5 rounded-lg text-xs font-extrabold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        {isSavingPwaBranding ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                            <span>Saving Branding...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5 text-white" />
                            <span>Save App Name & Icon</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Demo Sandbox Playground Card */}
                <div className="bg-cool-gray-850 rounded-xl border border-amber-500/30 p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-amber-300 mb-1 flex items-center gap-2">
                      Demo Sandbox Playground
                    </h3>
                    <p className="text-xs text-cool-gray-400 leading-relaxed font-medium">
                      Spawn a temporary sandbox duplicate of your live inventory database. All changes made in the playground are isolated and discarded once you exit.
                    </p>
                  </div>

                  <div className="bg-cool-gray-900/60 p-4 rounded-xl border border-cool-gray-800/80">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-cool-gray-300">Playground Status:</span>
                          {state.isDemoMode ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cool-gray-800 text-cool-gray-400 border border-cool-gray-700 uppercase tracking-wide">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-cool-gray-450 leading-normal font-medium">
                          {state.isDemoMode 
                            ? "Currently running inside the safe sandbox. Your pristine live database is paused." 
                            : "Currently running on the live database. Create a sandbox to play safely."}
                        </p>
                      </div>

                      <div className="flex-shrink-0 w-full sm:w-auto">
                        {state.isDemoMode ? (
                          <div className="space-y-2">
                            {!showDemoEndConfirm ? (
                              <button
                                type="button"
                                onClick={() => setShowDemoEndConfirm(true)}
                                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-cool-gray-950 font-bold px-4 py-2 rounded-lg text-xs transition duration-150 shadow focus:outline-none cursor-pointer"
                              >
                                Exit Demo Sandbox
                              </button>
                            ) : (
                              <div className="p-2 bg-amber-950/45 rounded-lg border border-amber-500/20 text-center space-y-2 max-w-[240px]">
                                <p className="text-[10px] text-amber-300 leading-relaxed font-bold">
                                  Are you sure? This will permanently discard all sandbox changes.
                                </p>
                                <div className="flex gap-2 justify-center">
                                  <button
                                    type="button"
                                    disabled={isDemoActionLoading}
                                    onClick={handleEndDemoAction}
                                    className="bg-red-600 hover:bg-red-500 text-white font-extrabold px-2.5 py-1 rounded-md text-[10px] transition cursor-pointer"
                                  >
                                    {isDemoActionLoading ? 'Exiting...' : 'Yes, Discard'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDemoActionLoading}
                                    onClick={() => setShowDemoEndConfirm(false)}
                                    className="bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-bold px-2.5 py-1 rounded-md text-[10px] transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {!showDemoStartConfirm ? (
                              <button
                                type="button"
                                onClick={() => setShowDemoStartConfirm(true)}
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition duration-150 shadow focus:outline-none cursor-pointer"
                              >
                                Launch Demo Sandbox
                              </button>
                            ) : (
                              <div className="p-3 bg-indigo-950/45 rounded-lg border border-indigo-500/20 text-center space-y-2 max-w-[240px]">
                                <p className="text-[10px] text-indigo-300 leading-relaxed font-bold">
                                  Duplicate live database into a safe playground?
                                </p>
                                <div className="flex gap-2 justify-center">
                                  <button
                                    type="button"
                                    disabled={isDemoActionLoading}
                                    onClick={handleStartDemoAction}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-2.5 py-1 rounded-md text-[10px] transition cursor-pointer"
                                  >
                                    {isDemoActionLoading ? 'Spawning...' : 'Yes, Enter'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDemoActionLoading}
                                    onClick={() => setShowDemoStartConfirm(false)}
                                    className="bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-bold px-2.5 py-1 rounded-md text-[10px] transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-cool-gray-850 rounded-xl border border-cool-gray-750 p-5 space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-cool-gray-100 mb-1 flex items-center gap-2">
                      Application Preferences &amp; Diagnostics
                    </h3>
                    <p className="text-xs text-cool-gray-400 font-medium">
                      Check system update status, manage Cloudflare token re-authentication, or jump to shared Off-Site settings.
                    </p>
                  </div>

                  {/* Quick shortcut to Off-Site Settings */}
                  <div className="border-t border-cool-gray-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-cool-gray-200 block">
                        Off-Site Shipper &amp; Simulated Box Weight
                      </span>
                      <p className="text-[11px] text-cool-gray-400 mt-0.5 leading-relaxed">
                        Default Movement Report Shipper address and simulated box weight now live in Operations → Off-Site Settings for all team members.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchTab("offsite_settings")}
                      className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 border border-cool-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      Open Off-Site Settings ➔
                    </button>
                  </div>

                  {/* System Version & Update Status */}
                  <div className="border-t border-cool-gray-750/50 pt-4 space-y-3">
                    <span className="text-xs font-bold text-cool-gray-300 block uppercase tracking-wider">
                      Application Version &amp; Update Status
                    </span>
                    <div className="bg-cool-gray-900/80 p-3.5 rounded-xl border border-cool-gray-800 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-cool-gray-400 font-medium">Current Installed Version:</span>
                          <span className="text-cool-gray-100 font-mono font-bold">v{APP_VERSION}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-cool-gray-400 font-medium">Server Status:</span>
                          {serverVersionStatus === 'checking' && (
                            <span className="text-cool-gray-400 font-medium">Checking server...</span>
                          )}
                          {serverVersionStatus === 'connected' && (
                            <span className="text-emerald-400 font-medium">Connected (v{serverVersion || APP_VERSION} · Up to date)</span>
                          )}
                          {serverVersionStatus === 'mismatch' && (
                            <span className="text-amber-400 font-medium">Server running v{serverVersion} (Update pending)</span>
                          )}
                          {serverVersionStatus === 'offline' && (
                            <span className="text-sky-400 font-medium">Offline (Using cached shell)</span>
                          )}
                        </div>
                      </div>

                      {updateMessage && (
                        <div className="text-[11px] font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1.5 rounded-lg animate-fade-in">
                          {updateMessage}
                        </div>
                      )}

                      {/* Per-Device Automatic PWA Updates Info */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-cool-gray-800">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-cool-gray-200">Automatic PWA Updates &amp; Cache Refresh</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Auto by Default
                            </span>
                          </div>
                          <p className="text-[11px] text-cool-gray-400 leading-relaxed font-medium">
                            All devices automatically refresh caches and apply releases when idle by default. Admins can switch individual devices to Manual under <strong className="text-cool-gray-200">Users &amp; Devices</strong>.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSwitchTab("users_devices")}
                          className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 border border-cool-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0"
                        >
                          Manage Per Device ➔
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-cool-gray-800 text-[11px] text-cool-gray-450">
                        <span>Query the server to verify your installed PWA shell is current and trigger background update checks.</span>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={handleForceCheckAndUpdate}
                            disabled={isCheckingUpdate}
                            className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-200 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                          </button>
                          <button
                            type="button"
                            onClick={handlePurgeCacheAndReload}
                            disabled={isCheckingUpdate}
                            className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-cool-gray-100 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                            title="Force clear Service Worker caches and reload page directly from server"
                          >
                            Force Refresh Cache
                          </button>
                          {serverVersionStatus === 'mismatch' && (
                            <button
                              type="button"
                              onClick={() => window.location.reload()}
                              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                              Reload to Apply
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cloudflare Access & Security Token Helper */}
                  <div className="border-t border-cool-gray-750/50 pt-4 space-y-3">
                    <CloudflareTokenHelperCard
                      enabled={cfTokenRefreshEnabled}
                      onToggle={handleToggleCfTokenRefresh}
                    />
                  </div>

                  <div className="border-t border-cool-gray-750/40 pt-5 text-xs text-cool-gray-450 leading-relaxed font-semibold">
                    <p>
                      🔒 Application preferences are stored in your SQLite database (<code className="text-cyan-400 text-[11px] font-mono">app_config</code>) and mirrored in local cache, persisting across devices, reloads, and container restarts.
                    </p>
                  </div>
                </div>
            </div>
          </div>
        );
      }
      case "lists":
        return (
          <ManageLists
            state={state}
            dispatch={dispatch}
            offSiteQuantityMap={offSiteQuantityMap}
            offSiteWeightMap={offSiteWeightMap}
            mode={listsViewMode}
            onModeChange={setListsViewMode}
            hideInternalHeader
            createRequestCount={listCreateTrigger}
            onStepChange={setActiveListItemView}
            onNavigateToNotifications={() => handleSwitchTab("notifications")}
          />
        );
      case "notifications":
        if (!authLoaded) {
          return (
            <div className="bg-cool-gray-850 border border-cool-gray-750 rounded-xl p-8 text-center text-cool-gray-400 text-xs">
              Verifying administrator permissions...
            </div>
          );
        }
        if (isAdminGated) {
          return (
            <div className="max-w-xl mx-auto bg-cool-gray-850 border border-amber-500/40 rounded-2xl p-6 text-center space-y-4 shadow-xl animate-fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Shield className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-white">Administrator Access Required</h3>
                <p className="text-xs text-cool-gray-300 leading-relaxed">
                  Notification channels, gateways, and schedules are restricted to administrators. Sign in with an administrator PIN to continue.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => openAccountModal('signin')}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Sign In as Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTab("products")}
                  className="px-4 py-2 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-300 text-xs font-bold transition cursor-pointer"
                >
                  Return to Catalog
                </button>
              </div>
            </div>
          );
        }
        return (
          <NotificationCenterPanel
            state={state}
            dispatch={dispatch}
            activeSubTab={notificationsSubTab}
            onSubTabChange={setNotificationsSubTab}
            hideInternalHeader
            createChannelRequestCount={channelCreateTrigger}
          />
        );
      case "tags":
        return (
          <ManageTags
            state={state}
            dispatch={dispatch}
            hideInternalHeader
            createRequestCount={tagCreateTrigger}
            onStepChange={setActiveTagDetailView}
          />
        );
      case "locations":
        return (
          <ManageLocations
            state={state}
            dispatch={dispatch}
            hideInternalHeader
            createRequestCount={locationCreateTrigger}
          />
        );
      case "photos":
        return (
          <PhotoManagerView
            state={state}
            dispatch={dispatch}
            onRefreshState={onRefreshState}
            activeSubTab={photosSubTab}
            onSubTabChange={setPhotosSubTab}
            hideInternalHeader
          />
        );
      case "import":
        if (!authLoaded) {
          return (
            <div className="bg-cool-gray-850 border border-cool-gray-750 rounded-xl p-8 text-center text-cool-gray-400 text-xs">
              Verifying administrator permissions...
            </div>
          );
        }
        if (isAdminGated) {
          return (
            <div className="max-w-xl mx-auto bg-cool-gray-850 border border-amber-500/40 rounded-2xl p-6 text-center space-y-4 shadow-xl animate-fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Shield className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-white">Administrator Access Required</h3>
                <p className="text-xs text-cool-gray-300 leading-relaxed">
                  Data Import &amp; Backup management is restricted to administrators. Sign in with an administrator PIN to continue.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => openAccountModal('signin')}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Sign In as Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTab("products")}
                  className="px-4 py-2 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-300 text-xs font-bold transition cursor-pointer"
                >
                  Return to Catalog
                </button>
              </div>
            </div>
          );
        }
        return (
          <DataImportView
            state={state}
            dispatch={dispatch}
            activeSubTab={importSubTab}
            onSubTabChange={setImportSubTab}
            hideInternalHeader
            onNavigateToView={(view) => {
              if (onNavigateToView) {
                onNavigateToView(view);
              } else {
                handleSwitchTab("products");
              }
            }}
          />
        );
      case "voice_dictionary":
        return (
          <div className="max-w-4xl font-sans">
            <VoiceDictionaryManager
              state={state}
              dispatch={dispatch}
              onSaveAppConfigKey={saveAppConfigKey}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const visibleGroups = useMemo(
    () => getVisibleLibraryGroups(isAdminGated),
    [isAdminGated],
  );
  const currentSectionMeta = useMemo(
    () => getLibrarySectionMeta(activeTab),
    [activeTab],
  );
  const currentGroupLabel = useMemo(
    () => visibleGroups.find((g) => g.group.id === currentSectionMeta.groupId)?.group.label || 'Catalog',
    [visibleGroups, currentSectionMeta.groupId],
  );

  const renderSectionNavIcon = (id: LibrarySectionMeta['id']) => {
    switch (id) {
      case 'products': return <Package className="w-4 h-4 shrink-0" />;
      case 'species_primals': return <Beef className="w-4 h-4 shrink-0" />;
      case 'containers': return <Layers className="w-4 h-4 shrink-0" />;
      case 'freezers': return <Snowflake className="w-4 h-4 shrink-0" />;
      case 'lists': return <ClipboardList className="w-4 h-4 shrink-0" />;
      case 'tags': return <TagIcon className="w-4 h-4 shrink-0" />;
      case 'locations': return <MapPin className="w-4 h-4 shrink-0" />;
      case 'photos': return <Images className="w-4 h-4 shrink-0" />;
      case 'offsite_settings': return <Truck className="w-4 h-4 shrink-0" />;
      case 'butcher_settings': return <Scale className="w-4 h-4 shrink-0" />;
      case 'voice_dictionary': return <Mic className="w-4 h-4 shrink-0" />;
      case 'import': return <Database className="w-4 h-4 shrink-0" />;
      case 'users_devices': return <Users className="w-4 h-4 shrink-0" />;
      case 'notifications': return <Bell className="w-4 h-4 shrink-0" />;
      case 'settings': return <Settings className="w-4 h-4 shrink-0" />;
    }
  };

  const activeProductsCount = (state.products || []).filter((p) => !p.isArchived).length;
  const archivedProductsCount = (state.products || []).filter((p) => p.isArchived).length;
  const containerTemplatesCount = (state.containerTemplates || []).length;
  const activeContainersCount = (state.containers || []).filter(
    (c) => c.id !== "staging_loose" && !c.id.endsWith("_loose") && !c.isArchived,
  ).length;
  const normalizedActiveTab = normalizeLibraryTab(activeTab);

  return (
    <div className="bg-cool-gray-800/40 p-3 sm:p-5 rounded-xl border border-cool-gray-750 animate-fade-in relative font-sans">
      {/* Mobile (< lg) Sticky Active Section Header & Slide-Down Grouped Drawer */}
      <div className="lg:hidden mb-4">
        <div className="flex items-center justify-between gap-2 bg-cool-gray-850 border border-cool-gray-750 rounded-xl px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-cyan-400 shrink-0">{renderSectionNavIcon(currentSectionMeta.id)}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 truncate">
                {currentGroupLabel}
              </div>
              <div className="text-sm font-bold text-white truncate">
                {currentSectionMeta.label}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-expanded={mobileNavOpen}
            aria-label="Toggle Catalog and Settings sections"
            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-xs font-bold text-cool-gray-100 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Menu className="w-4 h-4 text-cyan-400" />
            <span>Sections</span>
            <ChevronDown className={`w-3.5 h-3.5 text-cool-gray-400 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {mobileNavOpen && (
          <div
            className="mt-2 p-3 bg-cool-gray-900 border border-cool-gray-750 rounded-xl space-y-4 shadow-xl animate-fade-in"
            role="navigation"
            aria-label="Catalog and Settings sections"
          >
            {visibleGroups.map(({ group, sections }) => (
              <div key={group.id} className="space-y-1">
                <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-cool-gray-400">
                  {group.label}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {sections.map((section) => {
                    const isActive = normalizedActiveTab === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => handleSwitchTab(section.id)}
                        className={`min-h-[44px] w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 text-left transition cursor-pointer ${
                          isActive
                            ? 'bg-cyan-950/60 text-cyan-200 border border-cyan-500/40 font-bold'
                            : 'text-cool-gray-300 hover:text-white hover:bg-cool-gray-850 border border-transparent'
                        }`}
                      >
                        <span className={isActive ? 'text-cyan-400' : 'text-cool-gray-400'}>
                          {renderSectionNavIcon(section.id)}
                        </span>
                        <span className="truncate">{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop (lg+) Grouped Sidebar + Content Column Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        <aside
          className="hidden lg:block w-60 shrink-0 bg-cool-gray-850/90 border border-cool-gray-750 rounded-xl p-3 space-y-5 sticky top-4"
          aria-label="Catalog and Settings navigation"
        >
          {visibleGroups.map(({ group, sections }) => (
            <div key={group.id} className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-cool-gray-400">
                {group.label}
              </div>
              {sections.map((section) => {
                const isActive = normalizedActiveTab === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSwitchTab(section.id)}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 text-left transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-cyan-950/55 text-cyan-200 border border-cyan-500/40 font-bold'
                        : 'text-cool-gray-300 hover:text-white hover:bg-cool-gray-800/70 border border-transparent'
                    }`}
                  >
                    <span className={isActive ? 'text-cyan-400' : 'text-cool-gray-400'}>
                      {renderSectionNavIcon(section.id)}
                    </span>
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Active Section Workspace */}
        <main className="flex-1 min-w-0 w-full space-y-5">
          {/* Uniform Section Header */}
          <header className="pb-4 border-b border-cool-gray-750 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-cyan-400">{renderSectionNavIcon(currentSectionMeta.id)}</span>
                  <span className="truncate">{currentSectionMeta.label}</span>
                </h2>
                <p className="text-xs text-cool-gray-400 mt-0.5 leading-relaxed">
                  {currentSectionMeta.description}
                </p>
              </div>

              {/* Section Primary Controls (Primary CTA) */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 select-none">

                {normalizedActiveTab === "products" && !showAddForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition whitespace-nowrap cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Add Product
                  </button>
                )}

                {normalizedActiveTab === "containers" && containerSubTab === "templates" && (
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateNameInput('');
                      setTemplateImageInput('');
                      setShowAddTemplateModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition whitespace-nowrap cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Add Template
                  </button>
                )}

                {normalizedActiveTab === "containers" && containerSubTab === "active" && (
                  <button
                    type="button"
                    onClick={() => openModal({ type: "ADD_CONTAINER" })}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition whitespace-nowrap cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Container
                  </button>
                )}

                {normalizedActiveTab === "lists" && listsViewMode === "overview" && !activeListItemView && (
                  <button
                    type="button"
                    onClick={() => setListCreateTrigger((n) => n + 1)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition whitespace-nowrap cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Create List
                  </button>
                )}

                {normalizedActiveTab === "tags" && !activeTagDetailView && (
                  <button
                    type="button"
                    onClick={() => setTagCreateTrigger((n) => n + 1)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition whitespace-nowrap cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Create Tag
                  </button>
                )}

                {normalizedActiveTab === "locations" && (
                  <button
                    type="button"
                    onClick={() => setLocationCreateTrigger((n) => n + 1)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition whitespace-nowrap cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Add Location
                  </button>
                )}

                {normalizedActiveTab === "import" && !isAdminGated && (
                  <button
                    type="button"
                    onClick={() => onNavigateToView ? onNavigateToView('freezer') : handleSwitchTab('products')}
                    className="px-3.5 py-2 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold transition whitespace-nowrap cursor-pointer"
                  >
                    Back to Freezer Map
                  </button>
                )}

                {normalizedActiveTab === "notifications" && !isAdminGated && notificationsSubTab === "channels" && (
                  <button
                    type="button"
                    onClick={() => setChannelCreateTrigger((n) => n + 1)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition whitespace-nowrap cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Add Channel
                  </button>
                )}
              </div>
            </div>

            {/* Unified Segmented Mode Switcher for multi-mode sections */}
            {normalizedActiveTab === "products" && (
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
                <button
                  type="button"
                  onClick={() => setProductArchiveFilter('active')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer tabular-nums ${
                    productArchiveFilter === 'active'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Active Catalog ({activeProductsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setProductArchiveFilter('archived')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer tabular-nums flex items-center gap-1.5 ${
                    productArchiveFilter === 'archived'
                      ? 'bg-amber-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  <span>Archived</span>
                  {archivedProductsCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      productArchiveFilter === 'archived'
                        ? 'bg-amber-950/60 text-white border border-amber-400/30'
                        : 'bg-amber-950/70 text-amber-300 border border-amber-800/70'
                    }`}>
                      {archivedProductsCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setProductArchiveFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer tabular-nums ${
                    productArchiveFilter === 'all'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Show All ({(state.products || []).length})
                </button>
              </div>
            )}

            {normalizedActiveTab === "containers" && (
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
                <button
                  type="button"
                  onClick={() => setContainerSubTab('templates')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer tabular-nums ${
                    containerSubTab === 'templates'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Templates ({containerTemplatesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setContainerSubTab('active')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer tabular-nums ${
                    containerSubTab === 'active'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Active Containers ({activeContainersCount})
                </button>
              </div>
            )}

            {normalizedActiveTab === "lists" && (
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
                <button
                  type="button"
                  onClick={() => setListsViewMode('overview')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer tabular-nums ${
                    listsViewMode === 'overview'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Lists Overview ({(state.customLists || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => setListsViewMode('matrix')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer ${
                    listsViewMode === 'matrix'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Bulk Matrix
                </button>
              </div>
            )}

            {normalizedActiveTab === "notifications" && !isAdminGated && (
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
                <button
                  type="button"
                  onClick={() => setNotificationsSubTab('channels')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer tabular-nums ${
                    notificationsSubTab === 'channels'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Channels ({(state.notificationChannels || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsSubTab('schedules')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer ${
                    notificationsSubTab === 'schedules'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Digest &amp; Schedules
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsSubTab('logs')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer tabular-nums ${
                    notificationsSubTab === 'logs'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Delivery Logs ({(state.notificationLogs || []).length})
                </button>
              </div>
            )}

            {normalizedActiveTab === "photos" && (
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPhotosSubTab('library')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer ${
                    photosSubTab === 'library'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Photo Files
                </button>
                <button
                  type="button"
                  onClick={() => setPhotosSubTab('missing')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer ${
                    photosSubTab === 'missing'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Missing Photos
                </button>
              </div>
            )}

            {normalizedActiveTab === "import" && !isAdminGated && (
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
                <button
                  type="button"
                  onClick={() => setImportSubTab('backup')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer ${
                    importSubTab === 'backup'
                      ? 'bg-cyan-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Snapshots &amp; Backups
                </button>
                <button
                  type="button"
                  onClick={() => setImportSubTab('wipe')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer ${
                    importSubTab === 'wipe'
                      ? 'bg-rose-600 text-white'
                      : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                  }`}
                >
                  Reset Database
                </button>
              </div>
            )}
          </header>

          {renderContent()}
        </main>
      </div>

      {/* Sub-modals inside LibraryView */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-md p-6 bg-cool-gray-800 border border-cool-gray-700 rounded-lg shadow-xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-bold text-red-400 mb-2">
              Confirm Delete Category
            </h4>
            <div className="space-y-3 text-cool-gray-300 text-sm">
              <p>
                Are you sure you want to permanently delete the{" "}
                {confirmDelete.type === "primary" ? "primary" : "sub"} category{" "}
                <span className="font-semibold text-white">
                  "{confirmDelete.name}"
                </span>
                ?
              </p>
              {confirmDelete.count > 0 ? (
                <p className="p-3 bg-red-955/40 border border-red-900/60 rounded text-red-200 text-xs">
                  <strong>WARNING:</strong> Deleting this category will
                  permanently delete all{" "}
                  <strong className="text-white">{confirmDelete.count}</strong>{" "}
                  products inside it, along with all of their inventory records!
                  This cannot be undone.
                </p>
              ) : (
                <p className="text-xs text-cool-gray-400">
                  This category is currently empty. Deleting it will remove it
                  from the system.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-cool-gray-705 hover:bg-cool-gray-650 text-white block text-sm font-semibold rounded-lg transition border-none outline-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  dispatch({
                    type: "DELETE_CATEGORY",
                    payload: {
                      name: confirmDelete.name,
                      type: confirmDelete.type,
                      parentPrimary: confirmDelete.parentPrimary,
                    },
                  });
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 bg-red-650 hover:bg-red-550 text-white block text-sm font-semibold rounded-lg transition border-none outline-none cursor-pointer"
              >
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {bulkModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans animate-fade-in"
          onClick={() => setBulkModalOpen(false)}
        >
          <div
            className="w-full max-w-lg p-6 bg-cool-gray-800 border border-cool-gray-700 rounded-xl shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-cool-gray-750 mb-4">
              <h4 className="text-base font-bold text-cyan-400 flex items-center gap-2">
                ✏️ Bulk Edit Selected Properties
              </h4>
              <button
                onClick={() => setBulkModalOpen(false)}
                className="text-cool-gray-450 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-cool-gray-400 mb-4">
              You are about to edit{" "}
              <span className="font-extrabold text-cyan-300">
                {selectedCount} selected container
                {selectedCount === 1 ? "" : "s"}
              </span>
              . Leave options as is if you do not wish to modify them in bulk.
            </p>

            <div className="space-y-4">
              {/* Retire when empty */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-cool-gray-300">
                  Retire / Delete when Empty Rule
                </label>
                <select
                  value={bulkDeleteOnEmpty}
                  onChange={(e: any) => setBulkDeleteOnEmpty(e.target.value)}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-sans"
                >
                  <option value="no_change">Do Not Change</option>
                  <option value="retire">
                    🗑️ Retire/Delete on Empty (True)
                  </option>
                  <option value="keep">
                    ♻️ Keep Empty / Add to spare pool (False)
                  </option>
                </select>
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-cool-gray-750">
              <button
                onClick={() => setBulkModalOpen(false)}
                className="px-3.5 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const updates: Partial<Container> = {};
                  if (bulkDeleteOnEmpty === "retire")
                    updates.deleteOnEmpty = true;
                  if (bulkDeleteOnEmpty === "keep")
                    updates.deleteOnEmpty = false;

                  if (Object.keys(updates).length > 0) {
                    actualSelectedIds.forEach((id) => {
                      dispatch({
                        type: "EDIT_CONTAINER",
                        payload: { containerId: id, updates },
                      });
                    });
                  }
                  setBulkModalOpen(false);
                }}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Apply Changes to {selectedCount} Container
                {selectedCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-sans"
          onClick={() => setShowBulkDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-md p-6 bg-cool-gray-800 border border-cool-gray-700 rounded-xl shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
              ⚠️ Confirm Bulk Container Deletion
            </h4>
            <div className="space-y-3 text-cool-gray-300 text-sm">
              <p>
                Are you sure you want to permanently delete{" "}
                <span className="font-extrabold text-white">
                  "{selectedCount}"
                </span>{" "}
                selected container(s)?
              </p>

              <p className="p-3 bg-red-955/40 border border-red-900/60 rounded text-red-200 text-xs leading-normal">
                <strong>CRITICAL WARNING:</strong> Deleting these containers
                will permanently erase ALL associated meat cuts and inventory
                contents inside them! This action is irreversible and cannot be
                undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-cool-gray-750">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-3.5 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-white rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  actualSelectedIds.forEach((id) => {
                    dispatch({
                      type: "DELETE_CONTAINER",
                      payload: { containerId: id },
                    });
                  });
                  setSelectedContainers({});
                  setShowBulkDeleteConfirm(false);
                }}
                className="px-4 py-1.5 bg-red-650 hover:bg-red-550 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Yes, Delete {selectedCount} Container
                {selectedCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky/Floating Product Bulk Actions Tray */}
      {activeTab === "products" && selectedProductsCount > 0 && (
        <div className="sticky bottom-4 left-0 right-0 z-40 p-4 bg-cool-gray-850 border border-cyan-500/50 rounded-xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up mt-6 select-none" id="product-bulk-actions-panel">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-black">
              {selectedProductsCount}
            </span>
            <span className="text-sm font-semibold text-cool-gray-250 dark:text-cool-gray-200">
              product{selectedProductsCount === 1 ? "" : "s"} selected in catalog
            </span>
            <button
              type="button"
              onClick={handleProductDeselectAll}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold transition ml-1 cursor-pointer bg-transparent border-none outline-none"
            >
              Deselect All
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                setBulkProductPrimary("");
                setBulkProductSub("");
                setBulkProductPrimal(BULK_PRIMAL_NO_CHANGE);
                setIsProductBulkEditOpen(true);
              }}
              className="text-xs px-3 py-2 bg-emerald-105 hover:bg-emerald-250 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/40 rounded-lg transition-all font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Assign categories, primal cut, or default tags to selected products"
            >
              ✏️ Bulk Edit Properties
            </button>

            <button
              type="button"
              onClick={() => setIsProductBulkDeleteOpen(true)}
              className="text-xs px-3 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg transition-all font-black flex items-center gap-1.5 shadow-md border border-rose-600 dark:border-rose-800 cursor-pointer"
              title="Permanently delete matching products and items"
            >
              🗑️ Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Product Bulk Categorization Dialog */}
      {isProductBulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-cool-gray-850 border border-cool-gray-750/70 p-6 rounded-2xl max-w-md w-full shadow-2xl animate-scale-up text-left">
            <div className="flex items-center justify-between mb-4 border-b border-cool-gray-700 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                ✏️ Bulk Edit Product Properties
              </h3>
              <button 
                type="button"
                onClick={handleProductBulkCancel}
                className="text-cool-gray-400 hover:text-white font-bold text-sm cursor-pointer bg-transparent border-none outline-none"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-cool-gray-300 mb-4 leading-normal">
              Updating <strong>{selectedProductsCount}</strong> selected product{selectedProductsCount === 1 ? '' : 's'}. Feel free to change primary/secondary categories or default tags. Leaving a field blank or unchecked will keep its original value unchanged.
            </p>

            <div className="space-y-4 font-sans text-xs">
              {/* Primary Category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-cool-gray-300">
                  Primary Category
                </label>
                <div className="flex gap-2">
                  <select
                    value={bulkProductPrimary}
                    onChange={(e) => setBulkProductPrimary(e.target.value)}
                    className="bg-cool-gray-905 text-cool-gray-100 text-xs rounded-lg border border-cool-gray-700 p-2 flex-1 focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                  >
                    <option value="">-- Dropdown Match --</option>
                    {uniquePrimaryCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or type custom..."
                    value={bulkProductPrimary}
                    onChange={(e) => setBulkProductPrimary(e.target.value)}
                    className="bg-cool-gray-905 text-cool-gray-100 text-xs rounded-lg border border-cool-gray-700 px-3 py-2 w-1/2 focus:ring-1 focus:ring-cyan-500 outline-none animate-fade-in"
                  />
                </div>
              </div>

              {/* Sub Category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-cool-gray-300">
                  Subcategory (Secondary)
                </label>
                <div className="flex gap-2">
                  <select
                    value={bulkProductSub}
                    onChange={(e) => setBulkProductSub(e.target.value)}
                    className="bg-cool-gray-905 text-cool-gray-100 text-xs rounded-lg border border-cool-gray-700 p-2 flex-1 focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                  >
                    <option value="">-- Dropdown Match --</option>
                    {uniqueSubCategories.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or type custom..."
                    value={bulkProductSub}
                    onChange={(e) => setBulkProductSub(e.target.value)}
                    className="bg-cool-gray-905 text-cool-gray-100 text-xs rounded-lg border border-cool-gray-700 px-3 py-2 w-1/2 focus:ring-1 focus:ring-cyan-500 outline-none animate-fade-in"
                  />
                </div>
              </div>

              {/* Primal Cut Assignment */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-cool-gray-300">
                  Primal Cut
                </label>
                <PrimalSelect
                  speciesPrimals={state.speciesPrimals}
                  value={bulkProductPrimal}
                  onChange={setBulkProductPrimal}
                  bulkMode
                  className="w-full bg-cool-gray-905 text-cool-gray-100 text-xs rounded-lg border border-cool-gray-700 p-2 focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                />
              </div>

              {/* Default Tags Modification Section */}
              <div className="space-y-2 border-t border-cool-gray-700/50 pt-3 mt-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="bulk-modify-tags-checkbox"
                    checked={bulkModifyTags}
                    onChange={(e) => setBulkModifyTags(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-cool-gray-905 border-cool-gray-700 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="bulk-modify-tags-checkbox" className="text-xs font-bold text-cool-gray-200 cursor-pointer select-none">
                    Modify Default Tags
                  </label>
                </div>

                {bulkModifyTags && (
                  <div className="space-y-3 pl-6 animate-fade-in">
                    {/* Method Selecting */}
                    <div className="space-y-1">
                      <span className="block text-[11px] font-semibold text-cool-gray-400">Tag Apply Action:</span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-cool-gray-305 cursor-pointer">
                          <input
                            type="radio"
                            name="bulk-tag-mode"
                            value="append"
                            checked={bulkDefaultTagsMode === 'append'}
                            onChange={() => setBulkDefaultTagsMode('append')}
                            className="bg-cool-gray-905 border-cool-gray-700 text-cyan-500 focus:ring-0 cursor-pointer"
                          />
                          <span>Append new tags</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-cool-gray-305 cursor-pointer">
                          <input
                            type="radio"
                            name="bulk-tag-mode"
                            value="replace"
                            checked={bulkDefaultTagsMode === 'replace'}
                            onChange={() => setBulkDefaultTagsMode('replace')}
                            className="bg-cool-gray-905 border-cool-gray-700 text-cyan-500 focus:ring-0 cursor-pointer"
                          />
                          <span>Replace all tags</span>
                        </label>
                      </div>
                    </div>

                    {/* Tag Checklist buttons */}
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-semibold text-cool-gray-400">Select Default Tags:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(state?.tags || []).map(tag => {
                          const isSelected = bulkDefaultTagIds.includes(tag.id);
                          return (
                            <button
                              type="button"
                              key={tag.id}
                              onClick={() => {
                                setBulkDefaultTagIds(prev => 
                                  prev.includes(tag.id)
                                    ? prev.filter(id => id !== tag.id)
                                    : [...prev, tag.id]
                                );
                              }}
                              style={{
                                borderColor: tag.color || '#3b82f6', 
                                backgroundColor: isSelected ? (tag.color ? `${tag.color}35` : '#3b82f635') : 'transparent',
                                color: tag.color || '#3b82f6'
                              }}
                              className="text-[10px] uppercase font-bold py-1 px-2.5 rounded-full border transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                            >
                              <span>{getTagActionIcon(tag)}</span>
                              <span>{tag.name}</span>
                            </button>
                          );
                        })}
                        {(state?.tags || []).length === 0 && (
                          <p className="text-[11px] text-cool-gray-500">No tags configured. Go to Tags tab to create.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 border-t border-cool-gray-700 pt-4">
              <button
                type="button"
                onClick={handleProductBulkCancel}
                className="px-4 py-2 bg-cool-gray-805 hover:bg-cool-gray-750 text-cool-gray-300 border border-cool-gray-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProductBulkEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition cursor-pointer shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Bulk Delete Confirmation Dialog */}
      {isProductBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-cool-gray-850 border border-red-500/20 p-6 rounded-2xl max-w-md w-full shadow-2xl animate-scale-up text-left">
            <div className="flex items-center justify-between mb-4 border-b border-cool-gray-700 pb-3">
              <h3 className="text-base font-black text-rose-500 flex items-center gap-2">
                ⚠️ Bulk Delete Products
              </h3>
              <button 
                type="button"
                onClick={() => setIsProductBulkDeleteOpen(false)}
                className="text-cool-gray-400 hover:text-white font-bold text-sm cursor-pointer bg-transparent border-none outline-none"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-cool-gray-300 leading-relaxed mb-4">
              Are you absolutely sure you want to permanently delete the <strong>{selectedProductsCount}</strong> selected product{selectedProductsCount === 1 ? '' : 's'}?
            </p>
            
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-rose-300 text-[11px] font-medium leading-normal mb-5 space-y-1">
              <p>🚨 This is irreversible.</p>
              <p>🚨 All matching product entries, list dependencies, and physical container item cuts will be deleted too.</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-cool-gray-700 pt-4">
              <button
                type="button"
                onClick={() => setIsProductBulkDeleteOpen(false)}
                className="px-4 py-2 bg-cool-gray-805 hover:bg-cool-gray-750 text-cool-gray-300 border border-cool-gray-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProductBulkDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-lg transition cursor-pointer shadow-md"
              >
                Yes, Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Container Template Modal */}
      {showAddTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-cool-gray-850 border border-cool-gray-700 p-6 rounded-2xl max-w-md w-full shadow-2xl animate-scale-up text-left space-y-4">
            <div className="flex items-center justify-between border-b border-cool-gray-750 pb-3">
              <h3 className="text-base font-bold text-cyan-400 flex items-center gap-2">
                📋 Add Container Template to Catalog
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddTemplateModal(false)}
                className="text-cool-gray-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                  Template Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Purple Basket, Meat Toter, 1/2 Sheet Pan, Zip Bag"
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-2">
                  Photo / Image (Optional)
                </label>
                <MediaSelector
                  imageUrl={templateImageInput}
                  onChange={setTemplateImageInput}
                  placeholder="Image URL or capture"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => setShowAddTemplateModal(false)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-300 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!templateNameInput.trim()}
                onClick={() => {
                  if (templateNameInput.trim()) {
                    dispatch({
                      type: 'ADD_CONTAINER_TEMPLATE',
                      payload: {
                        name: templateNameInput.trim(),
                        imageUrl: templateImageInput.trim() || undefined
                      }
                    });
                    setShowAddTemplateModal(false);
                    setTemplateNameInput('');
                    setTemplateImageInput('');
                  }
                }}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-black rounded-lg transition cursor-pointer shadow-md"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Container Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-cool-gray-850 border border-cool-gray-700 p-6 rounded-2xl max-w-md w-full shadow-2xl animate-scale-up text-left space-y-4">
            <div className="flex items-center justify-between border-b border-cool-gray-750 pb-3">
              <h3 className="text-base font-bold text-cyan-400 flex items-center gap-2">
                ✏️ Edit Container Template
              </h3>
              <button 
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="text-cool-gray-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                  Template Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  value={editingTemplate?.name ?? ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-2">
                  Photo / Image (Optional)
                </label>
                <MediaSelector
                  imageUrl={editingTemplate.imageUrl || ''}
                  onChange={(url) => setEditingTemplate({ ...editingTemplate, imageUrl: url })}
                  placeholder="Image URL or capture"
                />
              </div>
            </div>

            <p className="text-[11px] text-cyan-300/80 bg-cyan-950/40 border border-cyan-800/30 p-2.5 rounded-lg leading-relaxed font-medium">
              💡 Updating this template will automatically update the name/image across all linked active containers in your freezers.
            </p>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => {
                  setTemplateToDelete({ id: editingTemplate.id, name: editingTemplate.name });
                  setEditingTemplate(null);
                }}
                className="px-3 py-2 bg-red-955/50 hover:bg-red-900/70 text-red-300 border border-red-800/50 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Template
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-300 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!editingTemplate.name.trim()}
                  onClick={() => {
                    if (editingTemplate.name.trim()) {
                      dispatch({
                        type: 'EDIT_CONTAINER_TEMPLATE',
                        payload: {
                          id: editingTemplate.id,
                          updates: {
                            name: editingTemplate.name.trim(),
                            imageUrl: editingTemplate.imageUrl?.trim() || undefined
                          }
                        }
                      });
                      setEditingTemplate(null);
                    }
                  }}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-black rounded-lg transition cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Container Template Confirmation Modal */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-cool-gray-850 border border-cool-gray-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-scale-up text-left space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Template?</h3>
            </div>
            <p className="text-xs text-cool-gray-300 leading-relaxed">
              Are you sure you want to delete container template <strong className="text-white">"{templateToDelete.name}"</strong> from catalog? Active containers in freezers will remain intact.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-300 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'DELETE_CONTAINER_TEMPLATE', payload: { id: templateToDelete.id } });
                  setTemplateToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-md"
              >
                Yes, Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export type ListsViewMode = "overview" | "matrix";

export const ManageLists: React.FC<{
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  offSiteQuantityMap?: Record<string, number>;
  offSiteWeightMap?: Record<string, number>;
  mode?: ListsViewMode;
  onModeChange?: (mode: ListsViewMode) => void;
  hideInternalHeader?: boolean;
  createRequestCount?: number;
  onStepChange?: (inDetailStep: boolean) => void;
  onNavigateToNotifications?: () => void;
}> = ({
  state,
  dispatch,
  offSiteQuantityMap = {},
  offSiteWeightMap = {},
  mode,
  onModeChange,
  hideInternalHeader = false,
  createRequestCount = 0,
  onStepChange,
  onNavigateToNotifications,
}) => {
  const customLists = state.customLists || [];
  const configuredChannels = state.notificationChannels || [];
  const [internalMode, setInternalMode] = useState<ListsViewMode>("overview");
  const effectiveMode: ListsViewMode = mode ?? internalMode;
  const setEffectiveMode = (next: ListsViewMode) => {
    if (onModeChange) {
      onModeChange(next);
    } else {
      setInternalMode(next);
    }
  };

  // Two-step Overview (null) -> Item Manager (list id)
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Overview search & condensed filters
  const [listOverviewSearch, setListOverviewSearch] = useState("");
  const [showOverviewFilters, setShowOverviewFilters] = useState(false);
  const [listControlFilter, setListControlFilter] = useState<"all" | "controlled" | "static">("all");
  const [listDigestFilter, setListDigestFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [listOverviewSort, setListOverviewSort] = useState<
    "default" | "name_asc" | "name_desc" | "items_desc" | "items_asc"
  >("default");

  // Configuration Modal fields
  const [isFormVisible, setFormVisible] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [listDesc, setListDesc] = useState("");
  const [allowNotes, setAllowNotes] = useState(true);
  const [isInventoryControlled, setIsInventoryControlled] = useState(false);
  const [controlType, setControlType] = useState<"prompt" | "auto">("prompt");
  const [controlCondition, setControlCondition] = useState<"min" | "max">("min");
  const [listNotificationEnabled, setListNotificationEnabled] = useState(false);
  const [listNotificationType, setListNotificationType] = useState<
    "all_items" | "newly_added_only" | "item_specific" | "threshold_breaches"
  >("all_items");
  const [listChannelIds, setListChannelIds] = useState<string[]>([]);
  const [listRecipientOverride, setListRecipientOverride] = useState("");
  const [listDailyDigestMode, setListDailyDigestMode] = useState<"none" | "combined" | "separate">("combined");
  const [listDigestChannelOverrideEnabled, setListDigestChannelOverrideEnabled] = useState(false);
  const [listDigestChannelIds, setListDigestChannelIds] = useState<string[]>([]);
  const [listCustomSchedEnabled, setListCustomSchedEnabled] = useState(false);
  const [listCustomSchedCadence, setListCustomSchedCadence] = useState<"daily" | "weekly" | "interval">("daily");
  const [listCustomSchedTime, setListCustomSchedTime] = useState("09:00");
  const [listCustomSchedDays, setListCustomSchedDays] = useState<number[]>([1]);
  const [listCustomSchedIntervalHours, setListCustomSchedIntervalHours] = useState<number>(4);
  const [listCustomSchedChannelOverrideEnabled, setListCustomSchedChannelOverrideEnabled] = useState(false);
  const [listCustomSchedChannelIds, setListCustomSchedChannelIds] = useState<string[]>([]);
  const [listImmediateOnItemAdded, setListImmediateOnItemAdded] = useState(false);
  const [listImmediateOnThresholdBreach, setListImmediateOnThresholdBreach] = useState(false);
  const [listImmediateChannelOverrideEnabled, setListImmediateChannelOverrideEnabled] = useState(false);
  const [listImmediateChannelIds, setListImmediateChannelIds] = useState<string[]>([]);

  // Delete confirmation modal
  const [listToDelete, setListToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Product search selector to add item inside Item Manager
  const [addProductId, setAddProductId] = useState("");
  const [addNote, setAddNote] = useState("");

  const activeList = useMemo(
    () => (selectedListId ? customLists.find((cl) => cl.id === selectedListId) || null : null),
    [customLists, selectedListId],
  );

  const filteredOverviewLists = useMemo(() => {
    const q = listOverviewSearch.trim().toLowerCase();
    const filtered = customLists.filter((cl) => {
      if (q) {
        const nameHit = (cl.name || "").toLowerCase().includes(q);
        const descHit = (cl.description || "").toLowerCase().includes(q);
        if (!nameHit && !descHit) return false;
      }
      if (listControlFilter === "controlled" && !cl.isInventoryControlled) return false;
      if (listControlFilter === "static" && cl.isInventoryControlled) return false;
      if (listDigestFilter === "enabled" && !cl.notificationEnabled) return false;
      if (listDigestFilter === "disabled" && cl.notificationEnabled) return false;
      return true;
    });

    if (listOverviewSort === "default") return filtered;

    return [...filtered].sort((a, b) => {
      if (listOverviewSort === "name_asc") {
        return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (listOverviewSort === "name_desc") {
        return (b.name || "").localeCompare(a.name || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (listOverviewSort === "items_desc") {
        return (b.items?.length || 0) - (a.items?.length || 0);
      }
      if (listOverviewSort === "items_asc") {
        return (a.items?.length || 0) - (b.items?.length || 0);
      }
      return 0;
    });
  }, [customLists, listOverviewSearch, listControlFilter, listDigestFilter, listOverviewSort]);

  const activeListOverviewFilterCount =
    (listControlFilter !== "all" ? 1 : 0) +
    (listDigestFilter !== "all" ? 1 : 0) +
    (listOverviewSort !== "default" ? 1 : 0);

  // Clear stale selectedListId if deleted externally
  useEffect(() => {
    if (selectedListId && !activeList) {
      setSelectedListId(null);
    }
  }, [selectedListId, activeList]);

  // Notify parent shell whether Item Manager step is active
  useEffect(() => {
    onStepChange?.(effectiveMode === "overview" && Boolean(activeList));
    return () => {
      onStepChange?.(false);
    };
  }, [effectiveMode, activeList, onStepChange]);

  const resetFormFields = () => {
    const defaultChannels = state.notificationSettings?.[0]?.defaultChannelIds || [];
    setListName("");
    setListDesc("");
    setAllowNotes(true);
    setIsInventoryControlled(false);
    setControlType("prompt");
    setControlCondition("min");
    setListNotificationEnabled(false);
    setListNotificationType("all_items");
    setListChannelIds([...defaultChannels]);
    setListRecipientOverride("");
    setListDailyDigestMode("combined");
    setListDigestChannelOverrideEnabled(false);
    setListDigestChannelIds([]);
    setListCustomSchedEnabled(false);
    setListCustomSchedCadence("daily");
    setListCustomSchedTime("09:00");
    setListCustomSchedDays([1]);
    setListCustomSchedIntervalHours(4);
    setListCustomSchedChannelOverrideEnabled(false);
    setListCustomSchedChannelIds([]);
    setListImmediateOnItemAdded(false);
    setListImmediateOnThresholdBreach(false);
    setListImmediateChannelOverrideEnabled(false);
    setListImmediateChannelIds([]);
    setEditingListId(null);
  };

  const openCreateModal = () => {
    resetFormFields();
    setFormVisible(true);
  };

  // Triggered by parent LibraryView header "+ Create List" button
  const lastCreateCountRef = React.useRef(createRequestCount);
  useEffect(() => {
    if (createRequestCount > lastCreateCountRef.current) {
      lastCreateCountRef.current = createRequestCount;
      openCreateModal();
    }
  }, [createRequestCount]);

  const toggleChannelSelection = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    channelId: string,
  ) => {
    setter((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId],
    );
  };

  const handleCreateOrEditList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;

    const existingList = editingListId
      ? customLists.find((cl) => cl.id === editingListId)
      : undefined;

    const immediateEnabled = Boolean(
      listImmediateOnItemAdded || (isInventoryControlled && listImmediateOnThresholdBreach),
    );
    const notificationImmediatePayload = {
      enabled: immediateEnabled,
      onItemAdded: listImmediateOnItemAdded,
      onThresholdBreach: isInventoryControlled ? listImmediateOnThresholdBreach : false,
      ...(listImmediateChannelOverrideEnabled && listImmediateChannelIds.length > 0
        ? { channelIds: listImmediateChannelIds }
        : {}),
    };

    const notificationCustomSchedulePayload = {
      enabled: listCustomSchedEnabled,
      cadence: listCustomSchedCadence,
      time: listCustomSchedTime || "09:00",
      daysOfWeek: listCustomSchedDays.length > 0 ? listCustomSchedDays : [1],
      intervalHours: Math.max(1, Number(listCustomSchedIntervalHours) || 1),
      ...(listCustomSchedChannelOverrideEnabled && listCustomSchedChannelIds.length > 0
        ? { channelIds: listCustomSchedChannelIds }
        : {}),
      ...(existingList?.notificationCustomSchedule?.lastSentAt
        ? { lastSentAt: existingList.notificationCustomSchedule.lastSentAt }
        : {}),
    };

    const notificationConfigFields = {
      notificationEnabled: listNotificationEnabled,
      notificationType:
        !isInventoryControlled && listNotificationType === "threshold_breaches"
          ? ("all_items" as const)
          : listNotificationType,
      notificationChannelIds: listChannelIds,
      notificationRecipientOverride: listRecipientOverride.trim() || undefined,
      notificationDailyDigestMode: listDailyDigestMode,
      notificationDigestChannelIds:
        listDigestChannelOverrideEnabled && listDigestChannelIds.length > 0
          ? listDigestChannelIds
          : undefined,
      notificationCustomSchedule: notificationCustomSchedulePayload,
      notificationImmediate: notificationImmediatePayload,
    };

    if (editingListId) {
      dispatch({
        type: "EDIT_CUSTOM_LIST",
        payload: {
          listId: editingListId,
          updates: {
            name: listName.trim(),
            description: listDesc.trim(),
            allowNotes,
            isInventoryControlled,
            controlType: isInventoryControlled ? controlType : undefined,
            controlCondition: isInventoryControlled ? controlCondition : undefined,
            ...notificationConfigFields,
          },
        },
      });
    } else {
      dispatch({
        type: "ADD_CUSTOM_LIST",
        payload: {
          name: listName.trim(),
          description: listDesc.trim(),
          allowNotes,
          isInventoryControlled,
          controlType,
          controlCondition,
          ...notificationConfigFields,
        },
      });
    }

    resetFormFields();
    setFormVisible(false);
  };

  const handleEditClick = (cl: CustomList) => {
    setEditingListId(cl.id);
    setListName(cl.name);
    setListDesc(cl.description || "");
    setAllowNotes(cl.allowNotes);
    setIsInventoryControlled(cl.isInventoryControlled);
    setControlType(cl.controlType || "prompt");
    setControlCondition(cl.controlCondition || "min");
    setListNotificationEnabled(!!cl.notificationEnabled);
    setListNotificationType(cl.notificationType || "all_items");

    const defaultChannels = state.notificationSettings?.[0]?.defaultChannelIds || [];
    setListChannelIds(
      Array.isArray(cl.notificationChannelIds) && cl.notificationChannelIds.length > 0
        ? [...cl.notificationChannelIds]
        : cl.notificationEnabled
        ? [...defaultChannels]
        : [],
    );
    setListRecipientOverride(cl.notificationRecipientOverride || "");

    const effectiveDigestMode = cl.notificationEnabled
      ? resolveEffectiveDailyDigestMode(cl)
      : cl.notificationDailyDigestMode || "combined";
    setListDailyDigestMode(effectiveDigestMode);

    const hasDigestOverride =
      Array.isArray(cl.notificationDigestChannelIds) && cl.notificationDigestChannelIds.length > 0;
    setListDigestChannelOverrideEnabled(hasDigestOverride);
    setListDigestChannelIds(hasDigestOverride ? [...cl.notificationDigestChannelIds!] : []);

    const sched = cl.notificationCustomSchedule;
    setListCustomSchedEnabled(Boolean(sched?.enabled));
    setListCustomSchedCadence(sched?.cadence || "daily");
    setListCustomSchedTime(sched?.time || "09:00");
    setListCustomSchedDays(
      Array.isArray(sched?.daysOfWeek) && sched!.daysOfWeek!.length > 0
        ? [...sched!.daysOfWeek!]
        : [1],
    );
    setListCustomSchedIntervalHours(sched?.intervalHours || 4);
    const hasCustomOverride =
      Array.isArray(sched?.channelIds) && sched!.channelIds!.length > 0;
    setListCustomSchedChannelOverrideEnabled(hasCustomOverride);
    setListCustomSchedChannelIds(hasCustomOverride ? [...sched!.channelIds!] : []);

    const imm = cl.notificationImmediate;
    setListImmediateOnItemAdded(Boolean(imm?.enabled && imm?.onItemAdded));
    setListImmediateOnThresholdBreach(Boolean(imm?.enabled && imm?.onThresholdBreach));
    const hasImmOverride = Array.isArray(imm?.channelIds) && imm!.channelIds!.length > 0;
    setListImmediateChannelOverrideEnabled(hasImmOverride);
    setListImmediateChannelIds(hasImmOverride ? [...imm!.channelIds!] : []);

    setFormVisible(true);
  };

  const handleCancelForm = () => {
    resetFormFields();
    setFormVisible(false);
  };

  const handleAddProductToList = () => {
    if (!addProductId || !activeList) return;
    dispatch({
      type: "TOGGLE_PRODUCT_ON_LIST",
      payload: {
        listId: activeList.id,
        productId: addProductId,
        notes: addNote,
        forceState: true,
      },
    });
    setAddProductId("");
    setAddNote("");
  };

  const confirmDeleteList = () => {
    if (!listToDelete) return;
    dispatch({ type: "DELETE_CUSTOM_LIST", payload: { listId: listToDelete.id } });
    if (selectedListId === listToDelete.id) {
      setSelectedListId(null);
    }
    setListToDelete(null);
  };

  const productQuantities = useMemo(() => {
    return state.meatCuts.reduce(
      (acc, mc) => {
        acc[mc.productId] = (acc[mc.productId] || 0) + mc.quantity;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [state.meatCuts]);

  const availableProducts = useMemo(() => {
    if (!activeList) return [];
    const existingOnList = new Set(activeList.items?.map((i) => i.productId) || []);
    return state.products
      .filter((p) => !existingOnList.has(p.id))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
      );
  }, [state.products, activeList]);

  const [listSearch, setListSearch] = useState("");
  const [listCategory, setListCategory] = useState("all");
  const [organizeMode, setOrganizeMode] = useState<"list" | "category">("category");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    state.products.forEach((p) => {
      if (p.primaryCategory) cats.add(p.primaryCategory);
    });
    return Array.from(cats).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [state.products]);

  const filteredListItems = useMemo(() => {
    if (!activeList || !activeList.items) return [];
    return activeList.items.filter((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      if (!prod) return false;
      const matchesSearch =
        prod.name.toLowerCase().includes(listSearch.toLowerCase()) ||
        (prod.subCategory && prod.subCategory.toLowerCase().includes(listSearch.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(listSearch.toLowerCase()));
      const matchesCategory = listCategory === "all" || prod.primaryCategory === listCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeList, state.products, listSearch, listCategory]);

  const groupedFilteredItems = useMemo(() => {
    const groups: Record<string, typeof filteredListItems> = {};
    filteredListItems.forEach((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      const cat = prod?.primaryCategory || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredListItems, state.products]);

  // --- Bulk Matrix Spreadsheet Grid States ---
  const [matrixSearch, setMatrixSearch] = useState("");
  const [showMatrixFilters, setShowMatrixFilters] = useState(false);
  const [matrixCategory, setMatrixCategory] = useState("all");
  const [matrixSubCategory, setMatrixSubCategory] = useState("all");
  const [matrixListFilter, setMatrixListFilter] = useState<string>("all");
  const [matrixMembershipFilter, setMatrixMembershipFilter] = useState<
    "all" | "in_any" | "in_none" | "controlled_only"
  >("all");
  const [matrixSortBy, setMatrixSortBy] = useState<
    "name_asc" | "name_desc" | "category_asc" | "stock_desc"
  >("category_asc");
  const [matrixSelectedProds, setMatrixSelectedProds] = useState<Record<string, boolean>>({});
  const [bulkListTarget, setBulkListTarget] = useState<string>(customLists[0]?.id || "");
  const [bulkActionType, setBulkActionType] = useState<
    "include" | "exclude" | "set_source" | "set_threshold" | "clear_threshold"
  >("include");
  const [bulkControlSourceVal, setBulkControlSourceVal] =
    useState<ControlSourceType>("onsite_count");
  const [bulkThresholdVal, setBulkThresholdVal] = useState<string>("5");
  const [matrixToastMsg, setMatrixToastMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!bulkListTarget && customLists.length > 0) {
      setBulkListTarget(customLists[0].id);
    }
  }, [customLists, bulkListTarget]);

  useEffect(() => {
    if (matrixToastMsg) {
      const timer = setTimeout(() => setMatrixToastMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [matrixToastMsg]);

  const availableCategoryHierarchy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (state.products || []).forEach((p) => {
      const primary = p.primaryCategory || "Uncategorized";
      const sub = p.subCategory || "General";
      if (!map.has(primary)) map.set(primary, new Set<string>());
      map.get(primary)!.add(sub);
    });
    return Array.from(map.keys())
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((primary) => ({
        primary,
        subs: Array.from(map.get(primary)!).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
        ),
      }));
  }, [state.products]);

  const matrixFilteredProducts = useMemo(() => {
    const listMap = new Map<string, CustomList>();
    customLists.forEach((cl) => listMap.set(cl.id, cl));

    return state.products
      .filter((p) => {
        if (matrixSearch.trim()) {
          const q = matrixSearch.toLowerCase();
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesCat = p.primaryCategory?.toLowerCase().includes(q);
          const matchesSub = p.subCategory?.toLowerCase().includes(q);
          const matchesNum = p.productNumbers?.some((num) => num.toLowerCase().includes(q));
          const matchesBarcode = p.barcode?.toLowerCase().includes(q);
          if (!matchesName && !matchesCat && !matchesSub && !matchesNum && !matchesBarcode) {
            return false;
          }
        }
        if (matrixCategory !== "all" && p.primaryCategory !== matrixCategory) return false;
        if (matrixSubCategory !== "all" && p.subCategory !== matrixSubCategory) return false;
        if (matrixListFilter !== "all") {
          const targetList = listMap.get(matrixListFilter);
          if (!targetList?.items?.some((i) => i.productId === p.id)) return false;
        }
        if (matrixMembershipFilter === "in_any") {
          if (!customLists.some((cl) => cl.items?.some((i) => i.productId === p.id))) return false;
        } else if (matrixMembershipFilter === "in_none") {
          if (customLists.some((cl) => cl.items?.some((i) => i.productId === p.id))) return false;
        } else if (matrixMembershipFilter === "controlled_only") {
          if (
            !customLists.some(
              (cl) => cl.isInventoryControlled && cl.items?.some((i) => i.productId === p.id),
            )
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (matrixSortBy === "name_asc") {
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        }
        if (matrixSortBy === "name_desc") {
          return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" });
        }
        if (matrixSortBy === "category_asc") {
          const catCmp = (a.primaryCategory || "").localeCompare(b.primaryCategory || "", undefined, {
            numeric: true,
            sensitivity: "base",
          });
          if (catCmp !== 0) return catCmp;
          const subCmp = (a.subCategory || "").localeCompare(b.subCategory || "", undefined, {
            numeric: true,
            sensitivity: "base",
          });
          if (subCmp !== 0) return subCmp;
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        }
        if (matrixSortBy === "stock_desc") {
          const stockA = (productQuantities[a.id] || 0) + (offSiteQuantityMap[a.id] || 0);
          const stockB = (productQuantities[b.id] || 0) + (offSiteQuantityMap[b.id] || 0);
          return stockB - stockA;
        }
        return 0;
      });
  }, [
    state.products,
    customLists,
    matrixSearch,
    matrixCategory,
    matrixSubCategory,
    matrixListFilter,
    matrixMembershipFilter,
    matrixSortBy,
    productQuantities,
    offSiteQuantityMap,
  ]);

  const selectedMatrixProdCount = useMemo(
    () => Object.keys(matrixSelectedProds).filter((id) => matrixSelectedProds[id]).length,
    [matrixSelectedProds],
  );

  const handleSelectAllMatrix = (checkAll: boolean) => {
    if (checkAll) {
      const next: Record<string, boolean> = {};
      matrixFilteredProducts.forEach((p) => {
        next[p.id] = true;
      });
      setMatrixSelectedProds(next);
    } else {
      setMatrixSelectedProds({});
    }
  };

  const executeBulkMatrixAction = () => {
    const selectedIds = Object.keys(matrixSelectedProds).filter((id) => matrixSelectedProds[id]);
    if (selectedIds.length === 0) {
      setMatrixToastMsg({
        type: "error",
        text: "Select one or more products before applying a bulk edit.",
      });
      return;
    }
    if (!bulkListTarget) {
      setMatrixToastMsg({ type: "error", text: "Select a target list first." });
      return;
    }

    const targetList = customLists.find((cl) => cl.id === bulkListTarget);
    if (!targetList) return;

    if (bulkActionType === "include") {
      const numericVal = bulkThresholdVal.trim() !== "" ? parseFloat(bulkThresholdVal) : undefined;
      const updates = selectedIds.map((pid) => ({
        listId: targetList.id,
        productId: pid,
        forceState: true,
        ...(numericVal !== undefined && !isNaN(numericVal) ? { threshold: numericVal } : {}),
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg({
        type: "success",
        text: `Added ${selectedIds.length} item(s) to "${targetList.name}"${numericVal !== undefined && !isNaN(numericVal) ? ` with threshold ${numericVal}` : ""}`,
      });
    } else if (bulkActionType === "exclude") {
      const updates = selectedIds.map((pid) => ({
        listId: targetList.id,
        productId: pid,
        forceState: false,
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg({
        type: "success",
        text: `Removed ${selectedIds.length} item(s) from "${targetList.name}"`,
      });
    } else if (bulkActionType === "set_source") {
      const updates = selectedIds.map((pid) => ({
        listId: targetList.id,
        productId: pid,
        controlSource: bulkControlSourceVal,
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg({
        type: "success",
        text: `Updated inventory source to ${bulkControlSourceVal.replace("_", " ")} for ${selectedIds.length} item(s) on "${targetList.name}"`,
      });
    } else if (bulkActionType === "set_threshold") {
      const numericVal = parseFloat(bulkThresholdVal);
      if (isNaN(numericVal)) {
        setMatrixToastMsg({ type: "error", text: "Enter a valid numeric threshold." });
        return;
      }
      const updates = selectedIds.map((pid) => ({
        listId: targetList.id,
        productId: pid,
        threshold: numericVal,
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg({
        type: "success",
        text: `Updated threshold to ${numericVal} for ${selectedIds.length} item(s) on "${targetList.name}"`,
      });
    } else if (bulkActionType === "clear_threshold") {
      const updates = selectedIds.map((pid) => ({
        listId: targetList.id,
        productId: pid,
        threshold: null,
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg({
        type: "success",
        text: `Cleared custom threshold for ${selectedIds.length} item(s) on "${targetList.name}"`,
      });
    }
  };

  const renderTableRows = (itemsToRender: CustomList["items"], currentList: CustomList) => {
    return itemsToRender.map((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      if (!prod) return null;

      const onsiteCount = productQuantities[prod.id] || 0;
      const offsiteCount = offSiteQuantityMap[prod.id] || 0;
      const offsiteWeight = offSiteWeightMap[prod.id] || 0;
      const totalCount = onsiteCount + offsiteCount;

      const controlSource = item.controlSource || "onsite_count";
      let curValue = onsiteCount;
      let unitLabel = "onsite";

      if (controlSource === "offsite_count") {
        curValue = offsiteCount;
        unitLabel = "offsite";
      } else if (controlSource === "offsite_weight") {
        curValue = offsiteWeight;
        unitLabel = "lbs";
      } else if (controlSource === "total_count") {
        curValue = totalCount;
        unitLabel = "total";
      }

      const threshold = prod.listThresholds?.[currentList.id];
      const hasThreshold = threshold !== undefined && threshold !== null;
      let isTriggered = false;

      if (hasThreshold && currentList.isInventoryControlled) {
        if (currentList.controlCondition === "max") {
          isTriggered = curValue >= (threshold || 0);
        } else {
          isTriggered = curValue <= (threshold || 0);
        }
      }

      return (
        <tr key={item.productId} className="hover:bg-cool-gray-900/35 transition-all">
          <td className="py-3 px-3">
            <div className="font-bold text-cool-gray-100 text-sm">{prod.name}</div>
            <div className="text-[11px] text-cool-gray-400">
              {prod.primaryCategory} &gt; {prod.subCategory}
            </div>
          </td>
          <td className="py-3 px-3 text-center">
            <div className="flex flex-col items-center justify-center gap-1.5">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded tabular-nums ${
                  !hasThreshold || !currentList.isInventoryControlled
                    ? "text-cool-gray-300 bg-cool-gray-800"
                    : isTriggered
                      ? currentList.controlCondition === "max"
                        ? "text-cyan-400 bg-cyan-950/25 border border-cyan-500/25"
                        : "text-amber-400 bg-amber-950/25 border border-amber-900/30"
                      : "text-green-400 bg-green-950/20 border border-green-900/20"
                }`}
              >
                {curValue.toFixed(controlSource === "offsite_weight" ? 2 : 0)} {unitLabel}
              </span>

              {currentList.isInventoryControlled && (
                <div className="flex flex-col gap-1 w-full max-w-[135px] mt-1">
                  <select
                    value={controlSource}
                    onChange={(e) => {
                      dispatch({
                        type: "UPDATE_LIST_ITEM_CONTROL_SOURCE",
                        payload: {
                          listId: currentList.id,
                          productId: prod.id,
                          controlSource: e.target.value as ControlSourceType,
                        },
                      });
                    }}
                    className="w-full bg-cool-gray-950 border border-cool-gray-800 rounded px-1.5 py-0.5 text-[10px] font-semibold text-cool-gray-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="onsite_count">On-Site Count</option>
                    <option value="offsite_count">Off-Site Count</option>
                    <option value="offsite_weight">Off-Site Weight</option>
                    <option value="total_count">Total Count</option>
                  </select>

                  <div className="flex items-center justify-between gap-1 bg-cool-gray-950 border border-cool-gray-800 rounded px-1.5 py-0.5 text-[10px]">
                    <span className="text-[10px] text-cool-gray-400 font-bold uppercase tracking-wider">
                      {currentList.controlCondition === "max" ? "Max" : "Min"}:
                    </span>
                    <input
                      type="number"
                      step={controlSource === "offsite_weight" ? "0.1" : "1"}
                      value={threshold !== undefined && threshold !== null ? threshold : ""}
                      placeholder="None"
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value);
                        dispatch({
                          type: "UPDATE_LIST_ITEM_THRESHOLD",
                          payload: {
                            listId: currentList.id,
                            productId: prod.id,
                            threshold: val,
                          },
                        });
                      }}
                      className="w-12 bg-transparent text-right font-bold text-white focus:outline-none focus:text-cyan-400 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </td>
          {currentList.allowNotes && (
            <td className="py-3 px-3">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cool-gray-500 shrink-0" />
                <input
                  type="text"
                  value={item.notes || ""}
                  onChange={(e) => {
                    dispatch({
                      type: "UPDATE_LIST_ITEM_NOTE",
                      payload: {
                        listId: currentList.id,
                        productId: prod.id,
                        notes: e.target.value,
                      },
                    });
                  }}
                  placeholder="Set specific status note..."
                  className="w-full bg-cool-gray-950 border border-cool-gray-800 hover:border-cool-gray-700 rounded-md px-2.5 py-1.5 text-white placeholder-cool-gray-600 focus:outline-none focus:border-cyan-500 transition-colors text-xs"
                />
              </div>
            </td>
          )}
          {currentList.notificationEnabled && (
            <td className="py-3 px-3 text-center">
              <button
                type="button"
                onClick={() => {
                  dispatch({
                    type: "TOGGLE_LIST_ITEM_NOTIFICATION",
                    payload: {
                      listId: currentList.id,
                      productId: prod.id,
                      notifyEnabled: !(item.notifyEnabled !== false),
                    },
                  });
                }}
                className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                  item.notifyEnabled !== false
                    ? "bg-amber-950/40 text-amber-400 border-amber-900/30"
                    : "bg-cool-gray-900 text-cool-gray-600 border-cool-gray-800"
                }`}
                title={
                  item.notifyEnabled !== false
                    ? "Disable daily digest for this item"
                    : "Enable daily digest for this item"
                }
              >
                <Bell className="w-3.5 h-3.5" />
              </button>
            </td>
          )}
          <td className="py-3 px-3 text-right">
            <button
              type="button"
              onClick={() => {
                dispatch({
                  type: "TOGGLE_PRODUCT_ON_LIST",
                  payload: {
                    listId: currentList.id,
                    productId: prod.id,
                    forceState: false,
                  },
                });
              }}
              className="p-1.5 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 rounded transition cursor-pointer"
              title="Remove product from list"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </td>
        </tr>
      );
    });
  };

  const formatListMeta = (cl: CustomList) => {
    const count = cl.items?.length || 0;
    const parts: string[] = [`${count} ${count === 1 ? "item" : "items"}`];
    parts.push(cl.allowNotes ? "Notes on" : "Notes off");
    if (cl.isInventoryControlled) {
      parts.push(
        `${cl.controlType === "auto" ? "Auto-Stock" : "Alert-Stock"} (${cl.controlCondition || "min"})`,
      );
    } else {
      parts.push("Static");
    }
    if (cl.notificationEnabled) {
      parts.push(formatListNotificationSummary(cl, configuredChannels));
    }
    return parts.join(" · ");
  };

  return (
    <div className="space-y-4 font-sans text-sm pb-8">
      {/* Standalone Mode Switcher when embedded outside LibraryView (e.g. #restock) */}
      {!hideInternalHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-750">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
            <button
              type="button"
              onClick={() => setEffectiveMode("overview")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer tabular-nums ${
                effectiveMode === "overview"
                  ? "bg-cyan-600 text-white"
                  : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-850"
              }`}
            >
              Lists Overview ({customLists.length})
            </button>
            <button
              type="button"
              onClick={() => setEffectiveMode("matrix")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                effectiveMode === "matrix"
                  ? "bg-cyan-600 text-white"
                  : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-850"
              }`}
            >
              Bulk Matrix
            </button>
          </div>

          {effectiveMode === "overview" && !activeList && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Create List
            </button>
          )}
        </div>
      )}

      {effectiveMode === "overview" ? (
        !activeList ? (
          /* STEP 1: LISTS OVERVIEW */
          <div className="space-y-3.5">
            <CatalogSearchFilterBar
              searchValue={listOverviewSearch}
              onSearchChange={setListOverviewSearch}
              searchPlaceholder="Search custom lists by name or description..."
              isFiltersOpen={showOverviewFilters}
              onToggleFilters={() => setShowOverviewFilters((prev) => !prev)}
              activeFilterCount={activeListOverviewFilterCount}
              onResetFilters={() => {
                setListOverviewSearch("");
                setListControlFilter("all");
                setListDigestFilter("all");
                setListOverviewSort("default");
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Stock Control
                  </label>
                  <select
                    value={listControlFilter}
                    onChange={(e) => setListControlFilter(e.target.value as any)}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="all">All Lists ({customLists.length})</option>
                    <option value="controlled">Inventory-Controlled Only</option>
                    <option value="static">Static Checklists Only</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Digest Alerts
                  </label>
                  <select
                    value={listDigestFilter}
                    onChange={(e) => setListDigestFilter(e.target.value as any)}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="all">All Digest Settings</option>
                    <option value="enabled">Digest Enabled</option>
                    <option value="disabled">Digest Off</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Sort Order
                  </label>
                  <select
                    value={listOverviewSort}
                    onChange={(e) => setListOverviewSort(e.target.value as any)}
                    className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="default">Saved Order</option>
                    <option value="name_asc">Name: A to Z</option>
                    <option value="name_desc">Name: Z to A</option>
                    <option value="items_desc">Most Items First</option>
                    <option value="items_asc">Fewest Items First</option>
                  </select>
                </div>
              </div>
            </CatalogSearchFilterBar>

            {customLists.length === 0 ? (
              <div className="bg-cool-gray-850/60 border border-cool-gray-750 rounded-xl p-10 text-center space-y-3">
                <ClipboardList className="w-8 h-8 text-cool-gray-500 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">No Custom Lists Created</h3>
                  <p className="text-xs text-cool-gray-400 max-w-md mx-auto">
                    Create checklists or inventory-controlled threshold lists to monitor display restocking, alerts, or daily digests.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <PlusIcon className="w-3.5 h-3.5" /> Create First List
                </button>
              </div>
            ) : filteredOverviewLists.length === 0 ? (
              <div className="bg-cool-gray-850/50 border border-cool-gray-750 rounded-xl p-8 text-center space-y-2.5">
                <p className="text-sm font-semibold text-cool-gray-300">No custom lists match your search or filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setListOverviewSearch("");
                    setListControlFilter("all");
                    setListDigestFilter("all");
                    setListOverviewSort("default");
                  }}
                  className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cyan-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredOverviewLists.map((cl) => (
                  <div
                    key={cl.id}
                    className="bg-cool-gray-850/75 border border-cool-gray-750 hover:border-cool-gray-600 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-white truncate">{cl.name}</h3>
                      {cl.description ? (
                        <p className="text-xs text-cool-gray-400 line-clamp-2">{cl.description}</p>
                      ) : (
                        <p className="text-xs text-cool-gray-500 italic">No description</p>
                      )}
                      <div className="pt-0.5 text-[11px] text-cool-gray-400 font-medium tabular-nums">
                        {formatListMeta(cl)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedListId(cl.id);
                          setAddProductId("");
                          setAddNote("");
                          setListSearch("");
                          setListCategory("all");
                        }}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <ClipboardList className="w-3.5 h-3.5" /> Manage Items
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditClick(cl)}
                        className="px-2.5 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-cyan-400" /> Edit Settings
                      </button>
                      <button
                        type="button"
                        onClick={() => setListToDelete({ id: cl.id, name: cl.name })}
                        className="p-1.5 bg-cool-gray-800 hover:bg-rose-950/40 border border-cool-gray-700 hover:border-rose-500/40 text-cool-gray-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
                        title="Delete List"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* STEP 2: DEDICATED LIST ITEM MANAGER */
          <div className="bg-cool-gray-850/75 border border-cool-gray-750 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-750">
              <div className="space-y-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedListId(null)}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1.5 cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Lists
                </button>
                <h3 className="text-base font-bold text-white truncate">{activeList.name}</h3>
                {activeList.description && (
                  <p className="text-xs text-cool-gray-400">{activeList.description}</p>
                )}
                <p className="text-[11px] text-cool-gray-400 font-medium tabular-nums">
                  {formatListMeta(activeList)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => handleEditClick(activeList)}
                  className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-cyan-400" /> Edit Settings
                </button>
                <button
                  type="button"
                  onClick={() => setListToDelete({ id: activeList.id, name: activeList.name })}
                  className="px-2.5 py-1.5 bg-cool-gray-800 hover:bg-rose-950/40 border border-cool-gray-700 hover:border-rose-500/40 text-cool-gray-400 hover:text-rose-300 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

            {/* Inline Add Product Bar */}
            <div className="p-3 bg-cool-gray-900 rounded-lg border border-cool-gray-800 flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-grow min-w-0">
                <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block mb-1">
                  Add Product to List
                </label>
                {availableProducts.length === 0 ? (
                  <span className="text-xs text-cool-gray-500 font-medium block h-9 bg-cool-gray-950 border border-cool-gray-800 leading-[34px] px-3.5 rounded-md">
                    All catalog items are already on this list.
                  </span>
                ) : (
                  <SearchableProductSelect
                    products={availableProducts}
                    value={addProductId}
                    onChange={setAddProductId}
                    placeholder="Search product by name, SKU or category..."
                    includeArchived={true}
                  />
                )}
              </div>

              {activeList.allowNotes && addProductId && (
                <div className="flex-grow min-w-0">
                  <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    placeholder="Add status note..."
                    className="w-full h-9 bg-cool-gray-950 border border-cool-gray-750 text-xs rounded-md text-white px-3 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={!addProductId}
                onClick={handleAddProductToList}
                className={`h-9 px-4 rounded-md font-bold text-xs transition flex items-center justify-center gap-1 whitespace-nowrap shrink-0 ${
                  addProductId
                    ? "bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                    : "bg-cool-gray-800 text-cool-gray-600 cursor-not-allowed border border-cool-gray-800"
                }`}
              >
                <PlusIcon className="w-3.5 h-3.5" /> Add to List
              </button>
            </div>

            {/* Search, Category Filter & Plain / By Category Mode */}
            {activeList.items && activeList.items.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-cool-gray-900/50 p-3 rounded-lg border border-cool-gray-800">
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center w-full sm:w-auto flex-grow max-w-xl">
                  <div className="relative flex-grow">
                    <SearchIcon className="h-4 w-4 text-cool-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      placeholder="Search items by name, category or note..."
                      className="w-full h-8 pl-9 pr-8 bg-cool-gray-950 border border-cool-gray-750 rounded-md text-xs text-white placeholder-cool-gray-550 focus:outline-none focus:border-cyan-500"
                    />
                    {listSearch && (
                      <button
                        type="button"
                        onClick={() => setListSearch("")}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-cool-gray-500 hover:text-white text-sm cursor-pointer"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  <select
                    value={listCategory}
                    onChange={(e) => setListCategory(e.target.value)}
                    className="min-w-[140px] h-8 py-1 px-2.5 bg-cool-gray-950 border border-cool-gray-750 text-xs rounded-md text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex items-center gap-1 self-end sm:self-auto shrink-0 bg-cool-gray-950 p-0.5 rounded-lg border border-cool-gray-800">
                  <button
                    type="button"
                    onClick={() => setOrganizeMode("list")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      organizeMode === "list" ? "bg-cyan-600 text-white" : "text-cool-gray-400 hover:text-white"
                    }`}
                  >
                    Plain List
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrganizeMode("category")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      organizeMode === "category" ? "bg-cyan-600 text-white" : "text-cool-gray-400 hover:text-white"
                    }`}
                  >
                    By Category
                  </button>
                </div>
              </div>
            )}

            {/* Full-Width List Items Table */}
            <div className="overflow-x-auto">
              {!activeList.items || activeList.items.length === 0 ? (
                <div className="text-center py-10 text-cool-gray-400 bg-cool-gray-900/50 border border-dashed border-cool-gray-800 rounded-xl space-y-1">
                  <AlertCircle className="w-7 h-7 text-cool-gray-600 mx-auto" />
                  <p className="font-semibold text-xs text-cool-gray-300">
                    This list does not have any items yet.
                  </p>
                  <p className="text-[11px] text-cool-gray-500">
                    Use the product selector above to add catalog items.
                  </p>
                </div>
              ) : filteredListItems.length === 0 ? (
                <div className="text-center py-8 text-cool-gray-400 bg-cool-gray-900/40 border border-dashed border-cool-gray-800 rounded-xl space-y-1">
                  <AlertCircle className="w-6 h-6 text-cool-gray-600 mx-auto" />
                  <p className="font-semibold text-xs text-cool-gray-300">No matching items found.</p>
                  <p className="text-[11px] text-cool-gray-500">
                    Adjust your search text or category filter.
                  </p>
                </div>
              ) : organizeMode === "category" ? (
                <div className="space-y-4">
                  {Object.keys(groupedFilteredItems).map((category) => {
                    const items = groupedFilteredItems[category];
                    if (items.length === 0) return null;
                    return (
                      <div
                        key={category}
                        className="bg-cool-gray-900/35 p-3.5 rounded-xl border border-cool-gray-800 space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-cool-gray-800 pb-1.5">
                          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                            {category}
                          </h4>
                          <span className="text-[11px] text-cool-gray-400 font-medium tabular-nums">
                            {items.length} {items.length === 1 ? "item" : "items"}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left text-cool-gray-300">
                            <thead className="text-[10px] uppercase text-cool-gray-400 bg-cool-gray-950/60 tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3 rounded-l-md font-bold">Product</th>
                                <th className="py-2.5 px-3 font-bold text-center">
                                  {activeList.isInventoryControlled
                                    ? "Controlled Level & Rule"
                                    : "On-Site Qty"}
                                </th>
                                {activeList.allowNotes && (
                                  <th className="py-2.5 px-3 font-bold">Item Note</th>
                                )}
                                {activeList.notificationEnabled && (
                                  <th className="py-2.5 px-3 font-bold text-center">Notify</th>
                                )}
                                <th className="py-2.5 px-3 rounded-r-md font-bold text-right">
                                  Remove
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-cool-gray-800/50">
                              {renderTableRows(items, activeList)}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <table className="w-full text-xs text-left text-cool-gray-300 bg-cool-gray-900/20 rounded-xl border border-cool-gray-800">
                  <thead className="text-[10px] uppercase text-cool-gray-400 bg-cool-gray-900 tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-md font-bold">Product</th>
                      <th className="py-2.5 px-3 font-bold text-center">
                        {activeList.isInventoryControlled
                          ? "Controlled Level & Rule"
                          : "On-Site Qty"}
                      </th>
                      {activeList.allowNotes && (
                        <th className="py-2.5 px-3 font-bold">Item Note</th>
                      )}
                      {activeList.notificationEnabled && (
                        <th className="py-2.5 px-3 font-bold text-center">Notify</th>
                      )}
                      <th className="py-2.5 px-3 rounded-r-md font-bold text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cool-gray-800/60">
                    {renderTableRows(filteredListItems, activeList)}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      ) : (
        /* BULK MATRIX SPREADSHEET GRID */
        <div className="space-y-4">
          <CatalogSearchFilterBar
            searchValue={matrixSearch}
            onSearchChange={setMatrixSearch}
            searchPlaceholder="Search product, category, SKU, or barcode..."
            isFiltersOpen={showMatrixFilters}
            onToggleFilters={() => setShowMatrixFilters((prev) => !prev)}
            activeFilterCount={
              (matrixCategory !== "all" ? 1 : 0) +
              (matrixMembershipFilter !== "all" ? 1 : 0) +
              (matrixListFilter !== "all" ? 1 : 0) +
              (matrixSortBy !== "category_asc" ? 1 : 0)
            }
            onResetFilters={() => {
              setMatrixSearch("");
              setMatrixCategory("all");
              setMatrixSubCategory("all");
              setMatrixMembershipFilter("all");
              setMatrixListFilter("all");
              setMatrixSortBy("category_asc");
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Category / Subcategory
                </label>
                <select
                  value={
                    matrixCategory === "all"
                      ? "all"
                      : matrixSubCategory === "all"
                        ? `cat:${matrixCategory}`
                        : `sub:${matrixCategory}|${matrixSubCategory}`
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "all") {
                      setMatrixCategory("all");
                      setMatrixSubCategory("all");
                    } else if (val.startsWith("cat:")) {
                      setMatrixCategory(val.slice(4));
                      setMatrixSubCategory("all");
                    } else if (val.startsWith("sub:")) {
                      const [pCat, sCat] = val.slice(4).split("|");
                      setMatrixCategory(pCat);
                      setMatrixSubCategory(sCat);
                    }
                  }}
                  className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 text-cool-gray-200 text-xs px-2.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Categories &amp; Subcategories</option>
                  {availableCategoryHierarchy.map(({ primary, subs }) => (
                    <optgroup key={primary} label={primary}>
                      <option value={`cat:${primary}`}>{primary} (All)</option>
                      {subs.map((sub) => (
                        <option key={`${primary}|${sub}`} value={`sub:${primary}|${sub}`}>
                          {primary} / {sub}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  List Status
                </label>
                <select
                  value={matrixMembershipFilter}
                  onChange={(e) => setMatrixMembershipFilter(e.target.value as any)}
                  className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 text-cool-gray-200 text-xs px-2.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">Any List Status</option>
                  <option value="in_any">In at least 1 list</option>
                  <option value="in_none">Not in any list</option>
                  <option value="controlled_only">In inventory-controlled lists</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Target List
                </label>
                <select
                  value={matrixListFilter}
                  onChange={(e) => setMatrixListFilter(e.target.value)}
                  className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 text-cool-gray-200 text-xs px-2.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Lists (Full Matrix)</option>
                  {customLists.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      Only on: {cl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Sort Order
                </label>
                <select
                  value={matrixSortBy}
                  onChange={(e) => setMatrixSortBy(e.target.value as any)}
                  className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 text-cool-gray-200 text-xs px-2.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="category_asc">Category &amp; Name</option>
                  <option value="name_asc">Product Name (A-Z)</option>
                  <option value="name_desc">Product Name (Z-A)</option>
                  <option value="stock_desc">Total Inventory Stock</option>
                </select>
              </div>
            </div>
          </CatalogSearchFilterBar>

          <div className="bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-750 space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-cool-gray-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
                  <Table className="w-4 h-4 text-cyan-400" />
                  Bulk Matrix &amp; Inventory Control
                </h3>
                <p className="text-xs text-cool-gray-400">
                  Showing {matrixFilteredProducts.length} products across {customLists.length} list(s).
                </p>
              </div>

              {matrixToastMsg && (
                <div
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                    matrixToastMsg.type === "error"
                      ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                      : "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  {matrixToastMsg.type === "error" ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 shrink-0" />
                  )}
                  <span>{matrixToastMsg.text}</span>
                </div>
              )}
            </div>

            <div className="bg-cool-gray-900/90 rounded-lg p-2.5 border border-cool-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-cool-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      matrixFilteredProducts.length > 0 &&
                      selectedMatrixProdCount === matrixFilteredProducts.length
                    }
                    onChange={(e) => handleSelectAllMatrix(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-600 focus:ring-0 cursor-pointer"
                  />
                  Select All Filtered ({matrixFilteredProducts.length})
                </label>
                {selectedMatrixProdCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-cyan-950/60 text-cyan-300 font-bold border border-cyan-800/40">
                    {selectedMatrixProdCount} selected
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-cool-gray-400">Batch Edit:</span>
                <select
                  value={bulkListTarget}
                  onChange={(e) => setBulkListTarget(e.target.value)}
                  className="bg-cool-gray-950 border border-cool-gray-700 text-cool-gray-200 text-xs px-2 py-1 rounded focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {customLists.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      Target: {cl.name}
                    </option>
                  ))}
                </select>

                <select
                  value={bulkActionType}
                  onChange={(e) => setBulkActionType(e.target.value as any)}
                  className="bg-cool-gray-950 border border-cool-gray-700 text-cool-gray-200 text-xs px-2 py-1 rounded focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="include">Add to List</option>
                  <option value="exclude">Remove from List</option>
                  <option value="set_source">Set Inventory Source...</option>
                  <option value="set_threshold">Set Threshold Level...</option>
                  <option value="clear_threshold">Clear Custom Threshold</option>
                </select>

                {bulkActionType === "set_source" && (
                  <select
                    value={bulkControlSourceVal}
                    onChange={(e) => setBulkControlSourceVal(e.target.value as ControlSourceType)}
                    className="bg-cool-gray-950 border border-cyan-600/70 text-cyan-300 text-xs px-2 py-1 rounded focus:outline-none cursor-pointer font-semibold"
                  >
                    <option value="onsite_count">On-Site Cut Count</option>
                    <option value="onsite_weight">On-Site Weight (lbs)</option>
                    <option value="offsite_count">Off-Site Boxed Cut Count</option>
                    <option value="offsite_weight">Off-Site Weight (lbs)</option>
                    <option value="total_count">Total Overall Cut Count</option>
                    <option value="total_weight">Total Overall Weight (lbs)</option>
                  </select>
                )}

                {(bulkActionType === "set_threshold" || bulkActionType === "include") && (
                  <div className="flex items-center gap-1.5 bg-cool-gray-950 px-2 py-1 rounded border border-cool-gray-700">
                    <span className="text-xs font-bold text-cool-gray-300">Threshold:</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={bulkThresholdVal}
                      onChange={(e) => setBulkThresholdVal(e.target.value)}
                      placeholder="Threshold"
                      className="w-20 bg-cool-gray-900 border border-cyan-600/70 text-cyan-300 text-xs px-2 py-0.5 rounded focus:outline-none text-center font-bold"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={executeBulkMatrixAction}
                  disabled={selectedMatrixProdCount === 0 || !bulkListTarget}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Apply ({selectedMatrixProdCount})
                </button>
              </div>
            </div>
          </div>

          <div className="bg-cool-gray-850 rounded-xl border border-cool-gray-750 overflow-hidden">
            {customLists.length === 0 ? (
              <div className="p-10 text-center text-cool-gray-400 space-y-2">
                <AlertCircle className="w-7 h-7 text-amber-400 mx-auto" />
                <p className="font-semibold text-sm">No custom lists found.</p>
                <p className="text-xs text-cool-gray-500">
                  Switch to Lists Overview to create a list before using the Bulk Matrix.
                </p>
              </div>
            ) : matrixFilteredProducts.length === 0 ? (
              <div className="p-10 text-center text-cool-gray-400 space-y-2">
                <SearchIcon className="w-7 h-7 text-cool-gray-500 mx-auto" />
                <p className="font-semibold text-sm">No products match your search or filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setMatrixSearch("");
                    setMatrixCategory("all");
                    setMatrixSubCategory("all");
                    setMatrixListFilter("all");
                    setMatrixMembershipFilter("all");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cool-gray-800 text-cyan-400 hover:bg-cool-gray-750 text-xs font-semibold transition cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-xs text-left text-cool-gray-300 border-collapse">
                  <thead className="text-[10px] uppercase text-cool-gray-400 bg-cool-gray-950 sticky top-0 z-20">
                    <tr className="border-b border-cool-gray-800 divide-x divide-cool-gray-800/60">
                      <th className="py-3 px-3 w-10 text-center bg-cool-gray-950 sticky left-0 z-30">
                        <input
                          type="checkbox"
                          checked={
                            selectedMatrixProdCount > 0 &&
                            selectedMatrixProdCount === matrixFilteredProducts.length
                          }
                          onChange={(e) => handleSelectAllMatrix(e.target.checked)}
                          className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3.5 min-w-[200px] font-bold text-cool-gray-200 bg-cool-gray-950 sticky left-10 z-30">
                        Product Details
                      </th>
                      <th className="py-3 px-3 text-center min-w-[140px] font-bold text-cool-gray-300 bg-cool-gray-950">
                        Live Stock
                      </th>
                      {customLists.map((cl) => (
                        <th key={cl.id} className="py-2.5 px-3 min-w-[250px] text-left font-bold bg-cool-gray-950">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate text-cyan-300 max-w-[160px]" title={cl.name}>
                              {cl.name}
                            </span>
                            <span className="text-[10px] text-cool-gray-400 font-medium tabular-nums shrink-0">
                              {cl.items?.length || 0} items
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cool-gray-800/70">
                    {matrixFilteredProducts.map((prod, idx) => {
                      const onsiteCount = productQuantities[prod.id] || 0;
                      const offsiteCount = offSiteQuantityMap[prod.id] || 0;
                      const totalCount = onsiteCount + offsiteCount;
                      const isRowSelected = !!matrixSelectedProds[prod.id];

                      return (
                        <tr
                          key={prod.id}
                          className={`transition-colors divide-x divide-cool-gray-800/40 ${
                            isRowSelected
                              ? "bg-cyan-950/20 hover:bg-cyan-950/30"
                              : idx % 2 === 0
                                ? "bg-cool-gray-900/30 hover:bg-cool-gray-800/50"
                                : "bg-cool-gray-900/60 hover:bg-cool-gray-800/50"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center bg-inherit sticky left-0 z-10">
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={(e) => {
                                setMatrixSelectedProds((prev) => ({
                                  ...prev,
                                  [prod.id]: e.target.checked,
                                }));
                              }}
                              className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-600 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3.5 bg-inherit sticky left-10 z-10">
                            <div className="font-bold text-cool-gray-100 text-xs">{prod.name}</div>
                            <div className="text-[10px] text-cool-gray-400 mt-0.5">
                              {prod.primaryCategory || "Uncategorized"}
                              {prod.subCategory ? ` › ${prod.subCategory}` : ""}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center tabular-nums">
                            <div className="text-xs font-bold text-cool-gray-200">
                              {totalCount} <span className="text-[10px] font-normal text-cool-gray-400">total</span>
                            </div>
                            <div className="text-[10px] text-cool-gray-400 mt-0.5">
                              {onsiteCount} on · {offsiteCount} off
                            </div>
                          </td>
                          {customLists.map((cl) => {
                            const listItem = cl.items?.find((item) => item.productId === prod.id);
                            const isIncluded = !!listItem;
                            const currentCS: ControlSourceType =
                              listItem?.controlSource ||
                              prod.listControlSources?.[cl.id] ||
                              "onsite_count";
                            const currentThreshold =
                              listItem?.threshold !== undefined
                                ? listItem.threshold
                                : prod.listThresholds?.[cl.id];

                            return (
                              <td key={cl.id} className="py-2 px-3 align-middle">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      dispatch({
                                        type: "TOGGLE_PRODUCT_ON_LIST",
                                        payload: {
                                          listId: cl.id,
                                          productId: prod.id,
                                          forceState: !isIncluded,
                                        },
                                      });
                                    }}
                                    className={`px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                                      isIncluded
                                        ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-600/40"
                                        : "bg-cool-gray-950 text-cool-gray-400 border border-cool-gray-800 hover:text-cool-gray-200"
                                    }`}
                                  >
                                    {isIncluded ? (
                                      <>
                                        <Check className="w-3 h-3 text-cyan-400" />
                                        <span>On List</span>
                                      </>
                                    ) : (
                                      <span>+ Add</span>
                                    )}
                                  </button>

                                  {isIncluded && (
                                    <div className="flex items-center gap-1.5 grow">
                                      <select
                                        value={currentCS}
                                        onChange={(e) => {
                                          dispatch({
                                            type: "UPDATE_LIST_ITEM_CONTROL_SOURCE",
                                            payload: {
                                              listId: cl.id,
                                              productId: prod.id,
                                              controlSource: e.target.value as ControlSourceType,
                                            },
                                          });
                                        }}
                                        className="bg-cool-gray-950 border border-cool-gray-800 hover:border-cool-gray-700 text-cool-gray-300 text-[10px] py-1 px-1.5 rounded focus:outline-none focus:border-cyan-500 cursor-pointer max-w-[110px] truncate"
                                      >
                                        <option value="onsite_count">On-Site Count</option>
                                        <option value="onsite_weight">On-Site Weight</option>
                                        <option value="offsite_count">Off-Site Count</option>
                                        <option value="offsite_weight">Off-Site Weight</option>
                                        <option value="total_count">Total Count</option>
                                        <option value="total_weight">Total Weight</option>
                                      </select>

                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="Def"
                                        value={
                                          currentThreshold !== undefined && currentThreshold !== null
                                            ? currentThreshold
                                            : ""
                                        }
                                        onChange={(e) => {
                                          const num =
                                            e.target.value === "" ? null : parseFloat(e.target.value);
                                          dispatch({
                                            type: "UPDATE_LIST_ITEM_THRESHOLD",
                                            payload: {
                                              listId: cl.id,
                                              productId: prod.id,
                                              threshold: num,
                                            },
                                          });
                                        }}
                                        className="w-14 bg-cool-gray-950 border border-cool-gray-800 focus:border-cyan-500 text-amber-300 font-bold text-[10px] py-1 px-1 rounded text-center focus:outline-none tabular-nums"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List Configuration Modal */}
      {isFormVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={handleCancelForm}
        >
          <form
            onSubmit={handleCreateOrEditList}
            onClick={(e) => e.stopPropagation()}
            className="bg-cool-gray-850 border border-cool-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="border-b border-cool-gray-750 pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingListId ? "Edit List Settings" : "Create New List"}
              </h3>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-cool-gray-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">List Name</label>
              <input
                type="text"
                required
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="e.g. Display Restock Watchlist, Price Audit"
                className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white placeholder-cool-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">Description</label>
              <input
                type="text"
                value={listDesc}
                onChange={(e) => setListDesc(e.target.value)}
                placeholder="Purpose or instructions for this list..."
                className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white placeholder-cool-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="bg-cool-gray-900 rounded-lg p-3 border border-cool-gray-750 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowNotes}
                  onChange={(e) => setAllowNotes(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-cool-gray-200 block">Allow Item Notes</span>
                  <span className="text-cool-gray-400 block mt-0.5">
                    Enable per-item status notes on this list.
                  </span>
                </div>
              </label>

              <label className="bg-cool-gray-900 rounded-lg p-3 border border-cool-gray-750 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInventoryControlled}
                  onChange={(e) => setIsInventoryControlled(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-cool-gray-200 block">
                    Inventory Level Controlled
                  </span>
                  <span className="text-cool-gray-400 block mt-0.5">
                    Track product thresholds against stock counts/weights.
                  </span>
                </div>
              </label>
            </div>

            {isInventoryControlled && (
              <div className="p-4 bg-cool-gray-900/70 rounded-xl border border-cool-gray-750 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-cool-gray-400 block">
                      Behavior
                    </label>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-750 flex-1 rounded cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="controlType"
                          checked={controlType === "prompt"}
                          onChange={() => setControlType("prompt")}
                        />
                        <span className="font-semibold text-cool-gray-200">Popup Alert</span>
                      </label>
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-750 flex-1 rounded cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="controlType"
                          checked={controlType === "auto"}
                          onChange={() => setControlType("auto")}
                        />
                        <span className="font-semibold text-cool-gray-200">Auto Move</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-cool-gray-400 block">
                      Threshold Condition
                    </label>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-750 flex-1 rounded cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="controlCondition"
                          checked={controlCondition === "min"}
                          onChange={() => setControlCondition("min")}
                        />
                        <span className="font-semibold text-cool-gray-200">Min (Low)</span>
                      </label>
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-750 flex-1 rounded cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="controlCondition"
                          checked={controlCondition === "max"}
                          onChange={() => setControlCondition("max")}
                        />
                        <span className="font-semibold text-cool-gray-200">Max (High)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-cool-gray-900 rounded-xl p-4 border border-cool-gray-750 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={listNotificationEnabled}
                    onChange={(e) => setListNotificationEnabled(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-cool-gray-100 block">
                      Enable List Notifications
                    </span>
                    <span className="text-cool-gray-400 block mt-0.5">
                      Choose delivery channels and combine multiple schedules or immediate triggers.
                    </span>
                  </div>
                </label>

                {onNavigateToNotifications && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormVisible(false);
                      onNavigateToNotifications();
                    }}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition whitespace-nowrap cursor-pointer"
                  >
                    Manage Channels &rarr;
                  </button>
                )}
              </div>

              {listNotificationEnabled && (
                <div className="space-y-4 pt-3 border-t border-cool-gray-800">
                  {/* 1. Primary Multi-Select Delivery Channels */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-cool-gray-300">
                        Delivery Channels (Multi-Select)
                      </label>
                      <span className="text-[11px] text-cool-gray-400 tabular-nums">
                        {listChannelIds.length > 0
                          ? `${listChannelIds.length} selected`
                          : "Uses system default channel"}
                      </span>
                    </div>

                    {configuredChannels.length === 0 ? (
                      <div className="p-3 bg-cool-gray-950 border border-cool-gray-800 rounded-lg text-xs text-cool-gray-400 flex flex-wrap items-center justify-between gap-2">
                        <span>No channels configured yet. Configure SMTP or Webhook channels in System &amp; Admin &rarr; Notifications.</span>
                        {onNavigateToNotifications && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormVisible(false);
                              onNavigateToNotifications();
                            }}
                            className="px-2.5 py-1 bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Open Notification Center
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {configuredChannels.map((ch) => {
                          const selected = listChannelIds.includes(ch.id);
                          return (
                            <label
                              key={ch.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                                selected
                                  ? "bg-cyan-950/25 border-cyan-500/60 text-white"
                                  : "bg-cool-gray-950 border-cool-gray-800 text-cool-gray-300 hover:border-cool-gray-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleChannelSelection(setListChannelIds, ch.id)}
                                className="w-3.5 h-3.5 mt-0.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500"
                              />
                              <div className="min-w-0 text-xs">
                                <div className="font-semibold truncate flex items-center gap-1.5">
                                  <span className="truncate">{ch.name}</span>
                                  {!ch.enabled && (
                                    <span className="text-[10px] text-amber-400 font-normal">(Paused)</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-cool-gray-400 truncate">
                                  {getChannelTypeLabel(ch.type)}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {configuredChannels.some((c) => c.type === "smtp_email") && (
                      <div className="pt-1">
                        <label className="text-[11px] font-semibold text-cool-gray-400 block mb-1">
                          Email Recipient Override (&ldquo;To&rdquo;, optional)
                        </label>
                        <input
                          type="text"
                          value={listRecipientOverride}
                          onChange={(e) => setListRecipientOverride(e.target.value)}
                          placeholder="Leave blank to use the SMTP channel default recipient"
                          className="w-full bg-cool-gray-950 border border-cool-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-cool-gray-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* 2. Multi-Frequency Delivery Schedules & Immediate Triggers */}
                  <div className="space-y-2.5 pt-2 border-t border-cool-gray-800">
                    <div>
                      <span className="text-xs font-semibold text-cool-gray-300 block">
                        Delivery Frequencies &amp; Triggers (Combine Any)
                      </span>
                      <span className="text-[11px] text-cool-gray-400">
                        You can enable Daily Digest, a Custom Schedule, and Immediate Alerts at the same time.
                      </span>
                    </div>

                    {/* A. Daily Digest */}
                    <div className="p-3 bg-cool-gray-950 border border-cool-gray-800 rounded-lg space-y-2.5">
                      <div className="text-xs font-bold text-cool-gray-200">Daily Digest</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="listDailyDigestMode"
                            checked={listDailyDigestMode === "none"}
                            onChange={() => setListDailyDigestMode("none")}
                          />
                          <span className="font-semibold text-cool-gray-300">Off</span>
                        </label>
                        <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="listDailyDigestMode"
                            checked={listDailyDigestMode === "combined"}
                            onChange={() => setListDailyDigestMode("combined")}
                          />
                          <span className="font-semibold text-cool-gray-200">Combined Digest</span>
                        </label>
                        <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="listDailyDigestMode"
                            checked={listDailyDigestMode === "separate"}
                            onChange={() => setListDailyDigestMode("separate")}
                          />
                          <span className="font-semibold text-cool-gray-200">Separate Notification</span>
                        </label>
                      </div>

                      {listDailyDigestMode !== "none" && configuredChannels.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="inline-flex items-center gap-2 text-[11px] text-cool-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={listDigestChannelOverrideEnabled}
                              onChange={(e) => setListDigestChannelOverrideEnabled(e.target.checked)}
                              className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500"
                            />
                            <span>Use specific channels only for Daily Digest</span>
                          </label>
                          {listDigestChannelOverrideEnabled && (
                            <div className="flex flex-wrap gap-2 pl-5">
                              {configuredChannels.map((ch) => (
                                <label key={ch.id} className="inline-flex items-center gap-1.5 text-[11px] text-cool-gray-300 bg-cool-gray-900 border border-cool-gray-800 px-2 py-1 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={listDigestChannelIds.includes(ch.id)}
                                    onChange={() => toggleChannelSelection(setListDigestChannelIds, ch.id)}
                                    className="w-3 h-3 rounded text-cyan-500"
                                  />
                                  <span>{ch.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* B. Custom Recurring Schedule */}
                    <div className="p-3 bg-cool-gray-950 border border-cool-gray-800 rounded-lg space-y-2.5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-cool-gray-200">
                        <input
                          type="checkbox"
                          checked={listCustomSchedEnabled}
                          onChange={(e) => setListCustomSchedEnabled(e.target.checked)}
                          className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500"
                        />
                        <span>Custom Schedule</span>
                      </label>

                      {listCustomSchedEnabled && (
                        <div className="space-y-2.5 pt-1 pl-5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                              <input
                                type="radio"
                                name="listCustomSchedCadence"
                                checked={listCustomSchedCadence === "daily"}
                                onChange={() => setListCustomSchedCadence("daily")}
                              />
                              <span className="font-semibold text-cool-gray-200">Daily Time</span>
                            </label>
                            <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                              <input
                                type="radio"
                                name="listCustomSchedCadence"
                                checked={listCustomSchedCadence === "weekly"}
                                onChange={() => setListCustomSchedCadence("weekly")}
                              />
                              <span className="font-semibold text-cool-gray-200">Weekly Days</span>
                            </label>
                            <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                              <input
                                type="radio"
                                name="listCustomSchedCadence"
                                checked={listCustomSchedCadence === "interval"}
                                onChange={() => setListCustomSchedCadence("interval")}
                              />
                              <span className="font-semibold text-cool-gray-200">Every N Hours</span>
                            </label>
                          </div>

                          {listCustomSchedCadence === "weekly" && (
                            <div className="flex flex-wrap gap-1.5">
                              {WEEKDAY_LABELS.map((dayLabel, dayIdx) => {
                                const active = listCustomSchedDays.includes(dayIdx);
                                return (
                                  <button
                                    key={dayLabel}
                                    type="button"
                                    onClick={() =>
                                      setListCustomSchedDays((prev) =>
                                        prev.includes(dayIdx)
                                          ? prev.length > 1
                                            ? prev.filter((d) => d !== dayIdx)
                                            : prev
                                          : [...prev, dayIdx].sort(),
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition cursor-pointer ${
                                      active
                                        ? "bg-cyan-600/30 border-cyan-500 text-cyan-200"
                                        : "bg-cool-gray-900 border-cool-gray-800 text-cool-gray-400 hover:text-white"
                                    }`}
                                  >
                                    {dayLabel}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {listCustomSchedCadence === "interval" ? (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-cool-gray-400">Check &amp; notify every</span>
                              <input
                                type="number"
                                min={1}
                                max={168}
                                value={listCustomSchedIntervalHours}
                                onChange={(e) =>
                                  setListCustomSchedIntervalHours(Math.max(1, Number(e.target.value) || 1))
                                }
                                className="w-20 bg-cool-gray-900 border border-cool-gray-800 rounded px-2.5 py-1 text-white tabular-nums focus:outline-none focus:border-cyan-500"
                              />
                              <span className="text-cool-gray-400">hour(s)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-cool-gray-400">Dispatch time</span>
                              <input
                                type="time"
                                value={listCustomSchedTime}
                                onChange={(e) => setListCustomSchedTime(e.target.value)}
                                className="bg-cool-gray-900 border border-cool-gray-800 rounded px-2.5 py-1 text-white font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          )}

                          {configuredChannels.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="inline-flex items-center gap-2 text-[11px] text-cool-gray-400 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={listCustomSchedChannelOverrideEnabled}
                                  onChange={(e) => setListCustomSchedChannelOverrideEnabled(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500"
                                />
                                <span>Use specific channels only for Custom Schedule</span>
                              </label>
                              {listCustomSchedChannelOverrideEnabled && (
                                <div className="flex flex-wrap gap-2 pl-5">
                                  {configuredChannels.map((ch) => (
                                    <label key={ch.id} className="inline-flex items-center gap-1.5 text-[11px] text-cool-gray-300 bg-cool-gray-900 border border-cool-gray-800 px-2 py-1 rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={listCustomSchedChannelIds.includes(ch.id)}
                                        onChange={() => toggleChannelSelection(setListCustomSchedChannelIds, ch.id)}
                                        className="w-3 h-3 rounded text-cyan-500"
                                      />
                                      <span>{ch.name}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* C. Immediate Event Alerts */}
                    <div className="p-3 bg-cool-gray-950 border border-cool-gray-800 rounded-lg space-y-2.5">
                      <div className="text-xs font-bold text-cool-gray-200">Immediate Alerts</div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-cool-gray-300">
                          <input
                            type="checkbox"
                            checked={listImmediateOnItemAdded}
                            onChange={(e) => setListImmediateOnItemAdded(e.target.checked)}
                            className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500"
                          />
                          <span>Send immediately when an item is added to this list</span>
                        </label>

                        {isInventoryControlled && (
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-cool-gray-300">
                            <input
                              type="checkbox"
                              checked={listImmediateOnThresholdBreach}
                              onChange={(e) => setListImmediateOnThresholdBreach(e.target.checked)}
                              className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500"
                            />
                            <span>Send immediately when an inventory threshold is breached</span>
                          </label>
                        )}
                      </div>

                      {(listImmediateOnItemAdded || (isInventoryControlled && listImmediateOnThresholdBreach)) &&
                        configuredChannels.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <label className="inline-flex items-center gap-2 text-[11px] text-cool-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={listImmediateChannelOverrideEnabled}
                                onChange={(e) => setListImmediateChannelOverrideEnabled(e.target.checked)}
                                className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500"
                              />
                              <span>Use specific channels only for Immediate Alerts (e.g., Email immediately, Digest elsewhere)</span>
                            </label>
                            {listImmediateChannelOverrideEnabled && (
                              <div className="flex flex-wrap gap-2 pl-5">
                                {configuredChannels.map((ch) => (
                                  <label key={ch.id} className="inline-flex items-center gap-1.5 text-[11px] text-cool-gray-300 bg-cool-gray-900 border border-cool-gray-800 px-2 py-1 rounded cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={listImmediateChannelIds.includes(ch.id)}
                                      onChange={() => toggleChannelSelection(setListImmediateChannelIds, ch.id)}
                                      className="w-3 h-3 rounded text-cyan-500"
                                    />
                                    <span>{ch.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* 3. Report Item Scope */}
                  <div className="space-y-1.5 pt-2 border-t border-cool-gray-800">
                    <label className="text-xs font-semibold text-cool-gray-300 block">
                      Included Items Scope (Digest &amp; Scheduled Reports)
                    </label>
                    <div className={`grid grid-cols-1 ${isInventoryControlled ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-2`}>
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="listNotificationType"
                          checked={listNotificationType === "all_items"}
                          onChange={() => setListNotificationType("all_items")}
                        />
                        <span className="font-semibold text-cool-gray-200">All Items</span>
                      </label>
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="listNotificationType"
                          checked={listNotificationType === "newly_added_only"}
                          onChange={() => setListNotificationType("newly_added_only")}
                        />
                        <span className="font-semibold text-cool-gray-200">Newly Added</span>
                      </label>
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="listNotificationType"
                          checked={listNotificationType === "item_specific"}
                          onChange={() => setListNotificationType("item_specific")}
                        />
                        <span className="font-semibold text-cool-gray-200">Item-Specific</span>
                      </label>
                      {isInventoryControlled && (
                        <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-800 rounded cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="listNotificationType"
                            checked={listNotificationType === "threshold_breaches"}
                            onChange={() => setListNotificationType("threshold_breaches")}
                          />
                          <span className="font-semibold text-cool-gray-200">Breached Only</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-semibold rounded-lg transition text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition text-xs cursor-pointer"
              >
                {editingListId ? "Save Settings" : "Create List"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* In-App Delete List Confirmation Modal */}
      {listToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setListToDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-cool-gray-850 border border-cool-gray-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete List?</h3>
            </div>
            <p className="text-xs text-cool-gray-300 leading-relaxed">
              Delete <strong className="text-white">"{listToDelete.name}"</strong>? List memberships and rule settings for this list will be removed.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => setListToDelete(null)}
                className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteList}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Delete List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ManageTagsProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  hideInternalHeader?: boolean;
  createRequestCount?: number;
  onStepChange?: (inDetailStep: boolean) => void;
}

export const ManageTags: React.FC<ManageTagsProps> = ({
  state,
  dispatch,
  hideInternalHeader = false,
  createRequestCount = 0,
  onStepChange,
}) => {
  const tags = state.tags || [];

  // Two-step Overview (null) -> Default Product Manager (tag id)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState("");
  const [showTagFilters, setShowTagFilters] = useState(false);
  const [tagRuleFilter, setTagRuleFilter] = useState<"all" | "exclude_restock" | "prioritize" | "standard">("all");
  const [tagSortBy, setTagSortBy] = useState<"default" | "name_asc" | "name_desc" | "cuts_desc" | "products_desc">("default");
  const [isFormVisible, setFormVisible] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagDesc, setTagDesc] = useState("");
  const [tagColor, setTagColor] = useState("#06b6d4");
  const [tagExcludeRestock, setTagExcludeRestock] = useState(false);
  const [tagPrioritizeItem, setTagPrioritizeItem] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [tagToDelete, setTagToDelete] = useState<{ id: string; name: string } | null>(null);

  const activeTag = useMemo(
    () => (selectedTagId ? tags.find((t) => t.id === selectedTagId) || null : null),
    [tags, selectedTagId],
  );

  const tagUsageStats = useMemo(() => {
    const cutsCounts: Record<string, number> = {};
    const productCounts: Record<string, number> = {};
    (state.meatCuts || []).forEach((mc) => {
      (mc.tagIds || []).forEach((tid) => {
        cutsCounts[tid] = (cutsCounts[tid] || 0) + 1;
      });
    });
    (state.products || []).forEach((p) => {
      (p.defaultTagIds || []).forEach((tid) => {
        productCounts[tid] = (productCounts[tid] || 0) + 1;
      });
    });
    return { cutsCounts, productCounts };
  }, [state.meatCuts, state.products]);

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    const filtered = tags.filter((tag) => {
      if (q) {
        const nameHit = (tag.name || "").toLowerCase().includes(q);
        const descHit = (tag.description || "").toLowerCase().includes(q);
        if (!nameHit && !descHit) return false;
      }
      if (tagRuleFilter === "exclude_restock" && !tag.excludeFromDisplayRestock) return false;
      if (tagRuleFilter === "prioritize" && !tag.prioritizeItem) return false;
      if (tagRuleFilter === "standard" && (tag.excludeFromDisplayRestock || tag.prioritizeItem)) return false;
      return true;
    });

    if (tagSortBy === "default") return filtered;

    return [...filtered].sort((a, b) => {
      if (tagSortBy === "name_asc") {
        return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (tagSortBy === "name_desc") {
        return (b.name || "").localeCompare(a.name || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (tagSortBy === "cuts_desc") {
        return (tagUsageStats.cutsCounts[b.id] || 0) - (tagUsageStats.cutsCounts[a.id] || 0);
      }
      if (tagSortBy === "products_desc") {
        return (tagUsageStats.productCounts[b.id] || 0) - (tagUsageStats.productCounts[a.id] || 0);
      }
      return 0;
    });
  }, [tags, tagSearch, tagRuleFilter, tagSortBy, tagUsageStats]);

  const activeTagFilterCount =
    (tagRuleFilter !== "all" ? 1 : 0) + (tagSortBy !== "default" ? 1 : 0);

  useEffect(() => {
    if (selectedTagId && !activeTag) {
      setSelectedTagId(null);
    }
  }, [selectedTagId, activeTag]);

  useEffect(() => {
    onStepChange?.(Boolean(activeTag));
    return () => {
      onStepChange?.(false);
    };
  }, [activeTag, onStepChange]);

  const presetColors = [
    { value: "#06b6d4", name: "Cyan" },
    { value: "#f43f5e", name: "Rose" },
    { value: "#10b981", name: "Green" },
    { value: "#f59e0b", name: "Amber" },
    { value: "#3b82f6", name: "Blue" },
    { value: "#a855f7", name: "Purple" },
    { value: "#f97316", name: "Orange" },
    { value: "#ec4899", name: "Pink" },
    { value: "#8b5cf6", name: "Indigo" },
    { value: "#64748b", name: "Slate" },
  ];

  const resetForm = () => {
    setFormVisible(false);
    setEditingTagId(null);
    setTagName("");
    setTagDesc("");
    setTagColor("#06b6d4");
    setTagExcludeRestock(false);
    setTagPrioritizeItem(false);
    setErrorMsg("");
  };

  const openCreateModal = () => {
    resetForm();
    setFormVisible(true);
  };

  const lastCreateCountRef = React.useRef(createRequestCount);
  useEffect(() => {
    if (createRequestCount > lastCreateCountRef.current) {
      lastCreateCountRef.current = createRequestCount;
      openCreateModal();
    }
  }, [createRequestCount]);

  const handleCreateOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!tagName.trim()) {
      setErrorMsg("Tag name is required.");
      return;
    }

    const cleanName = tagName.trim();
    const derivedId =
      editingTagId ||
      cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    if (!derivedId) {
      setErrorMsg("Valid tag ID could not be generated from the name.");
      return;
    }

    if (!editingTagId && tags.some((t) => t.id === derivedId)) {
      setErrorMsg(`A tag with ID "${derivedId}" already exists. Choose a different name.`);
      return;
    }

    if (editingTagId) {
      dispatch({
        type: "EDIT_TAG",
        payload: {
          tagId: editingTagId,
          updates: {
            name: cleanName,
            description: tagDesc.trim(),
            color: tagColor,
            excludeFromDisplayRestock: tagExcludeRestock,
            prioritizeItem: tagPrioritizeItem,
          },
        },
      });
    } else {
      dispatch({
        type: "ADD_TAG",
        payload: {
          tag: {
            id: derivedId,
            name: cleanName,
            description: tagDesc.trim(),
            color: tagColor,
            excludeFromDisplayRestock: tagExcludeRestock,
            prioritizeItem: tagPrioritizeItem,
          },
        },
      });
    }

    resetForm();
  };

  const startEdit = (tag: any) => {
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setTagDesc(tag.description || "");
    setTagColor(tag.color || "#06b6d4");
    setTagExcludeRestock(!!tag.excludeFromDisplayRestock);
    setTagPrioritizeItem(!!tag.prioritizeItem);
    setErrorMsg("");
    setFormVisible(true);
  };

  const confirmDeleteTag = () => {
    if (!tagToDelete) return;
    dispatch({
      type: "DELETE_TAG",
      payload: { tagId: tagToDelete.id },
    });
    if (selectedTagId === tagToDelete.id) {
      setSelectedTagId(null);
    }
    setTagToDelete(null);
  };

  return (
    <div className="font-sans space-y-4 text-cool-gray-100 pb-8">
      {!hideInternalHeader && !activeTag && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreateModal}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 transition text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Create Tag
          </button>
        </div>
      )}

      {!activeTag ? (
        /* STEP 1: TAGS OVERVIEW */
        <div className="space-y-3.5">
          <CatalogSearchFilterBar
            searchValue={tagSearch}
            onSearchChange={setTagSearch}
            searchPlaceholder="Search tags by name or description..."
            isFiltersOpen={showTagFilters}
            onToggleFilters={() => setShowTagFilters((prev) => !prev)}
            activeFilterCount={activeTagFilterCount}
            onResetFilters={() => {
              setTagSearch("");
              setTagRuleFilter("all");
              setTagSortBy("default");
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Behavior Rule
                </label>
                <select
                  value={tagRuleFilter}
                  onChange={(e) => setTagRuleFilter(e.target.value as any)}
                  className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Tags ({tags.length})</option>
                  <option value="exclude_restock">Excluded from Display Restock</option>
                  <option value="prioritize">Prioritize Item</option>
                  <option value="standard">Standard Label Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Sort Order
                </label>
                <select
                  value={tagSortBy}
                  onChange={(e) => setTagSortBy(e.target.value as any)}
                  className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="default">Saved Order</option>
                  <option value="name_asc">Name: A to Z</option>
                  <option value="name_desc">Name: Z to A</option>
                  <option value="cuts_desc">Most Tagged Cuts First</option>
                  <option value="products_desc">Most Default Products First</option>
                </select>
              </div>
            </div>
          </CatalogSearchFilterBar>

          {tags.length === 0 ? (
            <div className="bg-cool-gray-850/60 border border-cool-gray-750 rounded-xl p-10 text-center space-y-3">
              <TagIcon className="w-8 h-8 text-cool-gray-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">No Tags Configured</h3>
                <p className="text-xs text-cool-gray-400 max-w-md mx-auto">
                  Create custom labels to classify meat cuts, exclude reserve items from display restocking, or set pull priorities.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Create First Tag
              </button>
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="bg-cool-gray-850/50 border border-cool-gray-750 rounded-xl p-8 text-center space-y-2.5">
              <p className="text-sm font-semibold text-cool-gray-300">No tags match your search or filters.</p>
              <button
                type="button"
                onClick={() => {
                  setTagSearch("");
                  setTagRuleFilter("all");
                  setTagSortBy("default");
                }}
                className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cyan-300 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredTags.map((tag) => {
                const cutsCount = tagUsageStats.cutsCounts[tag.id] || 0;
                const defaultProdsCount = tagUsageStats.productCounts[tag.id] || 0;
                const iconPrefix = getTagActionIcon(tag);

                return (
                  <div
                    key={tag.id}
                    className="bg-cool-gray-850/75 border border-cool-gray-750 hover:border-cool-gray-600 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          style={{
                            color: tag.color || "#06b6d4",
                            borderColor: tag.color ? `${tag.color}40` : "#06b6d440",
                            backgroundColor: tag.color ? `${tag.color}20` : "#06b6d420",
                          }}
                          className="px-2.5 py-0.5 rounded text-xs font-bold border uppercase tracking-wider inline-flex items-center gap-1 truncate max-w-full"
                        >
                          {iconPrefix && <span>{iconPrefix}</span>}
                          <span className="truncate">{tag.name}</span>
                        </span>

                        {tag.excludeFromDisplayRestock && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                            Excluded from Display Restock
                          </span>
                        )}
                        {tag.prioritizeItem && (
                          <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-700/60 px-2 py-0.5 rounded">
                            Prioritize Item
                          </span>
                        )}
                      </div>

                      {tag.description ? (
                        <p className="text-xs text-cool-gray-300 leading-relaxed line-clamp-2">
                          {tag.description}
                        </p>
                      ) : (
                        <p className="text-xs text-cool-gray-500 italic">No description</p>
                      )}

                      <div className="text-[11px] text-cool-gray-400 font-medium tabular-nums">
                        {cutsCount} {cutsCount === 1 ? "cut" : "cuts"} · {defaultProdsCount}{" "}
                        {defaultProdsCount === 1 ? "default product" : "default products"}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => setSelectedTagId(tag.id)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5" /> Manage Products
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(tag)}
                        className="px-2.5 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-cyan-400" /> Edit Settings
                      </button>
                      <button
                        type="button"
                        onClick={() => setTagToDelete({ id: tag.id, name: tag.name })}
                        className="p-1.5 bg-cool-gray-800 hover:bg-rose-950/40 border border-cool-gray-700 hover:border-rose-500/40 text-cool-gray-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
                        title="Delete Tag"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* STEP 2: DEDICATED DEFAULT PRODUCT MANAGER */
        <div className="bg-cool-gray-850/75 border border-cool-gray-750 rounded-xl p-4 sm:p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-750">
            <div className="space-y-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedTagId(null)}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Tags
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  style={{
                    color: activeTag.color || "#06b6d4",
                    borderColor: activeTag.color ? `${activeTag.color}45` : "#06b6d445",
                    backgroundColor: activeTag.color ? `${activeTag.color}20` : "#06b6d420",
                  }}
                  className="px-2.5 py-0.5 rounded text-xs font-bold border uppercase tracking-wider inline-flex items-center gap-1"
                >
                  {getTagActionIcon(activeTag) && <span>{getTagActionIcon(activeTag)}</span>}
                  <span>{activeTag.name}</span>
                </span>
                {activeTag.excludeFromDisplayRestock && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                    Excluded from Display Restock
                  </span>
                )}
                {activeTag.prioritizeItem && (
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-700/60 px-2 py-0.5 rounded">
                    Prioritize Item
                  </span>
                )}
              </div>
              <p className="text-xs text-cool-gray-400">
                {activeTag.description
                  ? `${activeTag.description} · `
                  : ""}
                Products listed below automatically receive "{activeTag.name}" when added to inventory.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => startEdit(activeTag)}
                className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-cyan-400" /> Edit Settings
              </button>
              <button
                type="button"
                onClick={() => setTagToDelete({ id: activeTag.id, name: activeTag.name })}
                className="px-2.5 py-1.5 bg-cool-gray-800 hover:bg-rose-950/40 border border-cool-gray-700 hover:border-rose-500/40 text-cool-gray-400 hover:text-rose-300 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>

          <div className="max-w-xl space-y-1.5">
            <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
              Assign Default Tag to Product
            </label>
            {(() => {
              const availableProds = (state.products || []).filter(
                (p) => !(p.defaultTagIds || []).includes(activeTag.id),
              );
              if (availableProds.length === 0) {
                return (
                  <span className="text-xs text-cool-gray-500 font-medium block h-9 bg-cool-gray-950 border border-cool-gray-800 leading-[34px] px-3.5 rounded-md">
                    All catalog products already include this default tag.
                  </span>
                );
              }
              return (
                <SearchableProductSelect
                  products={availableProds}
                  value=""
                  onChange={(pid) => {
                    if (!pid) return;
                    const prod = state.products.find((p) => p.id === pid);
                    if (prod) {
                      const current = prod.defaultTagIds || [];
                      dispatch({
                        type: "EDIT_PRODUCT",
                        payload: {
                          productId: prod.id,
                          updates: { defaultTagIds: [...current, activeTag.id] },
                        },
                      });
                    }
                  }}
                  placeholder="Search product to assign default tag..."
                  includeArchived={true}
                />
              );
            })()}
          </div>

          {(() => {
            const assignedProds = (state.products || []).filter((p) =>
              (p.defaultTagIds || []).includes(activeTag.id),
            );
            if (assignedProds.length === 0) {
              return (
                <div className="text-center py-8 bg-cool-gray-900/40 rounded-xl border border-dashed border-cool-gray-800">
                  <p className="text-cool-gray-400 text-xs">
                    No products currently receive "{activeTag.name}" by default.
                  </p>
                </div>
              );
            }
            return (
              <div className="overflow-x-auto rounded-xl border border-cool-gray-750">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-cool-gray-900 text-cool-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-cool-gray-750">
                      <th className="py-2.5 px-3.5">Product Name</th>
                      <th className="py-2.5 px-3.5">Category</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cool-gray-800">
                    {assignedProds.map((p) => (
                      <tr key={p.id} className="hover:bg-cool-gray-900/35 transition-colors">
                        <td className="py-2.5 px-3.5 font-semibold text-cool-gray-100">{p.name}</td>
                        <td className="py-2.5 px-3.5 text-cool-gray-400">
                          {p.primaryCategory} &gt; {p.subCategory}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              dispatch({
                                type: "EDIT_PRODUCT",
                                payload: {
                                  productId: p.id,
                                  updates: {
                                    defaultTagIds: (p.defaultTagIds || []).filter(
                                      (id) => id !== activeTag.id,
                                    ),
                                  },
                                },
                              });
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded transition cursor-pointer"
                          >
                            Remove Default
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tag Configuration Modal */}
      {isFormVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={resetForm}
        >
          <form
            onSubmit={handleCreateOrEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-cool-gray-850 border border-cool-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="border-b border-cool-gray-750 pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingTagId ? "Edit Tag Settings" : "Create New Tag"}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-cool-gray-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 p-2.5 rounded-lg text-xs">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">Tag Display Name</label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. Reserve Stock, Prioritize, Sample"
                className="w-full px-3 py-2 text-xs bg-cool-gray-900 border border-cool-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">Description</label>
              <textarea
                value={tagDesc}
                onChange={(e) => setTagDesc(e.target.value)}
                placeholder="Describe when operators should apply this tag..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-cool-gray-900 border border-cool-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-cool-gray-300">Color Accent</label>
              <div className="grid grid-cols-5 gap-2">
                {presetColors.map((color) => {
                  const isSelected = tagColor === color.value;
                  return (
                    <button
                      type="button"
                      key={color.value}
                      onClick={() => setTagColor(color.value)}
                      style={{ backgroundColor: color.value }}
                      className={`h-7 rounded-md border transition flex items-center justify-center cursor-pointer ${
                        isSelected ? "border-white scale-105 shadow" : "border-transparent hover:scale-105"
                      }`}
                      title={color.name}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-cool-gray-950" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer bg-cool-gray-900 p-3 rounded-lg border border-cool-gray-750 hover:border-amber-500/40 transition">
                <input
                  type="checkbox"
                  checked={tagExcludeRestock}
                  onChange={(e) => setTagExcludeRestock(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-cool-gray-600 bg-cool-gray-800 text-amber-500 cursor-pointer"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <span className="block font-bold text-amber-300">
                    Exclude from Display Restock
                  </span>
                  <span className="block text-[11px] text-cool-gray-400 mt-0.5">
                    Tagged backstock will not count toward Display Case restock availability or alerts.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer bg-cool-gray-900 p-3 rounded-lg border border-cool-gray-750 hover:border-cyan-500/40 transition">
                <input
                  type="checkbox"
                  checked={tagPrioritizeItem}
                  onChange={(e) => setTagPrioritizeItem(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-cool-gray-600 bg-cool-gray-800 text-cyan-500 cursor-pointer"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <span className="block font-bold text-cyan-300">Prioritize Item</span>
                  <span className="block text-[11px] text-cool-gray-400 mt-0.5">
                    Push tagged cuts first during Display restock and removal flows.
                  </span>
                </div>
              </label>
            </div>

            <div className="bg-cool-gray-950 p-2.5 rounded-lg border border-cool-gray-800 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-cool-gray-400">Preview</span>
              <span
                style={{
                  color: tagColor,
                  borderColor: `${tagColor}40`,
                  backgroundColor: `${tagColor}18`,
                }}
                className="px-2.5 py-0.5 rounded text-xs font-bold border uppercase inline-flex items-center gap-1 max-w-[200px] truncate"
              >
                {getTagActionIcon({
                  excludeFromDisplayRestock: tagExcludeRestock,
                  prioritizeItem: tagPrioritizeItem,
                }) && (
                  <span>
                    {getTagActionIcon({
                      excludeFromDisplayRestock: tagExcludeRestock,
                      prioritizeItem: tagPrioritizeItem,
                    })}
                  </span>
                )}
                <span className="truncate">{tagName || "Tag Preview"}</span>
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition cursor-pointer"
              >
                {editingTagId ? "Save Changes" : "Create Tag"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* In-App Delete Tag Confirmation Modal */}
      {tagToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setTagToDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-cool-gray-850 border border-cool-gray-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Tag?</h3>
            </div>
            <p className="text-xs text-cool-gray-300 leading-relaxed">
              Delete <strong className="text-white">"{tagToDelete.name}"</strong>? This label will be stripped from all products and inventory cuts.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => setTagToDelete(null)}
                className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTag}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Delete Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ManageLocationsProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  hideInternalHeader?: boolean;
  createRequestCount?: number;
}

export const ManageLocations: React.FC<ManageLocationsProps> = ({
  state,
  dispatch,
  hideInternalHeader = false,
  createRequestCount = 0,
}) => {
  const locations = state.locations || [];
  
  const [confirmDeleteLocId, setConfirmDeleteLocId] = useState<string | null>(null);
  const [expandedLocContents, setExpandedLocContents] = useState<Record<string, boolean>>({});
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLocationFilters, setShowLocationFilters] = useState(false);
  const [locationTypeFilter, setLocationTypeFilter] = useState<"all" | "home" | "storage" | "delivery_pickup">("all");
  const [locationSortBy, setLocationSortBy] = useState<"default" | "name_asc" | "name_desc" | "offsite_desc">("default");
  
  // Form states
  const [isFormVisible, setFormVisible] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locContact, setLocContact] = useState("");
  const [locNotes, setLocNotes] = useState("");
  const [locType, setLocType] = useState<'storage' | 'delivery_pickup'>("storage");
  const [isHome, setIsHome] = useState(false);
  const [locHasPallets, setLocHasPallets] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [renamePalletModal, setRenamePalletModal] = useState<{ isOpen: boolean; oldName: string; newName: string } | null>(null);

  const handleRenamePallet = async () => {
    if (!renamePalletModal || !renamePalletModal.newName.trim() || renamePalletModal.newName === renamePalletModal.oldName) return;
    await dispatch({
      type: 'RENAME_PALLET',
      payload: {
        oldName: renamePalletModal.oldName,
        newName: renamePalletModal.newName
      }
    });
    setRenamePalletModal(null);
  };

  const resetForm = () => {
    setEditingLocId(null);
    setLocName("");
    setLocAddress("");
    setLocContact("");
    setLocNotes("");
    setLocType("storage");
    setIsHome(false);
    setLocHasPallets(true);
    setErrorMsg("");
    setFormVisible(false);
  };

  const lastLocCreateRef = React.useRef(createRequestCount);
  useEffect(() => {
    if (createRequestCount > lastLocCreateRef.current) {
      lastLocCreateRef.current = createRequestCount;
      setEditingLocId(null);
      setLocName("");
      setLocAddress("");
      setLocContact("");
      setLocNotes("");
      setLocType("storage");
      setIsHome(false);
      setLocHasPallets(true);
      setErrorMsg("");
      setFormVisible(true);
    }
  }, [createRequestCount]);

  const handleEditClick = (loc: any) => {
    setEditingLocId(loc.id);
    setLocName(loc.name);
    setLocAddress(loc.address || "");
    setLocContact(loc.contact || "");
    setLocNotes(loc.notes || "");
    setLocType(loc.type);
    setIsHome(!!loc.isHome);
    setLocHasPallets(true);
    setErrorMsg("");
    setFormVisible(true);
  };

  const handleCreateOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!locName.trim()) {
      setErrorMsg("Location name is required.");
      return;
    }

    const cleanName = locName.trim();

    if (editingLocId) {
      dispatch({
        type: "EDIT_LOCATION",
        payload: {
          locationId: editingLocId,
          updates: {
            name: cleanName,
            address: locAddress.trim(),
            contact: locContact.trim(),
            notes: locNotes.trim(),
            type: locType,
            isHome: isHome,
            hasPallets: true
          }
        }
      });
    } else {
      dispatch({
        type: "ADD_LOCATION",
        payload: {
          name: cleanName,
          address: locAddress.trim(),
          contact: locContact.trim(),
          notes: locNotes.trim(),
          type: locType,
          isHome: isHome,
          hasPallets: true
        }
      });
    }

    resetForm();
  };

  const handleSetHome = (id: string) => {
    dispatch({
      type: "SET_HOME_LOCATION",
      payload: { locationId: id }
    });
  };

  // Stats for Home summary
  const freezerCount = state.freezers?.filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived)?.length || 0;
  const containerCount = state.containers?.filter(c => c.freezerId && !c.isArchived)?.length || 0;
  const totalCutsOnSite = state.meatCuts?.reduce((acc, mc) => acc + (mc.quantity || 0), 0) || 0;

  const offsiteWeightByLocId = useMemo(() => {
    const map: Record<string, number> = {};
    locations.forEach((loc) => {
      const entries = (state.offSiteEntries || []).filter((e) => {
        const isArchived = e.archived === true || e.archived === 1 || String(e.archived) === 'true';
        if (isArchived) return false;
        if (e.box && state.containers?.some(c => c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
          return false;
        }
        if (e.storageLocationId && e.storageLocationId === loc.id) return true;
        const locNameLower = loc.name.trim().toLowerCase();
        if (e.location && e.location.trim().toLowerCase() === locNameLower) return true;
        return false;
      });
      map[loc.id] = entries.reduce((sum, e) => sum + (e.netWeight || 0), 0);
    });
    return map;
  }, [locations, state.offSiteEntries, state.containers]);

  const filteredLocations = useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    const filtered = locations.filter((loc) => {
      if (q) {
        const haystack = [loc.name, loc.address, loc.contact, loc.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (locationTypeFilter === "home" && !loc.isHome) return false;
      if (locationTypeFilter === "storage" && loc.type !== "storage") return false;
      if (locationTypeFilter === "delivery_pickup" && loc.type !== "delivery_pickup") return false;
      return true;
    });

    if (locationSortBy === "default") return filtered;

    return [...filtered].sort((a, b) => {
      if (locationSortBy === "name_asc") {
        return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (locationSortBy === "name_desc") {
        return (b.name || "").localeCompare(a.name || "", undefined, { numeric: true, sensitivity: "base" });
      }
      if (locationSortBy === "offsite_desc") {
        return (offsiteWeightByLocId[b.id] || 0) - (offsiteWeightByLocId[a.id] || 0);
      }
      return 0;
    });
  }, [locations, locationSearch, locationTypeFilter, locationSortBy, offsiteWeightByLocId]);

  const activeLocationFilterCount =
    (locationTypeFilter !== "all" ? 1 : 0) + (locationSortBy !== "default" ? 1 : 0);

  return (
    <div className="space-y-3.5">
      {!hideInternalHeader && (
        <div className="flex justify-between items-center bg-cool-gray-850/40 p-3.5 rounded-xl border border-cool-gray-750/35">
          <div>
            <h3 className="text-base font-bold text-cool-gray-100 flex items-center gap-2">
              Manage Storage &amp; Delivery Locations
            </h3>
            <p className="text-xs text-cool-gray-400 mt-0.5">
              Configure on-site home premises, warehousing units, restaurants, packers or butchers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setFormVisible(true);
            }}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add Location
          </button>
        </div>
      )}

      {locationNotice && (
        <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-200 flex items-center justify-between gap-2">
          <span>{locationNotice}</span>
          <button
            type="button"
            onClick={() => setLocationNotice(null)}
            className="text-amber-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <CatalogSearchFilterBar
        searchValue={locationSearch}
        onSearchChange={setLocationSearch}
        searchPlaceholder="Search locations by name, address, contact, or notes..."
        isFiltersOpen={showLocationFilters}
        onToggleFilters={() => setShowLocationFilters((prev) => !prev)}
        activeFilterCount={activeLocationFilterCount}
        onResetFilters={() => {
          setLocationSearch("");
          setLocationTypeFilter("all");
          setLocationSortBy("default");
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
              Location Type
            </label>
            <select
              value={locationTypeFilter}
              onChange={(e) => setLocationTypeFilter(e.target.value as any)}
              className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Locations ({locations.length})</option>
              <option value="home">Home Base Only</option>
              <option value="storage">Storage Room</option>
              <option value="delivery_pickup">Delivery &amp; Receiving</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
              Sort Order
            </label>
            <select
              value={locationSortBy}
              onChange={(e) => setLocationSortBy(e.target.value as any)}
              className="w-full h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="default">Saved Order</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
              <option value="offsite_desc">Most Stored Weight First</option>
            </select>
          </div>
        </div>
      </CatalogSearchFilterBar>

      {locations.length === 0 ? (
        <div className="bg-cool-gray-850/60 border border-cool-gray-750 rounded-xl p-8 text-center space-y-2.5">
          <MapPin className="mx-auto w-8 h-8 text-cool-gray-500" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No Locations Configured</h3>
            <p className="text-xs text-cool-gray-400 max-w-md mx-auto">
              Register storage facilities, cold warehouses, butchers, or delivery partners.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setFormVisible(true);
            }}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add First Location
          </button>
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="bg-cool-gray-850/50 border border-cool-gray-750 rounded-xl p-8 text-center space-y-2.5">
          <p className="text-sm font-semibold text-cool-gray-300">No locations match your search or filters.</p>
          <button
            type="button"
            onClick={() => {
              setLocationSearch("");
              setLocationTypeFilter("all");
              setLocationSortBy("default");
            }}
            className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cyan-300 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredLocations.map((loc) => {
            const offsiteEntriesForLoc =
              state.offSiteEntries?.filter((e) => {
                const isArchived = e.archived === true || e.archived === 1 || String(e.archived) === "true";
                if (isArchived) return false;
                if (
                  e.box &&
                  state.containers?.some(
                    (c) => c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim(),
                  )
                ) {
                  return false;
                }
                if (e.storageLocationId && e.storageLocationId === loc.id) return true;
                const locNameLower = loc.name.trim().toLowerCase();
                if (e.location && e.location.trim().toLowerCase() === locNameLower) return true;
                return false;
              }) || [];

            const totalOffsiteCuts = offsiteEntriesForLoc.length;
            const totalOffsiteWeight = offsiteEntriesForLoc.reduce((acc, e) => acc + (e.netWeight || 0), 0);

            const uniquePallets = new Set(
              offsiteEntriesForLoc
                .map((e) => (e.pallet || e.currentLocation || "").trim())
                .filter(
                  (p) =>
                    p &&
                    p.toLowerCase() !== "home" &&
                    !p.toLowerCase().includes("loose") &&
                    p.toLowerCase() !== "unassigned" &&
                    p.toLowerCase() !== "none",
                ),
            );
            const palletCount = uniquePallets.size;
            const isManifestExpanded = !!expandedLocContents[loc.id];

            return (
              <div
                key={loc.id}
                className={`rounded-xl border p-3.5 sm:p-4 transition ${
                  loc.isHome
                    ? "bg-cool-gray-850/90 border-cyan-500/70 shadow-sm"
                    : "bg-cool-gray-850/75 border-cool-gray-750 hover:border-cool-gray-600"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Identity, inline details & compact stats */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-white truncate max-w-full">{loc.name}</h4>
                      {loc.isHome && (
                        <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1">
                          <Home className="w-2.5 h-2.5" /> Home Base
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded select-none border ${
                          loc.type === "storage"
                            ? "bg-indigo-950/60 text-indigo-300 border-indigo-500/30"
                            : "bg-teal-950/60 text-teal-300 border-teal-500/30"
                        }`}
                      >
                        {loc.type === "storage" ? "Storage Room" : "Delivery & Receiving"}
                      </span>
                    </div>

                    {(loc.address || loc.contact || loc.notes) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cool-gray-300">
                        {loc.address && (
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-cool-gray-400" />
                            <span className="truncate max-w-md">{loc.address}</span>
                          </span>
                        )}
                        {loc.contact && (
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <Phone className="w-3.5 h-3.5 shrink-0 text-cool-gray-400" />
                            <span className="truncate max-w-xs">{loc.contact}</span>
                          </span>
                        )}
                        {loc.notes && (
                          <span
                            className="text-cool-gray-400 italic truncate max-w-md"
                            title={loc.notes}
                          >
                            Note: {loc.notes}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium tabular-nums text-cool-gray-400">
                      {loc.isHome ? (
                        <>
                          <span className="text-cyan-300 font-semibold">
                            {freezerCount} {freezerCount === 1 ? "freezer" : "freezers"}
                          </span>
                          <span>·</span>
                          <span>
                            {containerCount} {containerCount === 1 ? "container" : "containers"}
                          </span>
                          <span>·</span>
                          <span>{totalCutsOnSite} on-site cuts</span>
                        </>
                      ) : (
                        <>
                          <span className="text-indigo-300 font-semibold">
                            {palletCount} {palletCount === 1 ? "pallet" : "pallets"}
                          </span>
                          <span>·</span>
                          <span>
                            {totalOffsiteCuts} {totalOffsiteCuts === 1 ? "item" : "items"}
                          </span>
                          <span>·</span>
                          <span className="text-cool-gray-200 font-semibold">
                            {totalOffsiteWeight.toFixed(1)} lbs
                          </span>
                          {totalOffsiteCuts > 0 && (
                            <>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLocContents((prev) => ({
                                    ...prev,
                                    [loc.id]: !prev[loc.id],
                                  }))
                                }
                                className="text-indigo-300 hover:text-indigo-200 font-semibold underline underline-offset-2 cursor-pointer"
                              >
                                {isManifestExpanded ? "Hide Manifest" : "View Manifest"}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                    {!loc.isHome && (
                      <button
                        type="button"
                        onClick={() => handleSetHome(loc.id)}
                        className="px-2.5 py-1.5 bg-cool-gray-800 hover:bg-cyan-950/50 border border-cool-gray-700 hover:border-cyan-500/40 text-cyan-300 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Home className="w-3.5 h-3.5" /> Set as Home
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleEditClick(loc)}
                      className="px-2.5 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3 text-cyan-400" /> Edit Settings
                    </button>

                    {!loc.isHome && (
                      confirmDeleteLocId === loc.id ? (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <button
                            type="button"
                            onClick={() => {
                              dispatch({
                                type: "DELETE_LOCATION",
                                payload: { locationId: loc.id },
                              });
                              setConfirmDeleteLocId(null);
                            }}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                            title="Confirm permanently deleting this location"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteLocId(null)}
                            className="px-2 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-300 text-xs font-semibold rounded-lg cursor-pointer transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const l = locations.find((x) => x.id === loc.id);
                            if (l && l.isHome) {
                              setLocationNotice(
                                "Cannot delete the active Home location. Set another location as Home first.",
                              );
                              return;
                            }
                            setLocationNotice(null);
                            setConfirmDeleteLocId(loc.id);
                          }}
                          className="p-1.5 bg-cool-gray-800 hover:bg-rose-950/40 border border-cool-gray-700 hover:border-rose-500/40 text-cool-gray-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
                          title="Delete Location"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Expandable Stored Offsite Contents Manifest */}
                {!loc.isHome && isManifestExpanded && totalOffsiteCuts > 0 && (
                  <div className="mt-3 pt-3 border-t border-cool-gray-750/70 grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto">
                    {Array.from(uniquePallets).map((pName) => {
                      const palletCuts = offsiteEntriesForLoc.filter(
                        (e) => (e.pallet || e.currentLocation || "").trim() === pName,
                      );
                      const palletWeight = palletCuts.reduce((sum, e) => sum + (e.netWeight || 0), 0);
                      return (
                        <div
                          key={pName}
                          className="bg-cool-gray-900/60 border border-cool-gray-800 rounded-lg p-2.5 space-y-1.5 text-[11px]"
                        >
                          <div className="flex items-center justify-between font-bold text-cool-gray-200 border-b border-cool-gray-800 pb-1 group">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate">📦 {pName}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamePalletModal({ isOpen: true, oldName: pName, newName: pName });
                                }}
                                className="opacity-60 group-hover:opacity-100 p-0.5 text-cool-gray-400 hover:text-amber-400 transition rounded hover:bg-cool-gray-800 cursor-pointer"
                                title="Rename Pallet"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                            <span className="text-[10px] text-cyan-400 font-semibold shrink-0 tabular-nums">
                              {palletCuts.length} cuts · {palletWeight.toFixed(1)} lbs
                            </span>
                          </div>
                          <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                            {palletCuts.map((e) => {
                              const cutLabel =
                                state.products?.find((p: any) => p.id === e.productId)?.name ||
                                e.originalCutName;
                              return (
                                <div
                                  key={e.id}
                                  className="flex justify-between items-center gap-2 text-xs font-mono py-0.5"
                                >
                                  <span className="truncate text-cool-gray-300" title={cutLabel}>
                                    {cutLabel}
                                  </span>
                                  <span className="text-cyan-400 shrink-0 font-bold tabular-nums">
                                    {e.netWeight.toFixed(1)} lbs
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Location Modal */}
      {isFormVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={resetForm}
        >
          <form
            onSubmit={handleCreateOrEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-cool-gray-850 border border-cool-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-3.5 animate-scale-up"
          >
            <div className="border-b border-cool-gray-750 pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingLocId ? "Edit Location Settings" : "Add New Location"}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-cool-gray-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">Location Name</label>
              <input
                type="text"
                required
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
                placeholder="e.g. Cold Storage Pallets, Big Sky Sizzler"
                className="w-full px-3 py-2 text-xs bg-cool-gray-900 border border-cool-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">Type of Facility</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLocType("storage")}
                  className={`p-2.5 border rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 select-none cursor-pointer ${
                    locType === "storage"
                      ? "bg-indigo-950/40 border-indigo-500 text-indigo-300"
                      : "bg-cool-gray-900 border-cool-gray-700 text-cool-gray-400 hover:text-white"
                  }`}
                >
                  <Warehouse className="w-4 h-4" />
                  <span>Storage Room</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocType("delivery_pickup")}
                  className={`p-2.5 border rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 select-none cursor-pointer ${
                    locType === "delivery_pickup"
                      ? "bg-teal-950/40 border-teal-500 text-teal-300"
                      : "bg-cool-gray-900 border-cool-gray-700 text-cool-gray-400 hover:text-white"
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Delivery &amp; Receiving</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-300">Contact Information</label>
                <input
                  type="text"
                  value={locContact}
                  onChange={(e) => setLocContact(e.target.value)}
                  placeholder="Manager / Phone / Email..."
                  className="w-full px-3 py-2 text-xs bg-cool-gray-900 border border-cool-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-300">Address</label>
                <input
                  type="text"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  placeholder="Street address..."
                  className="w-full px-3 py-2 text-xs bg-cool-gray-900 border border-cool-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">General Notes</label>
              <textarea
                value={locNotes}
                onChange={(e) => setLocNotes(e.target.value)}
                placeholder="Access codes, dock requirements, delivery timetables..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-cool-gray-900 border border-cool-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-white resize-none"
              />
            </div>

            {!editingLocId && (
              <label className="flex items-start gap-2.5 cursor-pointer bg-cool-gray-900 p-3 rounded-lg border border-cool-gray-750">
                <input
                  type="checkbox"
                  checked={isHome}
                  onChange={(e) => setIsHome(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-cool-gray-600 bg-cool-gray-800 text-cyan-500 cursor-pointer"
                />
                <div className="text-xs leading-snug">
                  <span className="font-bold text-cool-gray-200 block">Set as Active Home Base</span>
                  <span className="text-[11px] text-cool-gray-400 block mt-0.5">
                    Route your on-site freezer storage dashboard under this location.
                  </span>
                </div>
              </label>
            )}

            <div className="pt-2 border-t border-cool-gray-750 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-cool-gray-800 border border-cool-gray-700 rounded-lg text-cool-gray-300 text-xs font-semibold hover:bg-cool-gray-750 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                {editingLocId ? "Save Changes" : "Create Location"}
              </button>
            </div>
          </form>
        </div>
      )}

      {renamePalletModal?.isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          onClick={() => setRenamePalletModal(null)}
        >
          <div
            className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">Rename Pallet</h3>
            <p className="text-sm text-cool-gray-400 mb-4">
              Renaming <span className="font-mono text-amber-400">{renamePalletModal.oldName}</span> will update all existing off-site items and movement targets using this pallet.
            </p>
            <input
              type="text"
              value={renamePalletModal.newName || ""}
              onChange={(e) => setRenamePalletModal({ ...renamePalletModal, newName: e.target.value })}
              className="w-full bg-cool-gray-950 border border-cool-gray-800 rounded-xl p-3 text-white mb-6 focus:border-amber-500 focus:outline-none"
              placeholder="New Pallet Name"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRenamePalletModal(null)}
                className="px-4 py-2 rounded-xl text-cool-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenamePallet}
                disabled={!renamePalletModal.newName.trim() || renamePalletModal.newName === renamePalletModal.oldName}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryView;
