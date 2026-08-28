import React, { useState, useMemo, useEffect } from "react";
import { getApiUrl } from "../hooks/apiUrl";
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
import { ManagementForms, ManageFreezers } from "../components/ManagementForms";
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
  History,
  Table,
  Sliders
} from "lucide-react";

type LibraryTab = "products" | "containers" | "freezers" | "pallets" | "lists" | "settings" | "import" | "tags" | "locations" | "photos";

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

const LibraryView: React.FC<{
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  openModal: (modal: ModalType) => void;
  navigateToFreezer: (containerId: string) => void;
  initialTab?: LibraryTab;
  theme?: string;
  onThemeChange?: (newTheme: string) => void;
  onNavigateToView?: (view: any) => void;
}> = ({
  state,
  dispatch,
  openModal,
  navigateToFreezer,
  initialTab,
  theme: parentTheme,
  onThemeChange,
  onNavigateToView,
}) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab || "products");
  const [productArchiveFilter, setProductArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [localTheme, setLocalThemeState] = useState<string>(
    () => localStorage.getItem("freezer-theme") || "dark",
  );

  const [defaultFromName, setDefaultFromName] = useState(() => localStorage.getItem("report-from-name") || "");
  const [defaultFromAddress, setDefaultFromAddress] = useState(() => localStorage.getItem("report-from-address") || "");
  const [theoreticalBoxWeight, setTheoreticalBoxWeight] = useState<number>(() => {
    const val = localStorage.getItem("offsite-theoretical-box-weight");
    return val ? parseFloat(val) : 40;
  });

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
    "name_asc" | "name_desc" | "stock_asc" | "stock_desc" | "understock"
  >("name_asc");
  const [stockLocationFilter, setStockLocationFilter] = useState<
    "all" | "onsite" | "offsite" | "both" | "instock" | "out_of_stock"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("all");
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
  const [bulkDefaultTagIds, setBulkDefaultTagIds] = useState<string[]>([]);
  const [bulkDefaultTagsMode, setBulkDefaultTagsMode] = useState<'append' | 'replace'>('append');
  const [bulkModifyTags, setBulkModifyTags] = useState<boolean>(false);

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

  const offSiteWeightMap = useMemo(() => {
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

    if (searchWords.length > 0) {
      productsToGroup = productsToGroup.filter((p) => {
        const nameLower = p.name.toLowerCase();
        const primaryLower = (
          p.primaryCategory || "Uncategorized"
        ).toLowerCase();
        const subLower = (p.subCategory || "General").toLowerCase();
        return searchWords.every(
          (word) =>
            nameLower.includes(word) ||
            primaryLower.includes(word) ||
            subLower.includes(word) ||
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
  }, [state.products, searchTerm, productArchiveFilter, categoryFilter, subCategoryFilter, stockLocationFilter, currentQuantityMap, offSiteQuantityMap, offSiteWeightMap]);

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
                case "name_asc":
                default:
                  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
              }
            });

            sortedMap[primary][sub] = productsList;
          });
      });

    return sortedMap;
  }, [categoriesMap, sortBy, currentQuantityMap, offSiteQuantityMap, offSiteWeightMap, state.customLists]);

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
    if (!bulkProductPrimary.trim() && !bulkProductSub.trim() && !bulkModifyTags) {
      alert('Please specify at least a Category update or enable Default Tag modifications.');
      return;
    }
    const updates: { 
      primaryCategory?: string; 
      subCategory?: string; 
      defaultTagIds?: string[]; 
      defaultTagsMode?: 'append' | 'replace' 
    } = {};
    if (bulkProductPrimary.trim()) updates.primaryCategory = bulkProductPrimary.trim();
    if (bulkProductSub.trim()) updates.subCategory = bulkProductSub.trim();
    
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
    setBulkDefaultTagIds([]);
    setBulkDefaultTagsMode('append');
    setBulkModifyTags(false);
  };

  const handleProductBulkCancel = () => {
    setIsProductBulkEditOpen(false);
    setBulkProductPrimary('');
    setBulkProductSub('');
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

    // Exclude the internal loose container layout if necessary and exclude off-site boxes
    list = list.filter(
      (c) => c.id !== "staging_loose" && !c.id.endsWith("_loose") && !c.isArchived && !c.isBox && !c.id.startsWith("box-"),
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
      c.id !== "staging_loose" && !c.id.endsWith("_loose") && !c.isBox && !c.id.startsWith("box-")
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
      c.id !== "staging_loose" && !c.id.endsWith("_loose") && !c.isBox && !c.id.startsWith("box-")
    );
    const nonArchivedActive = activeContainers.filter(c => !c.isArchived);

    return (
      <div className="space-y-4 mt-4 font-sans">
        {/* Container Catalog Sub-Tabs Navigation */}
        <div className="flex items-center justify-between border-b border-cool-gray-700/80 pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-1.5 bg-cool-gray-850 p-1 rounded-xl border border-cool-gray-750">
            <button
              type="button"
              onClick={() => setContainerSubTab('templates')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                containerSubTab === 'templates'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-800'
              }`}
            >
              📋 Container Templates ({templates.length})
            </button>
            <button
              type="button"
              onClick={() => setContainerSubTab('active')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                containerSubTab === 'active'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-800'
              }`}
            >
              📦 Active Containers ({nonArchivedActive.length})
            </button>
          </div>

          {containerSubTab === 'templates' && (
            <button
              type="button"
              onClick={() => {
                setTemplateNameInput('');
                setTemplateImageInput('');
                setShowAddTemplateModal(true);
              }}
              className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition shadow flex items-center gap-1.5 cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" /> Add Template to Catalog
            </button>
          )}
        </div>

        {/* SUB-TAB 1: TEMPLATES CATALOG */}
        {containerSubTab === 'templates' && (
          <div className="space-y-4">
            <div className="bg-cool-gray-850/60 p-3.5 rounded-xl border border-cool-gray-750/70 text-xs text-cool-gray-300 flex items-center justify-between gap-2">
              <p>
                📋 <strong>Container Templates Catalog:</strong> Templates store reusable container definitions (e.g. Purple Basket, Meat Toter, 1/2 Sheet Pan, Bag). Active containers created from a template inherit properties and stay linked so updates apply automatically.
              </p>
            </div>

            {/* Template Catalog Query Filters Bar */}
            {templates.length > 0 && (
              <div className="bg-cool-gray-850/65 rounded-xl border border-cool-gray-750/70 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-cool-gray-750/40">
                  <h4 className="text-xs font-extrabold text-cool-gray-400 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4 text-cyan-400"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.408 1.307-1.037 1.574l-2.25.95a.75.75 0 01-1.037-.696v-4.865a2.25 2.25 0 00-.659-1.59L3.288 6.22a2.25 2.25 0 01-.659-1.59V2.34a.75.75 0 01.628-.74z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Template Catalog Filters & Sort
                  </h4>
                  <span className="text-xs font-bold text-cool-gray-300">
                    Matching: <span className="text-cyan-400 font-black">{filteredTemplates.length}</span> / {templates.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Usage Filter */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                      Active Usage
                    </label>
                    <select
                      value={templateUsageFilter}
                      onChange={(e) => setTemplateUsageFilter(e.target.value as any)}
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-sans"
                    >
                      <option value="all">All Templates</option>
                      <option value="in_use">In Use ({templates.filter(t => nonArchivedActive.some(c => c.templateId === t.id || c.name.toLowerCase().trim() === t.name.toLowerCase().trim())).length})</option>
                      <option value="unused">Unused ({templates.filter(t => !nonArchivedActive.some(c => c.templateId === t.id || c.name.toLowerCase().trim() === t.name.toLowerCase().trim())).length})</option>
                    </select>
                  </div>

                  {/* Photo/Image Filter */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                      Photo Asset
                    </label>
                    <select
                      value={templateImageFilter}
                      onChange={(e) => setTemplateImageFilter(e.target.value as any)}
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-sans"
                    >
                      <option value="all">All Templates</option>
                      <option value="has_image">Has Custom Photo</option>
                      <option value="no_image">No Photo Attached</option>
                    </select>
                  </div>

                  {/* Sorting */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                      Sort Order
                    </label>
                    <select
                      value={templateSortBy}
                      onChange={(e) => setTemplateSortBy(e.target.value as any)}
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-sans"
                    >
                      <option value="name_asc">Name: A to Z</option>
                      <option value="name_desc">Name: Z to A</option>
                      <option value="usage_desc">Most Active Containers First</option>
                      <option value="usage_asc">Least Active Containers First</option>
                      <option value="newest">Recently Added First</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

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
    return (
      <div className="space-y-4 mt-4">
        {/* Filter & Sorting Controls Card */}
        <div className="bg-cool-gray-850/65 rounded-xl border border-cool-gray-750/70 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-cool-gray-750/40">
            <h4 className="text-xs font-extrabold text-cool-gray-400 uppercase tracking-wider flex items-center gap-1.5 select-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-cyan-400"
              >
                <path
                  fillRule="evenodd"
                  d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.408 1.307-1.037 1.574l-2.25.95a.75.75 0 01-1.037-.696v-4.865a2.25 2.25 0 00-.659-1.59L3.288 6.22a2.25 2.25 0 01-.659-1.59V2.34a.75.75 0 01.628-.74z"
                  clipRule="evenodd"
                />
              </svg>
              Catalog Query Filters & Arrangement
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAllMatched}
                className="text-[11px] px-2.5 py-1 bg-cyan-950/45 hover:bg-cyan-900/40 text-cyan-300 rounded font-bold border border-cyan-800/35 transition-all select-none cursor-pointer"
                title="Select all active filtered containers"
              >
                Select All Matching ({filteredContainers.length})
              </button>
              {selectedCount > 0 && (
                <button
                  onClick={handleDeselectAll}
                  className="text-[11px] px-2.5 py-1 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-300 rounded font-semibold border border-cool-gray-700 transition-all select-none cursor-pointer"
                >
                  Deselect All ({selectedCount})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Status Filter */}
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
                className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-sans"
              >
                <option value="all">All Statuses</option>
                <option value="placed">Active Placements Only</option>
                <option value="templates">Spare Blueprints Only</option>
              </select>
            </div>

            {/* Container type / behavior filter */}
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
                className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-sans"
              >
                <option value="all">All Containers</option>
                <option value="from_template">📋 From Template</option>
                <option value="retire_on_empty">🗑️ Retire on Empty</option>
              </select>
            </div>

            {/* Location filter */}
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
                className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-sans"
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

            {/* Sorting */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Arrangement Sort
              </label>
              <select
                value={containerSortBy}
                onChange={(e) => setContainerSortBy(e.target.value as any)}
                className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-sans"
              >
                <option value="name_asc">Name: A to Z</option>
                <option value="name_desc">Name: Z to A</option>
                <option value="items_desc">Contents Size: High to Low</option>
                <option value="items_asc">Contents Size: Low to High</option>
                <option value="location_asc">Freezer Placement Group</option>
              </select>
            </div>
          </div>
        </div>

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
            <div className="text-center py-12 bg-cool-gray-900/10 rounded-xl border-2 border-dashed border-cool-gray-800 mt-4">
              <p className="text-cool-gray-400 text-sm">
                No products found. Click "+ Product" to create one.
              </p>
            </div>
          );
        }

        if (Object.keys(sortedCategoriesMap).length === 0) {
          return (
            <div className="text-center py-12 bg-cool-gray-900/10 rounded-xl border-2 border-dashed border-cool-gray-800 mt-4">
              <p className="text-cool-gray-400 text-sm">
                No products or categories found matching your search.
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-4 mt-4">
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

            {/* Tool controls & Multi-Filter Bar */}
            <div className="space-y-2.5 bg-cool-gray-850/50 p-3 rounded-xl border border-cool-gray-750/60 text-xs">
              {/* Category, Subcategory & Stock Location Filter Row */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-grow">
                  {/* Unified Category / Subcategory Filter */}
                  <div className="flex items-center gap-1.5 bg-cool-gray-900 border border-cool-gray-700/70 rounded-lg px-2.5 py-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider">Category / Subcategory:</span>
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
                      className="bg-transparent text-white font-semibold outline-none text-xs cursor-pointer max-w-[280px] sm:max-w-[340px]"
                    >
                      <option value="all" className="bg-cool-gray-900 text-white font-bold">
                        📁 All Categories &amp; Subcategories
                      </option>
                      {availableCategoryHierarchy.map(({ primary, subs }) => (
                        <optgroup key={primary} label={primary} className="bg-cool-gray-900 text-cyan-400 font-bold">
                          <option value={`cat:${primary}`} className="bg-cool-gray-900 text-white font-bold">
                            📁 {primary} (All)
                          </option>
                          {subs.map((sub) => (
                            <option key={`${primary}|${sub}`} value={`sub:${primary}|${sub}`} className="bg-cool-gray-900 text-cool-gray-200 font-normal">
                              └ {primary} / {sub}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Stock / Location Filter */}
                  <div className="flex items-center gap-1.5 bg-cool-gray-900 border border-cool-gray-700/70 rounded-lg px-2.5 py-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider">Stock Location:</span>
                    <select
                      value={stockLocationFilter}
                      onChange={(e) => setStockLocationFilter(e.target.value as any)}
                      className="bg-transparent text-white font-semibold outline-none text-xs cursor-pointer"
                    >
                      <option value="all" className="bg-cool-gray-900 text-white">📍 All Stock Locations</option>
                      <option value="onsite" className="bg-cool-gray-900 text-emerald-300">🏠 On-Site Stock (&gt;0 pkgs)</option>
                      <option value="offsite" className="bg-cool-gray-900 text-indigo-300">🏭 Off-Site Stock (&gt;0 pkgs/lbs)</option>
                      <option value="both" className="bg-cool-gray-900 text-cyan-300">⚡ Both On & Off-Site (&gt;0)</option>
                      <option value="instock" className="bg-cool-gray-900 text-emerald-400">✅ In Stock Anywhere (&gt;0)</option>
                      <option value="out_of_stock" className="bg-cool-gray-900 text-rose-300">⚠️ Out of Stock / Neither (0)</option>
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  {catalogTotals.isFiltered && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('all');
                        setSubCategoryFilter('all');
                        setStockLocationFilter('all');
                        setProductArchiveFilter('active');
                        setSearchTerm('');
                      }}
                      className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                      title="Reset all search, category, location, and status filters"
                    >
                      <span>✕ Reset Filters</span>
                    </button>
                  )}
                </div>

                {/* Sort Order */}
                <div className="flex items-center gap-2 shrink-0 select-none">
                  <span className="font-semibold text-cool-gray-400">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                  >
                    <option value="name_asc">Name: A to Z</option>
                    <option value="name_desc">Name: Z to A</option>
                    <option value="stock_asc">Stock: Low to High</option>
                    <option value="stock_desc">Stock: High to Low</option>
                    <option value="understock">Understocked First</option>
                  </select>
                </div>
              </div>

              {/* Archive Status Pills & Expand/Collapse Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cool-gray-750/50 pt-2">
                <div className="flex items-center gap-1 bg-cool-gray-950 p-1 rounded-md border border-cool-gray-700/80">
                  <button
                    type="button"
                    onClick={() => setProductArchiveFilter('active')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                      productArchiveFilter === 'active'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-cool-gray-400 hover:text-cool-gray-200 hover:bg-cool-gray-850'
                    }`}
                  >
                    Active Catalog
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductArchiveFilter('archived')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      productArchiveFilter === 'archived'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-cool-gray-400 hover:text-cool-gray-200 hover:bg-cool-gray-850'
                    }`}
                  >
                    <span>Archived Items</span>
                    {state.products.filter(p => p.isArchived).length > 0 && (
                      <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-800/80 font-mono">
                        {state.products.filter(p => p.isArchived).length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductArchiveFilter('all')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                      productArchiveFilter === 'all'
                        ? 'bg-cool-gray-700 text-white shadow-xs'
                        : 'text-cool-gray-400 hover:text-cool-gray-200 hover:bg-cool-gray-850'
                    }`}
                  >
                    Show All
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExpandAll}
                    className="px-2.5 py-1 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 hover:text-white rounded transition font-semibold cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={handleCollapseAll}
                    className="px-2.5 py-1 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 hover:text-white rounded transition font-semibold cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            </div>

            {/* Dynamic Selection Header/Toolbar for Catalog */}
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
                
                <button
                  type="button"
                  onClick={handleProductToggleAllMatched}
                  className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 bg-cool-gray-850 hover:bg-cool-gray-750 border border-cool-gray-700/60 rounded-md transition cursor-pointer"
                >
                  {allVisibleProducts.every(p => selectedProductIds[p.id]) ? '⬜ Deselect All' : '☑️ Select All Matching'}
                </button>
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
                                        <div className="flex items-center gap-2">
                                          <p className="text-cool-gray-100 font-semibold text-sm">
                                            {product.name}
                                          </p>
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
          </div>
        );
      }
      case "containers":
        return renderContainersTab();
      case "freezers":
        return (
          <div className="mt-4">
            <ManageFreezers state={state} dispatch={dispatch} type="freezers" />
          </div>
        );
      case "lists":
        return <ManageLists state={state} dispatch={dispatch} offSiteQuantityMap={offSiteQuantityMap} offSiteWeightMap={offSiteWeightMap} />;
      case "settings":
        return (
          <div className="space-y-6 mt-4 max-w-2xl font-sans">
            {/* Demo Sandbox Playground Card */}
            <div className="bg-gradient-to-br from-amber-950/20 to-cool-gray-850 rounded-xl border border-amber-500/25 p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-amber-400 mb-1 flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
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
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
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

            <div className="bg-cool-gray-850 rounded-xl border border-cool-gray-750 p-5 shadow-sm space-y-5">
              <div>
                <h3 className="text-base font-bold text-cool-gray-100 mb-1 flex items-center gap-2">
                  ⚙️ Application Preferences
                </h3>
                <p className="text-xs text-cool-gray-400 font-medium">
                  Customize your local application and display preferences.
                </p>
              </div>

              <div className="border-t border-cool-gray-750/50 pt-4 space-y-4">
                <span className="text-xs font-bold text-cool-gray-300 block uppercase tracking-wider">
                  Default Movement Report Shipper (From Address)
                </span>
                <p className="text-[11px] text-cool-gray-400 font-medium leading-relaxed">
                  Set the default origin details printed on your Delivery Slips and Transfer Manifests. These can still be customized live inside each report form.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-cool-gray-400 mb-1 uppercase tracking-wider">Default Shipper Name</label>
                    <input
                      type="text"
                      value={defaultFromName}
                      onChange={(e) => {
                        setDefaultFromName(e.target.value);
                        localStorage.setItem("report-from-name", e.target.value);
                      }}
                      className="w-full max-w-md bg-cool-gray-900 border border-cool-gray-750 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500 font-semibold"
                      placeholder="Shipper or farm name (e.g. My Ranch)"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-cool-gray-400 mb-1 uppercase tracking-wider">Default Shipper Address</label>
                    <textarea
                      value={defaultFromAddress}
                      onChange={(e) => {
                        setDefaultFromAddress(e.target.value);
                        localStorage.setItem("report-from-address", e.target.value);
                      }}
                      rows={3}
                      className="w-full max-w-md bg-cool-gray-900 border border-cool-gray-750 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 font-semibold"
                      placeholder="Street address, City, State, Zip"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-cool-gray-750/50 pt-4 space-y-4">
                <span className="text-xs font-bold text-cool-gray-300 block uppercase tracking-wider">
                  Off-Site Storage Settings
                </span>
                <p className="text-[11px] text-cool-gray-400 font-medium leading-relaxed">
                  Specify the theoretical box weight (lbs) used in simulated box count calculations inside the Off-Site view.
                </p>
                <div>
                  <label className="block text-[10px] font-extrabold text-cool-gray-400 mb-1 uppercase tracking-wider">Theoretical Box Weight (lbs)</label>
                  <input
                    type="number"
                    value={theoreticalBoxWeight === 0 ? '' : theoreticalBoxWeight}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTheoreticalBoxWeight(isNaN(val) ? 0 : val);
                      if (!isNaN(val) && val > 0) {
                        localStorage.setItem("offsite-theoretical-box-weight", val.toString());
                      }
                    }}
                    onBlur={() => {
                      if (!theoreticalBoxWeight || theoreticalBoxWeight <= 0) {
                        setTheoreticalBoxWeight(40);
                        localStorage.setItem("offsite-theoretical-box-weight", "40");
                      }
                    }}
                    className="w-full max-w-xs bg-cool-gray-900 border border-cool-gray-750 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500 font-semibold"
                    placeholder="40"
                    min="1"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="border-t border-cool-gray-750/40 pt-5 text-xs text-cool-gray-450 leading-relaxed font-semibold">
                <p>
                  🔒 Application preferences are saved automatically to your browser's
                  persistent workspace, persisting across tab reloads and system
                  restarts.
                </p>
              </div>
            </div>
          </div>
        );
      case "tags":
        return <ManageTags state={state} dispatch={dispatch} />;
      case "locations":
        return <ManageLocations state={state} dispatch={dispatch} />;
      case "photos":
        return <PhotoManagerView state={state} dispatch={dispatch} />;
      case "import":
        return (
          <div className="mt-4">
            <DataImportView
              state={state}
              dispatch={dispatch}
              onNavigateToView={(view) => {
                if (onNavigateToView) {
                  onNavigateToView(view);
                } else {
                  setActiveTab("products");
                }
              }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-cool-gray-800/50 p-4 sm:p-6 rounded-lg border border-cool-gray-700 animate-fade-in relative">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 pb-5 border-b border-cool-gray-700/60 font-sans">
        <div className="flex border-b border-cool-gray-700 overflow-x-auto w-full lg:w-auto pb-1 gap-1">
          <button
            onClick={() => {
              setActiveTab("products");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "products" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Products & Categories
          </button>
          <button
            onClick={() => {
              setActiveTab("containers");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "containers" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Containers
          </button>
          <button
            onClick={() => {
              setActiveTab("freezers");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "freezers" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Freezers
          </button>
          <button
            onClick={() => {
              setActiveTab("lists");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "lists" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Lists
          </button>
          <button
            onClick={() => {
              setActiveTab("tags");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "tags" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Tags
          </button>
          <button
            onClick={() => {
              setActiveTab("locations");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "locations" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Locations
          </button>
          <button
            onClick={() => {
              setActiveTab("photos");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "photos" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Photo Manager
          </button>
          <button
            onClick={() => {
              setActiveTab("import");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "import" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Import / Manage Data
          </button>
          <button
            onClick={() => {
              setActiveTab("settings");
            }}
            className={`px-3 py-2 text-sm font-semibold rounded-t-md transition-all whitespace-nowrap ${activeTab === "settings" ? "border-b-2 border-cyan-500 bg-cool-gray-800 text-cyan-300" : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/40"}`}
          >
            Settings
          </button>
        </div>
        <div className="w-full lg:w-auto flex select-none gap-2 flex-grow lg:flex-none">
          {(activeTab === "products" || activeTab === "containers") && (
            <div className="relative flex-grow min-w-[200px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon className="h-5 w-5 text-cool-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-md border-0 bg-cool-gray-850 py-2 pl-10 pr-3 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-700 placeholder:text-cool-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
              />
            </div>
          )}
          {activeTab === "products" && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-700 transition"
            >
              <PlusIcon /> Product
            </button>
          )}
          {activeTab === "containers" && (
            <button
              onClick={() => openModal({ type: "ADD_CONTAINER" })}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-700 transition"
            >
              <PlusIcon /> Container
            </button>
          )}
        </div>
      </div>

      {renderContent()}

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
                setIsProductBulkEditOpen(true);
              }}
              className="text-xs px-3 py-2 bg-emerald-105 hover:bg-emerald-250 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/40 rounded-lg transition-all font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Assign a new primary or subcategory to selected products"
            >
              ✏️ Bulk Edit Categories
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
                              <span>{tag.id === 'use-first' ? '⚡' : tag.id === 'not-for-sale' ? '🛑' : '🏷️'}</span>
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

export const ManageLists: React.FC<{
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  offSiteQuantityMap?: Record<string, number>;
  offSiteWeightMap?: Record<string, number>;
}> = ({ state, dispatch, offSiteQuantityMap = {}, offSiteWeightMap = {} }) => {
  const customLists = state.customLists || [];
  const [listCatalogSubTab, setListCatalogSubTab] = useState<"lists" | "bulk_matrix">("lists");
  const [expandedListId, setExpandedListId] = useState<string>(
    customLists[0]?.id || "",
  );

  // Form trigger & editing fields
  const [isFormVisible, setFormVisible] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [listDesc, setListDesc] = useState("");
  const [allowNotes, setAllowNotes] = useState(true);
  const [isInventoryControlled, setIsInventoryControlled] = useState(false);
  const [controlType, setControlType] = useState<"prompt" | "auto">("prompt");
  const [controlCondition, setControlCondition] = useState<"min" | "max">(
    "min",
  );

  // Notification states
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [listNotificationEnabled, setListNotificationEnabled] = useState(false);
  const [listNotificationType, setListNotificationType] = useState<"all_items" | "newly_added_only" | "item_specific">("all_items");

  // Product search selector to add item to expanded list
  const [addProductId, setAddProductId] = useState("");
  const [addNote, setAddNote] = useState("");

  const activeList =
    customLists.find((cl) => cl.id === expandedListId) || customLists[0];

  useEffect(() => {
    if (!activeList && customLists.length > 0) {
      setExpandedListId(customLists[0].id);
    }
  }, [customLists, activeList]);

  const handleCreateOrEditList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;

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
            controlCondition: isInventoryControlled
              ? controlCondition
              : undefined,
            notificationEnabled: listNotificationEnabled,
            notificationType: listNotificationType,
          },
        },
      });
    } else {
      dispatch({
        type: "ADD_CUSTOM_LIST",
        payload: {
          name: listName,
          description: listDesc,
          allowNotes,
          isInventoryControlled,
          controlType,
          controlCondition,
          notificationEnabled: listNotificationEnabled,
          notificationType: listNotificationType,
        },
      });
    }

    // Reset
    setListName("");
    setListDesc("");
    setAllowNotes(true);
    setIsInventoryControlled(false);
    setControlType("prompt");
    setControlCondition("min");
    setListNotificationEnabled(false);
    setListNotificationType("all_items");
    setEditingListId(null);
    setFormVisible(false);
  };

  const handleEditClick = (cl: any) => {
    setEditingListId(cl.id);
    setListName(cl.name);
    setListDesc(cl.description || "");
    setAllowNotes(cl.allowNotes);
    setIsInventoryControlled(cl.isInventoryControlled);
    setControlType(cl.controlType || "prompt");
    setControlCondition(cl.controlCondition || "min");
    setListNotificationEnabled(!!cl.notificationEnabled);
    setListNotificationType(cl.notificationType || "all_items");
    setFormVisible(true);
  };

  const handleCancelForm = () => {
    setListName("");
    setListDesc("");
    setAllowNotes(true);
    setIsInventoryControlled(false);
    setControlType("prompt");
    setControlCondition("min");
    setListNotificationEnabled(false);
    setListNotificationType("all_items");
    setEditingListId(null);
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

  const handleDeleteList = (listId: string) => {
    if (
      confirm(
        `Are you sure you want to delete the list "${customLists.find((cl) => cl.id === listId)?.name}"?`,
      )
    ) {
      dispatch({ type: "DELETE_CUSTOM_LIST", payload: { listId } });
      if (expandedListId === listId) {
        const remaining = customLists.filter((cl) => cl.id !== listId);
        setExpandedListId(remaining[0]?.id || "");
      }
    }
  };

  // Calculate current quantities per product ID
  const productQuantities = useMemo(() => {
    return state.meatCuts.reduce(
      (acc, mc) => {
        acc[mc.productId] = (acc[mc.productId] || 0) + mc.quantity;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [state.meatCuts]);

  // Gather products that are NOT already on the active list
  const availableProducts = useMemo(() => {
    if (!activeList) return [];
    const existingOnList = new Set(
      activeList.items?.map((i) => i.productId) || [],
    );
    return state.products
      .filter((p) => !existingOnList.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [state.products, activeList]);

  const [listSearch, setListSearch] = useState("");
  const [listCategory, setListCategory] = useState("all");
  const [organizeMode, setOrganizeMode] = useState<"list" | "category">("category");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    state.products.forEach((p) => {
      if (p.primaryCategory) {
        cats.add(p.primaryCategory);
      }
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [state.products]);

  const filteredListItems = useMemo(() => {
    if (!activeList || !activeList.items) return [];
    return activeList.items.filter((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      if (!prod) return false;

      const matchesSearch =
        prod.name.toLowerCase().includes(listSearch.toLowerCase()) ||
        (prod.subCategory &&
          prod.subCategory.toLowerCase().includes(listSearch.toLowerCase())) ||
        (item.notes &&
          item.notes.toLowerCase().includes(listSearch.toLowerCase()));

      const matchesCategory =
        listCategory === "all" || prod.primaryCategory === listCategory;

      return matchesSearch && matchesCategory;
    });
  }, [activeList, state.products, listSearch, listCategory]);

  const groupedFilteredItems = useMemo(() => {
    const groups: Record<string, typeof filteredListItems> = {};
    filteredListItems.forEach((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      const cat = prod?.primaryCategory || "Uncategorized";
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    });
    return groups;
  }, [filteredListItems, state.products]);

  // --- Bulk Matrix Spreadsheet Grid States ---
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixCategory, setMatrixCategory] = useState("all");
  const [matrixSubCategory, setMatrixSubCategory] = useState("all");
  const [matrixListFilter, setMatrixListFilter] = useState<string>("all");
  const [matrixMembershipFilter, setMatrixMembershipFilter] = useState<"all" | "in_any" | "in_none" | "controlled_only">("all");
  const [matrixSortBy, setMatrixSortBy] = useState<"name_asc" | "name_desc" | "category_asc" | "stock_desc">("category_asc");
  const [matrixSelectedProds, setMatrixSelectedProds] = useState<Record<string, boolean>>({});

  // Batch control modal / popover toolbar state
  const [bulkListTarget, setBulkListTarget] = useState<string>(customLists[0]?.id || "");
  const [bulkActionType, setBulkActionType] = useState<"include" | "exclude" | "set_source" | "set_threshold" | "clear_threshold">("include");
  const [bulkControlSourceVal, setBulkControlSourceVal] = useState<ControlSourceType>("onsite_count");
  const [bulkThresholdVal, setBulkThresholdVal] = useState<string>("5");
  const [matrixToastMsg, setMatrixToastMsg] = useState<string | null>(null);

  // Auto-dismiss toast
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

  // Available sub-categories for matrix filter
  const matrixSubCategories = useMemo(() => {
    const subs = new Set<string>();
    state.products.forEach((p) => {
      if (matrixCategory === "all" || p.primaryCategory === matrixCategory) {
        if (p.subCategory) subs.add(p.subCategory);
      }
    });
    return Array.from(subs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [state.products, matrixCategory]);

  // Filtered & sorted products for the Matrix Grid
  const matrixFilteredProducts = useMemo(() => {
    const listMap = new Map<string, CustomList>();
    customLists.forEach((cl) => listMap.set(cl.id, cl));

    return state.products.filter((p) => {
      // 1. Search Query
      if (matrixSearch.trim()) {
        const q = matrixSearch.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCat = p.primaryCategory?.toLowerCase().includes(q);
        const matchesSub = p.subCategory?.toLowerCase().includes(q);
        const matchesNum = p.productNumbers?.some(num => num.toLowerCase().includes(q));
        const matchesBarcode = p.barcode?.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesSub && !matchesNum && !matchesBarcode) return false;
      }

      // 2. Primary Category
      if (matrixCategory !== "all" && p.primaryCategory !== matrixCategory) {
        return false;
      }

      // 3. Sub Category
      if (matrixSubCategory !== "all" && p.subCategory !== matrixSubCategory) {
        return false;
      }

      // 4. List Membership / Status
      if (matrixListFilter !== "all") {
        const targetList = listMap.get(matrixListFilter);
        const onThisList = targetList?.items?.some(i => i.productId === p.id);
        if (!onThisList) return false;
      }

      if (matrixMembershipFilter === "in_any") {
        const inAny = customLists.some(cl => cl.items?.some(i => i.productId === p.id));
        if (!inAny) return false;
      } else if (matrixMembershipFilter === "in_none") {
        const inAny = customLists.some(cl => cl.items?.some(i => i.productId === p.id));
        if (inAny) return false;
      } else if (matrixMembershipFilter === "controlled_only") {
        const inControlled = customLists.some(cl => cl.isInventoryControlled && cl.items?.some(i => i.productId === p.id));
        if (!inControlled) return false;
      }

      return true;
    }).sort((a, b) => {
      if (matrixSortBy === "name_asc") {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (matrixSortBy === "name_desc") {
        return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (matrixSortBy === "category_asc") {
        const catCmp = (a.primaryCategory || "").localeCompare(b.primaryCategory || "", undefined, { numeric: true, sensitivity: 'base' });
        if (catCmp !== 0) return catCmp;
        const subCmp = (a.subCategory || "").localeCompare(b.subCategory || "", undefined, { numeric: true, sensitivity: 'base' });
        if (subCmp !== 0) return subCmp;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
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

  const selectedMatrixProdCount = useMemo(() => {
    return Object.keys(matrixSelectedProds).filter(id => matrixSelectedProds[id]).length;
  }, [matrixSelectedProds]);

  const handleSelectAllMatrix = (checkAll: boolean) => {
    if (checkAll) {
      const next: Record<string, boolean> = {};
      matrixFilteredProducts.forEach(p => { next[p.id] = true; });
      setMatrixSelectedProds(next);
    } else {
      setMatrixSelectedProds({});
    }
  };

  const executeBulkMatrixAction = () => {
    const selectedIds = Object.keys(matrixSelectedProds).filter(id => matrixSelectedProds[id]);
    if (selectedIds.length === 0) {
      alert("Please select one or more products using the checkboxes before applying a bulk edit.");
      return;
    }
    if (!bulkListTarget) {
      alert("Please select a target list.");
      return;
    }

    const targetList = customLists.find(cl => cl.id === bulkListTarget);
    if (!targetList) return;

    if (bulkActionType === "include") {
      const numericVal = bulkThresholdVal.trim() !== "" ? parseFloat(bulkThresholdVal) : undefined;
      const updates = selectedIds.map(pid => ({
        listId: targetList.id,
        productId: pid,
        forceState: true,
        ...(numericVal !== undefined && !isNaN(numericVal) ? { threshold: numericVal } : {}),
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg(`Added ${selectedIds.length} item(s) to "${targetList.name}"${numericVal !== undefined && !isNaN(numericVal) ? ` with threshold ${numericVal}` : ""}`);
    } else if (bulkActionType === "exclude") {
      const updates = selectedIds.map(pid => ({
        listId: targetList.id,
        productId: pid,
        forceState: false,
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg(`Removed ${selectedIds.length} item(s) from "${targetList.name}"`);
    } else if (bulkActionType === "set_source") {
      const updates = selectedIds.map(pid => ({
        listId: targetList.id,
        productId: pid,
        controlSource: bulkControlSourceVal,
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg(`Updated inventory source to ${bulkControlSourceVal.replace('_', ' ')} for ${selectedIds.length} item(s) on "${targetList.name}"`);
    } else if (bulkActionType === "set_threshold") {
      const numericVal = parseFloat(bulkThresholdVal);
      if (isNaN(numericVal)) {
        alert("Please enter a valid numeric threshold.");
        return;
      }
      const updates = selectedIds.map(pid => ({
        listId: targetList.id,
        productId: pid,
        threshold: numericVal,
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg(`Updated inventory threshold to ${numericVal} for ${selectedIds.length} item(s) on "${targetList.name}"`);
    } else if (bulkActionType === "clear_threshold") {
      const updates = selectedIds.map(pid => ({
        listId: targetList.id,
        productId: pid,
        threshold: null,
      }));
      dispatch({ type: "BATCH_TOGGLE_PRODUCTS_ON_LIST", payload: { updates } });
      setMatrixToastMsg(`Cleared custom threshold for ${selectedIds.length} item(s) on "${targetList.name}"`);
    }
  };

  const renderTableRows = (itemsToRender: typeof activeList.items) => {
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

      const threshold = prod.listThresholds?.[activeList.id];
      const hasThreshold = threshold !== undefined && threshold !== null;
      let isTriggered = false;

      if (hasThreshold && activeList.isInventoryControlled) {
        if (activeList.controlCondition === "max") {
          isTriggered = curValue >= (threshold || 0);
        } else {
          isTriggered = curValue <= (threshold || 0);
        }
      }

      return (
        <tr
          key={item.productId}
          className="hover:bg-cool-gray-900/35 transition-all animate-fade-in"
        >
          <td className="py-3 px-3">
            <div className="font-extrabold text-cool-gray-200 text-sm">
              {prod.name}
            </div>
            <div className="text-[10px] text-cool-gray-400 font-medium">
              {prod.primaryCategory} &gt; {prod.subCategory}
            </div>
          </td>
          <td className="py-3 px-3 animate-fade-in text-center">
            <div className="flex flex-col items-center justify-center gap-1.5">
              <span
                className={`text-xs font-black px-2 py-0.5 rounded ${
                  !hasThreshold || !activeList.isInventoryControlled
                    ? "text-cool-gray-300 bg-cool-gray-800"
                    : isTriggered
                      ? activeList.controlCondition === "max"
                        ? "text-cyan-400 bg-cyan-950/25 border border-cyan-500/25"
                        : "text-amber-400 bg-amber-950/25 border border-amber-900/30"
                      : "text-green-400 bg-green-950/20 border border-green-900/20"
                }`}
              >
                {curValue.toFixed(controlSource === "offsite_weight" ? 2 : 0)} {unitLabel}
              </span>

              {activeList.isInventoryControlled && (
                <div className="flex flex-col gap-1 w-full max-w-[125px] mt-1">
                  {/* Control Source Dropdown */}
                  <select
                    value={controlSource}
                    onChange={(e) => {
                      dispatch({
                        type: "UPDATE_LIST_ITEM_CONTROL_SOURCE",
                        payload: {
                          listId: activeList.id,
                          productId: prod.id,
                          controlSource: e.target.value as any
                        }
                      });
                    }}
                    className="w-full bg-cool-gray-950 border border-cool-gray-850 rounded px-1.5 py-0.5 text-[9px] font-bold text-cool-gray-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="onsite_count">On-Site Count</option>
                    <option value="offsite_count">Off-Site Count</option>
                    <option value="offsite_weight">Off-Site Weight</option>
                    <option value="total_count">Total Count</option>
                  </select>

                  {/* Threshold Input */}
                  <div className="flex items-center justify-between gap-1 bg-cool-gray-950 border border-cool-gray-850 rounded px-1.5 py-0.5 text-[9px]">
                    <span className="text-[9px] text-cool-gray-450 font-bold uppercase tracking-wider">
                      {activeList.controlCondition === "max" ? "Max" : "Min"}:
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
                            listId: activeList.id,
                            productId: prod.id,
                            threshold: val
                          }
                        });
                      }}
                      className="w-12 bg-transparent text-right font-black text-white focus:outline-none focus:text-cyan-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </td>
          {activeList.allowNotes && (
            <td className="py-3 px-3">
              <div className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-cool-gray-500 shrink-0" />
                <input
                  type="text"
                  value={item.notes || ""}
                  onChange={(e) => {
                    const txt = e.target.value;
                    dispatch({
                      type: "UPDATE_LIST_ITEM_NOTE",
                      payload: {
                        listId: activeList.id,
                        productId: prod.id,
                        notes: txt,
                      },
                    });
                  }}
                  placeholder="Set specific status description..."
                  className="w-full bg-cool-gray-905 border border-cool-gray-800 hover:border-cool-gray-700 rounded-md px-2.5 py-1.5 text-white placeholder-cool-gray-650 focus:outline-none focus:border-cyan-500 transition-colors text-xs"
                />
              </div>
            </td>
          )}
          {activeList.notificationEnabled && (
            <td className="py-3 px-3 text-center">
              <button
                type="button"
                onClick={() => {
                  dispatch({
                    type: "TOGGLE_LIST_ITEM_NOTIFICATION",
                    payload: {
                      listId: activeList.id,
                      productId: prod.id,
                      notifyEnabled: !(item.notifyEnabled !== false)
                    }
                  });
                }}
                className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                  item.notifyEnabled !== false
                    ? "bg-amber-950/40 text-amber-400 border-amber-900/30"
                    : "bg-cool-gray-900 text-cool-gray-650 border-cool-gray-800"
                }`}
                title={item.notifyEnabled !== false ? "Click to disable daily digest for this item" : "Click to enable daily digest for this item"}
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
                    listId: activeList.id,
                    productId: prod.id,
                    forceState: false,
                  },
                });
              }}
              className="p-1.5 text-rose-450 hover:bg-rose-950/30 hover:text-rose-350 rounded transition cursor-pointer"
              title="Delete item from this configuration list"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="space-y-4 mt-4 font-sans text-sm pb-8">
      {/* Sub-Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-cool-gray-850/80 p-2.5 rounded-xl border border-cool-gray-750/70 shadow-sm">
        <div className="flex items-center gap-1.5 p-1 bg-cool-gray-900/90 rounded-lg border border-cool-gray-800">
          <button
            type="button"
            onClick={() => setListCatalogSubTab("lists")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              listCatalogSubTab === "lists"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/60"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            List Catalog & Items
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-cool-gray-950/60 text-cyan-200">
              {customLists.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setListCatalogSubTab("bulk_matrix")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              listCatalogSubTab === "bulk_matrix"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-cool-gray-400 hover:text-white hover:bg-cool-gray-800/60"
            }`}
          >
            <Table className="w-3.5 h-3.5 text-amber-400" />
            Bulk Matrix & Inventory Control
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-extrabold">
              Spreadsheet
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-cool-gray-400">
          {listCatalogSubTab === "bulk_matrix" ? (
            <span className="flex items-center gap-1.5 bg-cool-gray-900/80 px-2.5 py-1 rounded border border-cool-gray-800 text-[11px] text-cool-gray-300">
              <Sliders className="w-3 h-3 text-cyan-400" />
              Showing <strong>{matrixFilteredProducts.length}</strong> products across <strong>{customLists.length}</strong> list(s)
            </span>
          ) : (
            <span className="text-[11px] text-cool-gray-450 hidden sm:inline">
              Configure list memberships, item notes, and custom inventory alerts.
            </span>
          )}
        </div>
      </div>

      {/* RENDER VIEW 1: Standard List Catalog */}
      {listCatalogSubTab === "lists" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT SIDEBAR: List Directory */}
          <div className="lg:col-span-1 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-cool-gray-300 uppercase tracking-widest flex items-center gap-2">
                <ClipboardList className="w-4.5 h-4.5 text-cyan-400" /> Active Lists
              </h3>
              {!isFormVisible && (
            <button
              type="button"
              onClick={() => {
                setEditingListId(null);
                setFormVisible(true);
              }}
              className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-1 px-3 rounded-md transition shadow-md flex items-center gap-1 select-none cursor-pointer"
            >
              + Create List
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {customLists.map((cl) => {
            const isExpanded = activeList?.id === cl.id && !showNotificationCenter;
            const itemsCount = cl.items?.length || 0;
            return (
              <div
                key={cl.id}
                onClick={() => {
                  setShowNotificationCenter(false);
                  if (!isExpanded) {
                    setExpandedListId(cl.id);
                    setAddProductId("");
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                  isExpanded
                    ? "bg-cool-gray-800 border-cyan-500/70 shadow-lg"
                    : "bg-cool-gray-850/45 border-cool-gray-800/85 hover:border-cool-gray-700"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 pr-6">
                    <div className="font-extrabold text-cool-gray-150 text-base truncate flex items-center gap-1.5">
                      {cl.name}
                    </div>
                    {cl.description && (
                      <p className="text-xs text-cool-gray-400 truncate mt-0.5">
                        {cl.description}
                      </p>
                    )}
                  </div>

                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1">
                    <span className="text-[10px] bg-cool-gray-700/80 text-cool-gray-300 px-2.5 py-0.5 rounded-full font-bold">
                      {itemsCount} {itemsCount === 1 ? "item" : "items"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap pt-1.5 border-t border-cool-gray-850 text-[10px] uppercase font-mono font-bold tracking-wider text-cool-gray-400">
                  {cl.allowNotes && (
                    <span className="bg-cool-gray-905 px-2 py-0.5 rounded border border-cool-gray-800">
                      📝 Notes Enabled
                    </span>
                  )}
                  {cl.isInventoryControlled ? (
                    <span className="bg-amber-950/40 text-amber-400 px-2 py-0.5 rounded border border-amber-900/40">
                      🤖{" "}
                      {cl.controlType === "auto" ? "Auto-Stock" : "Alert-Stock"}{" "}
                      ({cl.controlCondition})
                    </span>
                  ) : (
                    <span className="bg-cool-gray-901 text-cool-gray-500 px-2 py-0.5 rounded border border-cool-gray-850">
                      Static List
                    </span>
                  )}
                  {cl.notificationEnabled && (
                    <span className="bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded border border-purple-900/40">
                      🔔 {cl.notificationType === "all_items" ? "All" : cl.notificationType === "newly_added_only" ? "New" : "Specific"}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div
                    className="flex justify-end gap-2 pt-2 border-t border-cool-gray-700 mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(cl);
                      }}
                      className="text-[11px] bg-cool-gray-700 hover:bg-cool-gray-650 text-cool-gray-200 hover:text-white px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-2.5 h-2.5 text-teal-400" /> Configure
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteList(cl.id);
                      }}
                      className="text-[11px] bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-950/45 hover:border-red-500/30 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-2 border-t border-cool-gray-800 mt-2">
            <div
              onClick={() => {
                setShowNotificationCenter(true);
                setFormVisible(false);
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                showNotificationCenter
                  ? "bg-amber-950/20 border-amber-500 text-amber-300 shadow-lg"
                  : "bg-cool-gray-850/45 border-cool-gray-800/85 hover:border-cool-gray-700 text-cool-gray-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bell className={`w-4.5 h-4.5 ${showNotificationCenter ? 'text-amber-400' : 'text-cool-gray-400'}`} />
                <div className="text-left">
                  <span className="font-extrabold text-sm block">Notification Center</span>
                  <span className="text-[10px] text-cool-gray-450 block font-semibold mt-0.5">Configure digests, email, SMTP & HA</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-cool-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT WORKPLACE: Selected List Items vs Config Form */}
      <div className="lg:col-span-2 space-y-4">
        {showNotificationCenter ? (
          <NotificationCenterComponent state={state} dispatch={dispatch} />
        ) : isFormVisible ? (
          <form
            onSubmit={handleCreateOrEditList}
            className="bg-cool-gray-850 p-5 rounded-xl border border-cool-gray-750 shadow-md space-y-4.5 animate-fade-in"
          >
            <div className="border-b border-cool-gray-700 pb-3 flex items-center justify-between">
              <h4 className="text-base font-extrabold text-cool-gray-100">
                {editingListId
                  ? `Configure List: ${customLists.find((cl) => cl.id === editingListId)?.name}`
                  : "Create Customizable List"}
              </h4>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/20 border border-cyan-500/20 px-2 py-0.5 rounded font-mono uppercase tracking-widest">
                Settings
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">
                List Name
              </label>
              <input
                type="text"
                required
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="e.g. Printing Shelf Tags, Remove from Store, Price Audit"
                className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-3 py-2 text-white placeholder-cool-gray-550 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cool-gray-300">
                Description / Scope & Focus
              </label>
              <input
                type="text"
                value={listDesc}
                onChange={(e) => setListDesc(e.target.value)}
                placeholder="e.g. Items requiring printed visual tags before going on shelves"
                className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-md px-3 py-2 text-white placeholder-cool-gray-550 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1.5">
              <div className="bg-cool-gray-900 rounded-lg p-3 border border-cool-gray-750 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="allowNotesCheck"
                  checked={allowNotes}
                  onChange={(e) => setAllowNotes(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <div className="text-xs leading-normal">
                  <label
                    htmlFor="allowNotesCheck"
                    className="font-bold text-cool-gray-200 block cursor-pointer select-none"
                  >
                    Allow Individual Item Notes
                  </label>
                  <span className="text-cool-gray-400 block mt-0.5">
                    Permit custom notes per item on the active checklists.
                  </span>
                </div>
              </div>

              <div className="bg-cool-gray-900 rounded-lg p-3 border border-cool-gray-750 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="isInventoryControlledCheck"
                  checked={isInventoryControlled}
                  onChange={(e) => setIsInventoryControlled(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <div className="text-xs leading-normal">
                  <label
                    htmlFor="isInventoryControlledCheck"
                    className="font-bold text-cool-gray-200 block cursor-pointer select-none"
                  >
                    Inventory Level Controlled
                  </label>
                  <span className="text-cool-gray-400 block mt-0.5">
                    Configure automatic thresholds based on active storefront
                    quantities.
                  </span>
                </div>
              </div>
            </div>

            {isInventoryControlled && (
              <div className="p-4 bg-cool-gray-900/65 rounded-lg border border-cool-gray-750 space-y-4 animate-scale-up">
                <h5 className="text-xs font-bold text-cyan-400 uppercase tracking-wider pb-1 ml-0.5 flex items-center gap-1.5 border-b border-cool-gray-800">
                  🤖 Inventory Control Triggers & Behaviors
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-cool-gray-400 block">
                      Addition / Removal Style
                    </label>
                    <div className="flex gap-2.5">
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-750 flex-grow rounded cursor-pointer select-none">
                        <input
                          type="radio"
                          name="controlType"
                          value="prompt"
                          checked={controlType === "prompt"}
                          onChange={() => setControlType("prompt")}
                          className="w-3.5 h-3.5 text-cyan-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-cool-gray-100 block">
                            Popup Alert
                          </span>
                          <span className="text-[10px] text-cool-gray-450 block">
                            Prompt first in stock alerts
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-750 flex-grow rounded cursor-pointer select-none">
                        <input
                          type="radio"
                          name="controlType"
                          value="auto"
                          checked={controlType === "auto"}
                          onChange={() => setControlType("auto")}
                          className="w-3.5 h-3.5 text-cyan-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-cool-gray-100 block">
                            Auto Movement
                          </span>
                          <span className="text-[10px] text-cool-gray-450 block">
                            Move immediately on list
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-cool-gray-400 block">
                      Target Threshold Rule
                    </label>
                    <div className="flex gap-2.5">
                      <label className="flex items-center gap-2 bg-cool-gray-950 p-2 border border-cool-gray-750 flex-grow rounded cursor-pointer select-none">
                        <input
                          type="radio"
                          name="controlCondition"
                          value="min"
                          checked={controlCondition === "min"}
                          onChange={() => setControlCondition("min")}
                          className="w-3.5 h-3.5 text-cyan-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-cool-gray-100 block">
                            Understocked (Min)
                          </span>
                          <span className="text-[10px] text-cool-gray-450 block">
                            At or below threshold
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 bg-cool-gray-955 p-2 border border-cool-gray-750 flex-grow rounded cursor-pointer select-none">
                        <input
                          type="radio"
                          name="controlCondition"
                          value="max"
                          checked={controlCondition === "max"}
                          onChange={() => setControlCondition("max")}
                          className="w-3.5 h-3.5 text-cyan-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-cool-gray-100 block">
                            Overstocked (Max)
                          </span>
                          <span className="text-[10px] text-cool-gray-450 block">
                            At or above threshold
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-cool-gray-900 rounded-lg p-4 border border-cool-gray-750/70 space-y-3">
              <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider pb-1 ml-0.5 flex items-center gap-1.5 border-b border-cool-gray-800">
                <Bell size={14} className="text-amber-500" /> List Notifications Settings
              </h5>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="listNotificationEnabledCheck"
                  checked={listNotificationEnabled}
                  onChange={(e) => setListNotificationEnabled(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <div className="text-xs leading-normal">
                  <label
                    htmlFor="listNotificationEnabledCheck"
                    className="font-bold text-cool-gray-200 block cursor-pointer select-none"
                  >
                    Enable List Digest Notifications
                  </label>
                  <span className="text-cool-gray-400 block mt-0.5">
                    Include everything on this list in daily digest notifications.
                  </span>
                </div>
              </div>

              {listNotificationEnabled && (
                <div className="p-3 bg-cool-gray-950 rounded border border-cool-gray-800 space-y-2.5 animate-scale-up">
                  <label className="text-xs font-bold text-cool-gray-300 block">
                    What should be included?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-750 rounded cursor-pointer select-none">
                      <input
                        type="radio"
                        name="listNotificationType"
                        value="all_items"
                        checked={listNotificationType === "all_items"}
                        onChange={() => setListNotificationType("all_items")}
                        className="w-3.5 h-3.5 text-cyan-500"
                      />
                      <span className="text-xs font-semibold text-cool-gray-200">All Items</span>
                    </label>

                    <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-750 rounded cursor-pointer select-none">
                      <input
                        type="radio"
                        name="listNotificationType"
                        value="newly_added_only"
                        checked={listNotificationType === "newly_added_only"}
                        onChange={() => setListNotificationType("newly_added_only")}
                        className="w-3.5 h-3.5 text-cyan-500"
                      />
                      <span className="text-xs font-semibold text-cool-gray-200">Newly Added Only</span>
                    </label>

                    <label className="flex items-center gap-2 bg-cool-gray-900 p-2 border border-cool-gray-750 rounded cursor-pointer select-none">
                      <input
                        type="radio"
                        name="listNotificationType"
                        value="item_specific"
                        checked={listNotificationType === "item_specific"}
                        onChange={() => setListNotificationType("item_specific")}
                        className="w-3.5 h-3.5 text-cyan-500"
                      />
                      <span className="text-xs font-semibold text-cool-gray-200">Item-Specific Only</span>
                    </label>
                  </div>
                  <span className="text-[10px] text-cool-gray-450 block leading-relaxed mt-1">
                    {listNotificationType === "all_items" && "• Every single active product on this list is sent in each daily digest."}
                    {listNotificationType === "newly_added_only" && "• Only products added to the list since the last daily digest notification run are sent."}
                    {listNotificationType === "item_specific" && "• Only products on the list that have their individual 'Notify' toggles switched ON are sent."}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3.5 border-t border-cool-gray-700 mt-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-650 text-white font-semibold rounded-lg transition text-xs select-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition text-xs shadow-md select-none cursor-pointer"
              >
                {editingListId ? "Apply Rules" : "Save Customizable List"}
              </button>
            </div>
          </form>
        ) : activeList ? (
          <div className="bg-cool-gray-855 p-4.5 rounded-xl border border-cool-gray-750 shadow-sm space-y-4 animate-fade-in">
            <div className="border-b border-cool-gray-700/80 pb-3 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-extrabold text-cool-gray-100 flex items-center gap-2">
                  {activeList.name}
                </h4>
                {activeList.description && (
                  <p className="text-xs text-cool-gray-400 mt-0.5">
                    {activeList.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleEditClick(activeList)}
                className="text-xs border border-cool-gray-700 font-bold hover:bg-cool-gray-700 text-cool-gray-300 hover:text-white px-3 py-1.5 rounded-md transition select-none flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-cyan-400" /> Rules
                Configuration
              </button>
            </div>

            {/* Direct Addition form to add item on expanded list */}
            <div className="p-3 bg-cool-gray-900 rounded-lg border border-cool-gray-800 flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-grow min-w-0">
                <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block mb-1">
                  Add product manually to active list
                </label>
                {availableProducts.length === 0 ? (
                  <span className="text-xs text-cool-gray-500 font-medium block h-9 bg-cool-gray-950 border border-cool-gray-800 leading-[34px] px-3.5 rounded-md">
                    All items are already in this list configuration.
                  </span>
                ) : (
                  <SearchableProductSelect
                    products={availableProducts}
                    value={addProductId}
                    onChange={setAddProductId}
                    placeholder="Search product by name, SKU or category to add..."
                    includeArchived={true}
                  />
                )}
              </div>

              {activeList.allowNotes && addProductId && (
                <div className="flex-grow min-w-0 animate-fade-in">
                  <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block mb-1">
                    Target Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    placeholder="Add label / pricing notes..."
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
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer shadow"
                    : "bg-cool-gray-800 text-cool-gray-600 cursor-not-allowed border border-cool-gray-800"
                }`}
              >
                <PlusIcon /> Add to List
              </button>
            </div>

            {/* Search, Filter & Organize Row */}
            {activeList.items && activeList.items.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-cool-gray-900/50 p-3 rounded-lg border border-cool-gray-800/85">
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center w-full sm:w-auto flex-grow max-w-xl">
                  {/* Search Input */}
                  <div className="relative flex-grow">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-cool-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      placeholder="Search items by name, category or note..."
                      className="w-full h-8 pl-9 pr-8 bg-cool-gray-950 border border-cool-gray-750 rounded-md text-xs text-white placeholder-cool-gray-550 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    {listSearch && (
                      <button
                        onClick={() => setListSearch("")}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-cool-gray-500 hover:text-white text-sm"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {/* Category Filter */}
                  <div className="min-w-[140px]">
                    <select
                      value={listCategory}
                      onChange={(e) => setListCategory(e.target.value)}
                      className="w-full h-8 py-1 px-2.5 bg-cool-gray-950 border border-cool-gray-750 text-xs rounded-md text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Organize Mode Buttons */}
                <div className="flex items-center gap-1 self-end sm:self-auto shrink-0 bg-cool-gray-950 p-0.5 rounded-lg border border-cool-gray-850">
                  <button
                    type="button"
                    onClick={() => setOrganizeMode("list")}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer select-none ${
                      organizeMode === "list"
                        ? "bg-cyan-600 text-white font-black"
                        : "text-cool-gray-400 hover:text-white"
                    }`}
                  >
                    Plain List
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrganizeMode("category")}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer select-none ${
                      organizeMode === "category"
                        ? "bg-cyan-600 text-white font-black"
                        : "text-cool-gray-400 hover:text-white"
                    }`}
                  >
                    By Category
                  </button>
                </div>
              </div>
            )}

            {/* List items grid */}
            <div className="overflow-x-auto">
              {!activeList.items || activeList.items.length === 0 ? (
                <div className="text-center py-12 text-cool-gray-450 bg-cool-gray-900/60 border border-dashed border-cool-gray-800 rounded-xl space-y-1">
                  <AlertCircle className="w-8 h-8 text-cool-gray-650 mx-auto" />
                  <p className="font-bold text-xs">
                    This customizable list is currently empty.
                  </p>
                  <p className="text-[10px] text-cool-gray-500">
                    Add catalog items using the dropdown selector above or
                    inline product menus.
                  </p>
                </div>
              ) : filteredListItems.length === 0 ? (
                <div className="text-center py-10 text-cool-gray-450 bg-cool-gray-900/40 border border-dashed border-cool-gray-800 rounded-xl space-y-1.5">
                  <AlertCircle className="w-6 h-6 text-cool-gray-650 mx-auto animate-pulse" />
                  <p className="font-bold text-xs text-cool-gray-300">
                    No matching items found.
                  </p>
                  <p className="text-[10px] text-cool-gray-500">
                    Try adjusting your search criteria or changing the category filter.
                  </p>
                </div>
              ) : organizeMode === "category" ? (
                <div className="space-y-4">
                  {Object.keys(groupedFilteredItems).map((category) => {
                    const items = groupedFilteredItems[category];
                    if (items.length === 0) return null;
                    return (
                      <div key={category} className="bg-cool-gray-900/30 p-3.5 rounded-xl border border-cool-gray-800/85 space-y-2.5 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-cool-gray-800 pb-1.5 px-0.5">
                          <h5 className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                            {category}
                          </h5>
                          <span className="text-[10px] bg-cool-gray-800 text-cool-gray-300 px-2 py-0.5 rounded-full font-mono font-bold border border-cool-gray-750">
                            {items.length} {items.length === 1 ? "item" : "items"}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left text-cool-gray-350">
                            <thead className="text-[10px] uppercase text-cool-gray-500 bg-cool-gray-955/60 tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3 rounded-l-md font-extrabold">Product Details</th>
                                <th className="py-2.5 px-3 font-extrabold text-center">
                                  {activeList.isInventoryControlled ? "Controlled Level & Rule" : "In-Store Quantity"}
                                </th>
                                {activeList.allowNotes && (
                                  <th className="py-2.5 px-3 font-extrabold">Item Notes & Checklist Action</th>
                                )}
                                {activeList.notificationEnabled && (
                                  <th className="py-2.5 px-3 font-extrabold text-center">Notify</th>
                                )}
                                <th className="py-2.5 px-3 rounded-r-md font-extrabold text-right">Delete</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-cool-gray-800/40 font-sans">
                              {renderTableRows(items)}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <table className="w-full text-xs text-left text-cool-gray-350 bg-cool-gray-900/10 rounded-xl border border-cool-gray-800/60 p-1">
                  <thead className="text-[10px] uppercase text-cool-gray-400 bg-cool-gray-900 tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5 rounded-l-md font-extrabold">
                        Product Details
                      </th>
                      <th className="py-2.5 px-3.5 font-extrabold text-center">
                        {activeList.isInventoryControlled ? "Controlled Level & Rule" : "In-Store Quantity"}
                      </th>
                      {activeList.allowNotes && (
                        <th className="py-2.5 px-3.5 font-extrabold">
                          Item Notes & Checklist Action
                        </th>
                      )}
                      {activeList.notificationEnabled && (
                        <th className="py-2.5 px-3.5 font-extrabold text-center">
                          Notify
                        </th>
                      )}
                      <th className="py-2.5 px-3 rounded-r-md font-extrabold text-right">
                        Delete
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cool-gray-800/65 font-sans">
                    {renderTableRows(filteredListItems)}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-cool-gray-800 p-8 rounded-xl text-center text-cool-gray-450 font-semibold border border-cool-gray-750 animate-pulse">
            Please select an active list from the left directory column.
          </div>
        )}
      </div>
    </div>
  ) : (
    /* RENDER VIEW 2: Bulk Matrix & Inventory Control Spreadsheet Grid */
    <div className="space-y-4">
      {/* Matrix Controls & Search Toolbar */}
      <div className="bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-750/80 shadow-md space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-cool-gray-800/80 pb-3">
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-cool-gray-150 flex items-center gap-2">
              <Table className="w-4.5 h-4.5 text-cyan-400" />
              All-Item Inventory Control & List Membership Matrix
            </h4>
            <p className="text-xs text-cool-gray-400">
              Directly toggle item membership, switch inventory tracking control sources, and tune threshold alerts for all products across all custom lists in one central spreadsheet grid.
            </p>
          </div>

          {/* Toast feedback */}
          {matrixToastMsg && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              {matrixToastMsg}
            </div>
          )}
        </div>

        {/* Filter / Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {/* Search */}
          <div className="relative">
            <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-cool-gray-500" />
            <input
              type="text"
              placeholder="Search product, category, SKU..."
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              className="w-full bg-cool-gray-900 border border-cool-gray-700/80 text-cool-gray-200 text-xs pl-8 pr-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 placeholder-cool-gray-500"
            />
          </div>

          {/* Unified Category / Subcategory Filter */}
          <div>
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
              className="w-full bg-cool-gray-900 border border-cool-gray-700/80 text-cool-gray-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all" className="bg-cool-gray-900 text-white font-bold">
                📁 All Categories &amp; Subcategories
              </option>
              {availableCategoryHierarchy.map(({ primary, subs }) => (
                <optgroup key={primary} label={primary} className="bg-cool-gray-900 text-cyan-400 font-bold">
                  <option value={`cat:${primary}`} className="bg-cool-gray-900 text-white font-bold">
                    📁 {primary} (All)
                  </option>
                  {subs.map((sub) => (
                    <option key={`${primary}|${sub}`} value={`sub:${primary}|${sub}`} className="bg-cool-gray-900 text-cool-gray-200">
                      └ {primary} / {sub}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* List Membership Filter */}
          <div>
            <select
              value={matrixMembershipFilter}
              onChange={(e) => setMatrixMembershipFilter(e.target.value as any)}
              className="w-full bg-cool-gray-900 border border-cool-gray-700/80 text-cool-gray-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">Any List Status</option>
              <option value="in_any">In at least 1 list</option>
              <option value="in_none">Not in any list</option>
              <option value="controlled_only">In inventory-controlled lists</option>
            </select>
          </div>

          {/* Filter by Specific List */}
          <div>
            <select
              value={matrixListFilter}
              onChange={(e) => setMatrixListFilter(e.target.value)}
              className="w-full bg-cool-gray-900 border border-cool-gray-700/80 text-cool-gray-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Lists (Full Matrix)</option>
              {customLists.map((cl) => (
                <option key={cl.id} value={cl.id}>Only on: {cl.name}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={matrixSortBy}
              onChange={(e) => setMatrixSortBy(e.target.value as any)}
              className="w-full bg-cool-gray-900 border border-cool-gray-700/80 text-cool-gray-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="category_asc">Sort: Category & Name</option>
              <option value="name_asc">Sort: Product Name (A-Z)</option>
              <option value="name_desc">Sort: Product Name (Z-A)</option>
              <option value="stock_desc">Sort: Total Inventory Stock</option>
            </select>
          </div>
        </div>

        {/* Multi-Select Bulk Actions Toolbar */}
        <div className="bg-cool-gray-900/90 rounded-lg p-2.5 border border-cool-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-cool-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={matrixFilteredProducts.length > 0 && selectedMatrixProdCount === matrixFilteredProducts.length}
                onChange={(e) => handleSelectAllMatrix(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              Select All Filtered ({matrixFilteredProducts.length})
            </label>
            {selectedMatrixProdCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-cyan-950/60 text-cyan-300 font-bold border border-cyan-800/40">
                {selectedMatrixProdCount} selected
              </span>
            )}
          </div>

          {/* Bulk Update Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-cool-gray-400">Batch Edit:</span>

            {/* Target List */}
            <select
              value={bulkListTarget}
              onChange={(e) => setBulkListTarget(e.target.value)}
              className="bg-cool-gray-950 border border-cool-gray-700 text-cool-gray-200 text-xs px-2 py-1 rounded focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {customLists.map((cl) => (
                <option key={cl.id} value={cl.id}>Target: {cl.name}</option>
              ))}
            </select>

            {/* Action Type */}
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

            {/* Parameter for source or threshold */}
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
                  title="Bulk threshold number for list items"
                />
              </div>
            )}

            <button
              type="button"
              onClick={executeBulkMatrixAction}
              disabled={selectedMatrixProdCount === 0 || !bulkListTarget}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Apply to Selected ({selectedMatrixProdCount})
            </button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Matrix Table */}
      <div className="bg-cool-gray-850 rounded-xl border border-cool-gray-750/90 shadow-md overflow-hidden">
        {customLists.length === 0 ? (
          <div className="p-12 text-center text-cool-gray-400 space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="font-semibold text-sm">No custom lists found.</p>
            <p className="text-xs text-cool-gray-500">Create a custom list in the "List Catalog & Items" tab before using the matrix spreadsheet.</p>
          </div>
        ) : matrixFilteredProducts.length === 0 ? (
          <div className="p-12 text-center text-cool-gray-400 space-y-2">
            <SearchIcon className="w-8 h-8 text-cool-gray-500 mx-auto" />
            <p className="font-semibold text-sm">No products match your current search and filter criteria.</p>
            <button
              type="button"
              onClick={() => {
                setMatrixSearch("");
                setMatrixCategory("all");
                setMatrixSubCategory("all");
                setMatrixListFilter("all");
                setMatrixMembershipFilter("all");
              }}
              className="px-3 py-1.5 rounded-lg bg-cool-gray-800 text-cyan-400 hover:bg-cool-gray-750 text-xs font-semibold transition"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-xs text-left text-cool-gray-300 border-collapse">
              {/* Table Header */}
              <thead className="text-[10px] uppercase text-cool-gray-400 bg-cool-gray-950 sticky top-0 z-20 shadow-sm">
                <tr className="border-b border-cool-gray-800 divide-x divide-cool-gray-800/60">
                  {/* Selection Checkbox */}
                  <th className="py-3 px-3 w-10 text-center bg-cool-gray-950 sticky left-0 z-30 shadow-r">
                    <input
                      type="checkbox"
                      checked={selectedMatrixProdCount > 0 && selectedMatrixProdCount === matrixFilteredProducts.length}
                      onChange={(e) => handleSelectAllMatrix(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  {/* Product Details Column */}
                  <th className="py-3 px-3.5 min-w-[200px] font-extrabold text-cool-gray-200 bg-cool-gray-950 sticky left-10 z-30">
                    Product Details & Category
                  </th>
                  {/* Current Inventory Live Levels */}
                  <th className="py-3 px-3 text-center min-w-[140px] font-extrabold text-cool-gray-300 bg-cool-gray-950">
                    Live Stock
                  </th>
                  {/* Dynamic Column for each Custom List */}
                  {customLists.map((cl) => (
                    <th key={cl.id} className="py-2.5 px-3 min-w-[260px] text-left font-extrabold bg-cool-gray-950">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-cyan-300 max-w-[160px]" title={cl.name}>
                          {cl.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {cl.isInventoryControlled && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-950/60 text-amber-300 border border-amber-800/40">
                              Controlled
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-cool-gray-850 text-cool-gray-400">
                            {cl.items?.length || 0} items
                          </span>
                        </div>
                      </div>
                      <div className="text-[9px] text-cool-gray-500 font-normal lowercase tracking-normal flex items-center gap-2 mt-0.5">
                        <span>include</span>
                        <span>•</span>
                        <span>tracking source</span>
                        <span>•</span>
                        <span>threshold</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-cool-gray-800/70 font-sans">
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
                      {/* Checkbox cell (Sticky) */}
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

                      {/* Product Name & Category (Sticky) */}
                      <td className="py-2.5 px-3.5 bg-inherit sticky left-10 z-10">
                        <div className="font-bold text-cool-gray-150 text-xs">
                          {prod.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-cool-gray-400 mt-0.5">
                          <span className="font-semibold text-cyan-400">
                            {prod.primaryCategory || "Uncategorized"}
                          </span>
                          {prod.subCategory && (
                            <>
                              <span>›</span>
                              <span>{prod.subCategory}</span>
                            </>
                          )}
                        </div>
                        {prod.productNumbers && prod.productNumbers.length > 0 && (
                          <div className="text-[9px] text-cool-gray-500 mt-0.5 font-mono">
                            SKU: {prod.productNumbers[0]}
                          </div>
                        )}
                        {prod.barcode && (
                          <div className="text-[9px] text-cool-gray-400 mt-0.5 font-mono">
                            UPC: {prod.barcode}
                          </div>
                        )}
                      </td>

                      {/* Live Stock Summary */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="text-xs font-black text-cool-gray-200">
                          {totalCount} <span className="text-[10px] font-normal text-cool-gray-400">total</span>
                        </div>
                        <div className="text-[10px] text-cool-gray-400 flex items-center justify-center gap-2 mt-0.5">
                          <span>🏠 {onsiteCount} on-site</span>
                          <span>🏢 {offsiteCount} off-site</span>
                        </div>
                      </td>

                      {/* Columns for each custom list */}
                      {customLists.map((cl) => {
                        const listItem = cl.items?.find((item) => item.productId === prod.id);
                        const isIncluded = !!listItem;

                        // Default threshold / control source fallback from product definition or item definition
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
                              {/* Toggle Checkbox */}
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
                                    : "bg-cool-gray-950 text-cool-gray-550 border border-cool-gray-800 hover:text-cool-gray-300"
                                }`}
                                title={isIncluded ? "Click to remove from list" : "Click to add to list"}
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

                              {/* If list is inventory controlled or included, allow editing control source and threshold */}
                              {isIncluded && (
                                <div className="flex items-center gap-1.5 grow">
                                  {/* Control Source Dropdown */}
                                  <select
                                    value={currentCS}
                                    onChange={(e) => {
                                      const nextCS = e.target.value as ControlSourceType;
                                      dispatch({
                                        type: "UPDATE_LIST_ITEM_CONTROL_SOURCE",
                                        payload: {
                                          listId: cl.id,
                                          productId: prod.id,
                                          controlSource: nextCS,
                                        },
                                      });
                                    }}
                                    className="bg-cool-gray-950 border border-cool-gray-800 hover:border-cool-gray-700 text-cool-gray-300 text-[10px] py-1 px-1.5 rounded focus:outline-none focus:border-cyan-500 cursor-pointer max-w-[110px] truncate"
                                    title="Choose inventory tracking source for threshold evaluations"
                                  >
                                    <option value="onsite_count">🏠 On-Site Count</option>
                                    <option value="onsite_weight">🏠 On-Site Weight</option>
                                    <option value="offsite_count">🏢 Off-Site Count</option>
                                    <option value="offsite_weight">🏢 Off-Site Weight</option>
                                    <option value="total_count">🌐 Total Count</option>
                                    <option value="total_weight">🌐 Total Weight</option>
                                  </select>

                                  {/* Threshold Number Input */}
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="Def"
                                      value={currentThreshold !== undefined && currentThreshold !== null ? currentThreshold : ""}
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        const num = valStr === "" ? null : parseFloat(valStr);
                                        dispatch({
                                          type: "UPDATE_LIST_ITEM_THRESHOLD",
                                          payload: {
                                            listId: cl.id,
                                            productId: prod.id,
                                            threshold: num,
                                          },
                                        });
                                      }}
                                      className="w-14 bg-cool-gray-950 border border-cool-gray-800 hover:border-cool-gray-700 focus:border-cyan-500 text-amber-300 font-extrabold text-[10px] py-1 px-1 rounded text-center focus:outline-none"
                                      title="Custom threshold limit for this list. Leave blank for default list threshold."
                                    />
                                    {currentThreshold !== undefined && currentThreshold !== null && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          dispatch({
                                            type: "UPDATE_LIST_ITEM_THRESHOLD",
                                            payload: {
                                              listId: cl.id,
                                              productId: prod.id,
                                              threshold: null,
                                            },
                                          });
                                        }}
                                        className="text-cool-gray-550 hover:text-rose-400 text-[10px] p-0.5 cursor-pointer"
                                        title="Clear custom threshold"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
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
</div>
);
};

interface ManageTagsProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
}

export const ManageTags: React.FC<ManageTagsProps> = ({ state, dispatch }) => {
  const tags = state.tags || [];
  
  // Tag fields state
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isFormVisible, setFormVisible] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagDesc, setTagDesc] = useState("");
  const [tagColor, setTagColor] = useState("#06b6d4"); // Default Cyan
  const [tagExcludeRestock, setTagExcludeRestock] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const activeTagId = selectedTagId || (tags.length > 0 ? tags[0].id : null);
  const activeTag = tags.find(t => t.id === activeTagId);

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
    { value: "#64748b", name: "Slate" }
  ];

  const handleCreateOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!tagName.trim()) {
      setErrorMsg("Tag name is required.");
      return;
    }

    const cleanName = tagName.trim();
    // Id generation / cleaning
    const derivedId = editingTagId || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (!derivedId) {
      setErrorMsg("Valid tag ID could not be generated from the name.");
      return;
    }

    // Check conflict (only for creating new tags)
    if (!editingTagId && tags.some(t => t.id === derivedId)) {
      setErrorMsg(`A tag with reference ID "${derivedId}" already exists. Try a different name.`);
      return;
    }

    if (editingTagId) {
      // Edit tag action
      dispatch({
        type: 'EDIT_TAG',
        payload: {
          tagId: editingTagId,
          updates: {
            name: cleanName,
            description: tagDesc.trim(),
            color: tagColor,
            excludeFromDisplayRestock: tagExcludeRestock
          }
        }
      });
    } else {
      // Create tag action
      dispatch({
        type: 'ADD_TAG',
        payload: {
          tag: {
            id: derivedId,
            name: cleanName,
            description: tagDesc.trim(),
            color: tagColor,
            excludeFromDisplayRestock: tagExcludeRestock
          }
        }
      });
      setSelectedTagId(derivedId);
    }

    // Reset Form
    resetForm();
  };

  const resetForm = () => {
    setFormVisible(false);
    setEditingTagId(null);
    setTagName("");
    setTagDesc("");
    setTagColor("#06b6d4");
    setTagExcludeRestock(false);
    setErrorMsg("");
  };

  const startEdit = (tag: any) => {
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setTagDesc(tag.description || "");
    setTagColor(tag.color || "#06b6d4");
    setTagExcludeRestock(!!tag.excludeFromDisplayRestock);
    setFormVisible(true);
  };

  const handleDelete = (tagId: string, name: string) => {
    if (confirm(`Are you sure you want to delete the tag "${name}"? It will be removed from all inventory state.`)) {
      dispatch({
        type: 'DELETE_TAG',
        payload: { tagId }
      });
      if (activeTagId === tagId) {
        const remaining = tags.filter(t => t.id !== tagId);
        setSelectedTagId(remaining[0]?.id || null);
      }
    }
  };

  return (
    <div className="mt-4 font-sans space-y-6 text-cool-gray-100">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-750/70">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-cool-gray-300">Configured Tags</h2>
              <p className="text-xs text-cool-gray-400 mt-0.5">Manage custom labels to categorize freezer and pantry inventory items. Select a tag to configure its default products below.</p>
            </div>
            {!isFormVisible && (
              <button
                onClick={() => { resetForm(); setFormVisible(true); }}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 transition text-white font-semibold text-xs rounded shadow flex items-center gap-1 cursor-pointer select-none"
              >
                <span>+ Tag</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tags.map(tag => {
              const isSelected = activeTagId === tag.id;
              // Count matching meat cuts or default products
              const cutsCount = (state.meatCuts || []).filter(mc => (mc.tagIds || []).includes(tag.id)).length;
              const defaultProdsCount = (state.products || []).filter(p => (p.defaultTagIds || []).includes(tag.id)).length;

              return (
                <div 
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id)}
                  className={`transition-all duration-200 p-4 rounded-xl flex flex-col justify-between gap-3 h-full relative cursor-pointer group border-2 ${
                    isSelected 
                      ? 'bg-cool-gray-850/85 border-cyan-500/80 shadow-[0_0_15px_-3px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/35'
                      : 'bg-cool-gray-900/50 hover:bg-cool-gray-850/60 border-cool-gray-850/40 hover:border-cool-gray-700/60'
                  }`}
                >
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider select-none">
                      Selected
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <span 
                        style={{ 
                          color: tag.color, 
                          borderColor: tag.color ? `${tag.color}35` : '#3b82f635',
                          backgroundColor: tag.color ? `${tag.color}20` : '#3b82f620'
                        }}
                        className="px-2 py-0.5 rounded text-xs font-black border uppercase tracking-wider inline-flex items-center gap-1 select-none"
                      >
                        <span>{tag.id === 'use-first' ? '⚡' : tag.id === 'not-for-sale' ? '🛑' : '🏷️'}</span>
                        <span>{tag.name}</span>
                      </span>
                    </div>

                    <p className="text-xs text-cool-gray-350 font-medium mt-2 leading-relaxed">
                      {tag.description || <span className="text-cool-gray-500 italic">No description provided.</span>}
                    </p>
                    {tag.excludeFromDisplayRestock && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md">
                          🚫 Excluded from Display Restock
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-cool-gray-800/60 pt-3 flex items-center justify-between mt-auto">
                    <div className="flex gap-2 text-[10px] text-cool-gray-400 font-bold">
                      <span className="bg-cool-gray-950 px-2 py-0.5 rounded flex items-center gap-1 border border-cool-gray-800">
                        📦 {cutsCount} item{cutsCount !== 1 ? 's' : ''}
                      </span>
                      <span className="bg-cool-gray-950 px-2 py-0.5 rounded flex items-center gap-1 border border-cool-gray-800">
                        🏷️ {defaultProdsCount} default{defaultProdsCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => startEdit(tag)}
                        className="p-1 px-1.5 text-xs text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 transition rounded cursor-pointer font-bold border border-cool-gray-800"
                        title="Edit Tag"
                      >
                        ✏️ Edit
                      </button>
                      {tag.id !== 'use-first' && tag.id !== 'not-for-sale' && (
                        <button 
                          onClick={() => handleDelete(tag.id, tag.name)}
                          className="p-1 px-1.5 text-xs text-cool-gray-400 hover:text-rose-400 hover:bg-cool-gray-800 transition rounded cursor-pointer font-bold border border-cool-gray-800"
                          title="Delete Tag"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {tags.length === 0 && (
              <div className="col-span-full text-center py-12 bg-cool-gray-900/10 rounded-xl border border-cool-gray-800">
                <p className="text-cool-gray-400 text-sm">No tags found. Click "+ Tag" to configure some.</p>
              </div>
            )}
          </div>
        </div>

        {/* Form Column */}
        <div className="bg-cool-gray-850 p-5 rounded-xl border border-cool-gray-750/70 h-fit space-y-4">
          {isFormVisible ? (
            <form onSubmit={handleCreateOrEdit} className="space-y-4" onClick={e => e.stopPropagation()}>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-cool-gray-300">
                  {editingTagId ? "Edit Tag Settings" : "Create New Tag"}
                </h3>
                <p className="text-xs text-cool-gray-400 mt-1">
                  Configure visual settings for custom labels in the freezers.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded text-xs leading-normal">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-cool-gray-400">Tag Display Name</label>
                <input 
                  type="text" 
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. For Personal Consumption"
                  className="w-full px-3 py-2 text-xs bg-cool-gray-900 border border-cool-gray-700/60 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 text-cool-gray-150"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-cool-gray-400">Description</label>
                <textarea 
                  value={tagDesc}
                  onChange={(e) => setTagDesc(e.target.value)}
                  placeholder="Briefly state the goal of this tag..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-cool-gray-900 border border-cool-gray-700/60 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 text-cool-gray-150 leading-relaxed resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-cool-gray-400">Label Color Accent</label>
                <div className="grid grid-cols-5 gap-1.5 mt-1">
                  {presetColors.map(color => {
                    const isSelected = tagColor === color.value;
                    return (
                      <button
                        type="button"
                        key={color.value}
                        onClick={() => setTagColor(color.value)}
                        style={{ backgroundColor: color.value }}
                        className={`h-7 rounded border transition flex items-center justify-center select-none cursor-pointer ${isSelected ? 'border-white scale-105 shadow' : 'border-transparent hover:scale-105'}`}
                        title={color.name}
                      >
                        {isSelected && <span className="text-[10px] font-bold text-cool-gray-950">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer bg-cool-gray-900/80 p-2.5 rounded-lg border border-cool-gray-750 hover:border-amber-500/50 transition">
                  <input 
                    type="checkbox"
                    checked={tagExcludeRestock}
                    onChange={(e) => setTagExcludeRestock(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-cool-gray-600 bg-cool-gray-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-amber-300">
                      Exclude from Display Restock
                    </span>
                    <span className="block text-[11px] text-cool-gray-400 leading-tight mt-0.5">
                      Items with this tag will NOT count as available backstock for restocking the Display Case or trigger 0-quantity restock alerts.
                    </span>
                  </div>
                </label>
              </div>

              <div className="space-y-1 bg-cool-gray-950 p-2 rounded border border-cool-gray-800">
                <label className="text-[9px] uppercase font-bold text-cool-gray-500">Preview Layout</label>
                <div className="flex items-center gap-1.5 mt-1">
                  <span 
                    style={{ color: tagColor, borderColor: `${tagColor}35`, backgroundColor: `${tagColor}15`}}
                    className="px-2 py-0.5 rounded text-[10px] font-bold border uppercase inline-block max-w-[150px] truncate"
                  >
                    ⚡ {tagName || "Tag Preview"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-cyan-600 hover:bg-cyan-500 transition text-white font-semibold text-xs rounded shadow select-none cursor-pointer"
                >
                  {editingTagId ? "Save Changes" : "Create Tag"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 transition text-cool-gray-300 font-semibold text-xs rounded shadow border border-cool-gray-700/60 select-none cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-6">
              <span className="text-xl">🏷️</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-cool-gray-400 mt-2">Tag Settings</h4>
              <p className="text-[11px] text-cool-gray-400 mt-1 max-w-[200px] mx-auto leading-normal">
                Select any tag from the list to modify its options, assign it to products below, or click "+ Tag" to write a brand new general classification.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic default products configuration for selected tag */}
      {activeTag && (
        <div className="bg-cool-gray-850 rounded-xl p-5 border border-cool-gray-750/70 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-750/40">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-cool-gray-300 flex items-center gap-2">
                <span>Default assignment for:</span>
                <span 
                  style={{ color: activeTag.color, borderColor: `${activeTag.color}45`, backgroundColor: `${activeTag.color}15` }}
                  className="px-2.5 py-0.5 rounded text-xs font-black border uppercase tracking-wider select-none inline-flex items-center gap-1"
                >
                  <span>{activeTag.id === 'use-first' ? '⚡' : activeTag.id === 'not-for-sale' ? '🛑' : '🏷️'}</span>
                  <span>{activeTag.name}</span>
                </span>
              </h3>
              <p className="text-xs text-cool-gray-400 mt-1">
                Products linked to this tag will automatically be assigned "{activeTag.name}" when added to any freezer or pantry.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="max-w-xl space-y-1.5">
              <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Assign Default Tag to Product
              </label>
              {(() => {
                const availableProds = (state.products || []).filter(p => !(p.defaultTagIds || []).includes(activeTag.id));
                if (availableProds.length === 0) {
                  return (
                    <span className="text-xs text-cool-gray-500 font-medium block h-9 bg-cool-gray-950 border border-cool-gray-800 leading-[34px] px-3.5 rounded-md">
                      All products already have this dynamic default assignment.
                    </span>
                  );
                }
                return (
                  <SearchableProductSelect
                    products={availableProds}
                    value=""
                    onChange={(pid) => {
                      if (!pid) return;
                      const prod = state.products.find(p => p.id === pid);
                      if (prod) {
                        const current = prod.defaultTagIds || [];
                        dispatch({
                          type: 'EDIT_PRODUCT',
                          payload: {
                            productId: prod.id,
                            updates: { defaultTagIds: [...current, activeTag.id] }
                          }
                        });
                      }
                    }}
                    placeholder="Search product to assign default tag..."
                    includeArchived={true}
                  />
                );
              })()}
            </div>

            {/* List of default products */}
            {(() => {
              const assignedProds = (state.products || []).filter(p => (p.defaultTagIds || []).includes(activeTag.id));
              if (assignedProds.length === 0) {
                return (
                  <div className="text-center py-8 bg-cool-gray-900/10 rounded-lg border border-cool-gray-800">
                    <p className="text-cool-gray-500 text-xs">No products are currently configured to receive this default tag.</p>
                  </div>
                );
              }
              return (
                <div className="overflow-x-auto rounded-lg border border-cool-gray-750/70 max-w-4xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-cool-gray-900 text-cool-gray-400 font-black uppercase text-[9px] tracking-wider border-b border-cool-gray-750">
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category Classification</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cool-gray-750/30">
                      {assignedProds.map(p => (
                        <tr key={p.id} className="hover:bg-cool-gray-900/10 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-cool-gray-200">{p.name}</td>
                          <td className="py-2.5 px-3 text-cool-gray-400 font-medium">
                            {p.primaryCategory} &gt; {p.subCategory}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                dispatch({
                                  type: 'EDIT_PRODUCT',
                                  payload: {
                                    productId: p.id,
                                    updates: {
                                      defaultTagIds: (p.defaultTagIds || []).filter(id => id !== activeTag.id)
                                    }
                                  }
                                });
                              }}
                              className="px-2 py-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded transition cursor-pointer"
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
        </div>
      )}
    </div>
  );
};

interface ManageLocationsProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
}

export const ManageLocations: React.FC<ManageLocationsProps> = ({ state, dispatch }) => {
  const locations = state.locations || [];
  
  // States for delete confirm and expandable drawers
  const [confirmDeleteLocId, setConfirmDeleteLocId] = useState<string | null>(null);
  const [expandedLocContents, setExpandedLocContents] = useState<Record<string, boolean>>({});
  
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

  const handleDeleteLoc = (id: string, name: string) => {
    const loc = locations.find(l => l.id === id);
    if (loc && loc.isHome) {
      alert("Cannot delete the active Home/On-Site location. Set another location as Home first.");
      return;
    }
    if (confirm(`Are you sure you want to delete the location "${name}"? This action cannot be undone.`)) {
      dispatch({
        type: "DELETE_LOCATION",
        payload: { locationId: id }
      });
    }
  };

  const handleSetHome = (id: string) => {
    dispatch({
      type: "SET_HOME_LOCATION",
      payload: { locationId: id }
    });
  };

  // Stats for Home summary
  const freezerCount = state.freezers?.filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived)?.length || 0;
  const containerCount = state.containers?.filter(c => c.freezerId && !c.isBox && !c.id.startsWith('box-'))?.length || 0;
  const totalCutsOnSite = state.meatCuts?.reduce((acc, mc) => acc + (mc.quantity || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-cool-gray-850/40 p-4 rounded-xl border border-cool-gray-750/35">
        <div>
          <h3 className="text-lg font-bold text-cool-gray-100 flex items-center gap-2">
            📍 Manage Storage & Delivery Locations
          </h3>
          <p className="text-xs text-cool-gray-400 mt-1">
            Configure on-site home premises, warehousing units, restaurants, packers or butchers.
          </p>
        </div>
        {!isFormVisible && (
          <button
            onClick={() => {
              resetForm();
              setFormVisible(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-black shadow-lg shadow-cyan-950/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <PlusIcon className="w-4 h-4" /> Add Location
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LOCATIONS LIST */}
        <div className="xl:col-span-2 space-y-4">
          {locations.length === 0 ? (
            <div className="bg-cool-gray-850/30 p-12 rounded-2xl border border-dashed border-cool-gray-700 text-center text-cool-gray-400 font-semibold space-y-2">
              <MapPin className="mx-auto w-10 h-10 text-cool-gray-500 animate-pulse" />
              <p>No custom locations found.</p>
              <p className="text-xs text-cool-gray-500 font-medium">Click "Add Location" to register storage centers or delivery/receiving partners.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {locations.map((loc) => {
                const offsiteEntriesForLoc = state.offSiteEntries?.filter(e => {
                  const isArchived = e.archived === true || e.archived === 1 || String(e.archived) === 'true';
                  if (isArchived) return false;

                  if (e.box && state.containers?.some(c => c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
                    return false;
                  }
                  if (e.storageLocationId && e.storageLocationId === loc.id) return true;
                  const locNameLower = loc.name.trim().toLowerCase();
                  if (e.location && e.location.trim().toLowerCase() === locNameLower) return true;
                  return false;
                }) || [];

                const totalOffsiteCuts = offsiteEntriesForLoc.length;
                const totalOffsiteWeight = offsiteEntriesForLoc.reduce((acc, e) => acc + (e.netWeight || 0), 0);
                
                // Unique pallets in this location
                const uniquePallets = new Set(
                  offsiteEntriesForLoc
                    .map(e => (e.pallet || e.currentLocation || '').trim())
                    .filter(p => p && p.toLowerCase() !== 'home' && !p.toLowerCase().includes('loose') && p.toLowerCase() !== 'unassigned' && p.toLowerCase() !== 'none')
                );
                const palletCount = uniquePallets.size;

                return (
                  <div
                    key={loc.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      loc.isHome
                        ? "bg-cool-gray-850 border-cyan-500/80 shadow-lg shadow-cyan-950/10"
                        : "bg-cool-gray-855/75 border-cool-gray-750 hover:border-cool-gray-600"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Name & Type Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-bold text-cool-gray-100 flex items-center gap-1.5 flex-wrap">
                            {loc.name}
                            {loc.isHome && (
                              <span className="text-[9px] font-extrabold text-cyan-400 bg-cyan-950/30 border border-cyan-500/35 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse flex items-center gap-1">
                                <Home className="w-2.5 h-2.5" /> Home Base
                              </span>
                            )}
                          </h4>
                          <span className={`inline-block text-[10px] uppercase font-extrabold px-2 py-0.5 mt-1.5 rounded-full select-none ${
                            loc.type === "storage"
                              ? "bg-indigo-950/40 text-indigo-400 border border-indigo-500/10"
                              : "bg-teal-950/40 text-teal-400 border border-teal-500/10"
                          }`}>
                            {loc.type === "storage" ? "📦 Storage Location" : "🏢 Delivery & Receiving"}
                          </span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1.5 text-xs text-cool-gray-350 font-semibold">
                        {loc.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-cool-gray-450 mt-0.5" />
                            <span className="leading-tight">{loc.address}</span>
                          </div>
                        )}
                        {loc.contact && (
                          <div className="flex items-start gap-2">
                            <Phone className="w-3.5 h-3.5 shrink-0 text-cool-gray-450 mt-0.5" />
                            <span>{loc.contact}</span>
                          </div>
                        )}
                      </div>

                      {/* Notes Box */}
                      {loc.notes && (
                        <div className="p-3 rounded-lg bg-cool-gray-900/50 border border-cool-gray-805 text-xs text-cool-gray-350 italic font-mono leading-relaxed">
                          {loc.notes}
                        </div>
                      )}

                      {/* On-Site stats showcase */}
                      {loc.isHome ? (
                        <div className="mt-3 p-3 rounded-xl bg-cyan-950/10 border border-cyan-500/15 grid grid-cols-3 gap-2 text-center text-xs">
                          <div>
                            <span className="block text-[10px] text-cool-gray-450 uppercase font-extrabold">Freezers</span>
                            <span className="font-extrabold text-cyan-400 mt-0.5 block">{freezerCount} units</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-cool-gray-450 uppercase font-extrabold">Bins</span>
                            <span className="font-extrabold text-cyan-400 mt-0.5 block">{containerCount} places</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-cool-gray-450 uppercase font-extrabold">On-Site</span>
                            <span className="font-extrabold text-cyan-400 mt-0.5 block">{totalCutsOnSite} cuts</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="mt-3 p-3 rounded-xl bg-indigo-950/10 border border-indigo-500/15 grid grid-cols-3 gap-2 text-center text-xs">
                            <div>
                              <span className="block text-[10px] text-cool-gray-450 uppercase font-extrabold">Pallets</span>
                              <span className="font-extrabold text-indigo-400 mt-0.5 block">{palletCount} units</span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-cool-gray-450 uppercase font-extrabold">Boxes/Cuts</span>
                              <span className="font-extrabold text-indigo-400 mt-0.5 block">{totalOffsiteCuts} items</span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-cool-gray-450 uppercase font-extrabold">Weight</span>
                              <span className="font-extrabold text-indigo-400 mt-0.5 block">{totalOffsiteWeight.toFixed(1)} lbs</span>
                            </div>
                          </div>
                          
                          {totalOffsiteCuts > 0 && (
                            <div className="mt-2.5">
                              <button
                                type="button"
                                onClick={() => setExpandedLocContents(prev => ({ ...prev, [loc.id]: !prev[loc.id] }))}
                                className="w-full text-left text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center justify-between py-1 px-1.5 bg-cool-gray-800/30 hover:bg-cool-gray-800/60 rounded-lg cursor-pointer transition border border-indigo-500/10"
                              >
                                <span>{expandedLocContents[loc.id] ? "▼ Hide Stored Offsite Contents" : "▶ Show Stored Offsite Contents"}</span>
                                <span className="text-[9px] bg-indigo-950/50 px-1.5 py-0.5 rounded-full border border-indigo-805 font-mono">View Manifest</span>
                              </button>
                              
                              {expandedLocContents[loc.id] && (
                                <div className="mt-2 p-2.5 bg-cool-gray-900/40 border border-cool-gray-800 rounded-xl space-y-2 text-[11px] font-sans text-cool-gray-300 max-h-48 overflow-y-auto">
                                  {Array.from(uniquePallets).map(pName => {
                                    const palletCuts = offsiteEntriesForLoc.filter(e => (e.pallet || e.currentLocation || '').trim() === pName);
                                    const palletWeight = palletCuts.reduce((sum, e) => sum + (e.netWeight || 0), 0);
                                    return (
                                      <div key={pName} className="border-b border-cool-gray-805 last:border-0 pb-2 last:pb-0">
                                        <div className="flex items-center justify-between font-bold text-cool-gray-200 border-b border-cool-gray-800/40 pb-0.5 group">
                                          <div className="flex items-center gap-2">
                                            <span>📦 {pName}</span>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setRenamePalletModal({ isOpen: true, oldName: pName, newName: pName });
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 text-cool-gray-500 hover:text-amber-400 transition-all rounded hover:bg-cool-gray-800"
                                              title="Rename Pallet"
                                            >
                                              <Edit3 size={12} />
                                            </button>
                                          </div>
                                          <span className="text-[10px] text-cyan-400 font-medium">{palletCuts.length} cuts • {palletWeight.toFixed(1)} lbs</span>
                                        </div>
                                        <div className="space-y-1 mt-1 pl-2.5">
                                          {palletCuts.map(e => (
                                            <div key={e.id} className="flex justify-between items-center text-xs font-mono py-0.5">
                                              <span className="truncate text-cool-gray-350 pr-2 max-w-[130px]" title={(state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)}>{(state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)}</span>
                                              <span className="text-cyan-400 shrink-0 font-bold">{e.netWeight.toFixed(1)} lbs</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons footer */}
                    <div className="mt-5 pt-3 border-t border-cool-gray-800/40 flex items-center justify-between gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClick(loc)}
                          className="p-1.5 md:px-2.5 md:py-1 hover:bg-cool-gray-800 text-cool-gray-300 rounded-lg text-xs font-bold hover:text-white transition flex items-center gap-1 cursor-pointer border border-transparent hover:border-cool-gray-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> <span className="hidden md:inline">Edit</span>
                        </button>
                        {!loc.isHome && (
                          confirmDeleteLocId === loc.id ? (
                            <div className="flex items-center gap-1.5 animate-fade-in pl-1">
                              <button
                                onClick={() => {
                                  dispatch({
                                    type: "DELETE_LOCATION",
                                    payload: { locationId: loc.id }
                                  });
                                  setConfirmDeleteLocId(null);
                                }}
                                className="px-2 py-1 bg-red-650 hover:bg-red-700 text-white font-extrabold text-[10px] rounded-md transition cursor-pointer shadow-sm animate-pulse"
                                title="Confirm permanently deleting this location"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteLocId(null)}
                                className="px-1.5 py-1 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-[10px] font-bold rounded-md cursor-pointer transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                const l = locations.find(x => x.id === loc.id);
                                if (l && l.isHome) {
                                  alert("Cannot delete active Home Base.");
                                  return;
                                }
                                setConfirmDeleteLocId(loc.id);
                              }}
                              className="p-1.5 md:px-2.5 md:py-1 hover:bg-rose-950/20 text-cool-gray-450 hover:text-rose-450 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-transparent hover:border-rose-900/35"
                              title="Delete Location"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> <span className="hidden md:inline">Delete</span>
                            </button>
                          )
                        )}
                      </div>

                      {!loc.isHome && (
                        <button
                          onClick={() => handleSetHome(loc.id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-cyan-500 hover:text-cyan-405 hover:bg-cyan-950/20 border border-cyan-800/30 rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                          <Home className="w-3 h-3" /> Set as Home
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LOCATION FORM */}
        <div className="col-span-1">
          {isFormVisible ? (
            <form
              onSubmit={handleCreateOrEdit}
              className="bg-cool-gray-850 p-5 rounded-2xl border border-cool-gray-750 shadow-xl space-y-4 animate-scale-up"
            >
              <div className="border-b border-cool-gray-700 pb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-1.5">
                  {editingLocId ? "🔄 Edit Location" : "✨ New Location"}
                </h4>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-1 hover:bg-cool-gray-700 text-cool-gray-450 hover:text-white rounded transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-950/35 border border-rose-500/25 rounded-md text-xs text-rose-300 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-cool-gray-350">
                  Location Name
                </label>
                <input
                  type="text"
                  required
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  placeholder="e.g. Cold Storage Pallets, Big Sky Sizzler"
                  className="w-full bg-cool-gray-900 border border-cool-gray-700/80 rounded-lg px-3 py-2 text-white placeholder-cool-gray-550 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-cool-gray-350">
                  Type of Facility
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLocType("storage")}
                    className={`p-2.5 border rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 select-none cursor-pointer ${
                      locType === "storage"
                        ? "bg-indigo-950/20 border-indigo-500 text-indigo-400"
                        : "bg-cool-gray-900/60 border-cool-gray-700 text-cool-gray-400 hover:text-white"
                    }`}
                  >
                    <Warehouse className="w-4 h-4" />
                    <span>📦 Storage Room</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocType("delivery_pickup")}
                    className={`p-2.5 border rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 select-none cursor-pointer ${
                      locType === "delivery_pickup"
                        ? "bg-teal-950/20 border-teal-500 text-teal-400"
                        : "bg-cool-gray-900/60 border-cool-gray-700 text-cool-gray-400 hover:text-white"
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <span>🏢 Delivery & Receiving</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-cool-gray-350">
                  Address
                </label>
                <textarea
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  placeholder="Full physical street address..."
                  rows={2}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700/80 rounded-lg px-3 py-2 text-white placeholder-cool-gray-550 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-semibold resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-cool-gray-355">
                  Contact Information
                </label>
                <input
                  type="text"
                  value={locContact}
                  onChange={(e) => setLocContact(e.target.value)}
                  placeholder="Manager / Phone / Email..."
                  className="w-full bg-cool-gray-900 border border-cool-gray-700/80 rounded-lg px-3 py-2 text-white placeholder-cool-gray-550 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-cool-gray-350">
                  General Notes
                </label>
                <textarea
                  value={locNotes}
                  onChange={(e) => setLocNotes(e.target.value)}
                  placeholder="Access codes, dock requirements, delivery timetables..."
                  rows={3}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700/80 rounded-lg px-3 py-2 text-white placeholder-cool-gray-550 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-semibold resize-none"
                />
              </div>

              {!editingLocId && (
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isHome}
                      onChange={(e) => setIsHome(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded bg-cool-gray-950 border-cool-gray-750 text-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                    <div className="text-[11px] leading-snug">
                      <span className="font-bold text-cool-gray-200 block">Set as Active Home Base</span>
                      <span className="text-cool-gray-450 block mt-0.5">Select this to route on-site freezer storage dashboard under it.</span>
                    </div>
                  </label>
                </div>
              )}

              <div className="pt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-grow p-2.5 bg-cool-gray-800 border border-cool-gray-700 rounded-xl text-cool-gray-300 text-xs font-bold hover:bg-cool-gray-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-grow p-2.5 bg-cyan-600 hover:bg-cyan-550 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-cyan-950/20"
                >
                  {editingLocId ? "Save Changes" : "Create Location"}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-5 rounded-2xl bg-cool-gray-850/50 border border-cool-gray-755 border-dashed text-cool-gray-405 space-y-3.5 leading-relaxed text-xs">
              <span className="font-bold text-cool-gray-200 block">💡 Locations Architecture</span>
              <p>The **Home Location** houses your on-site freezers, chest units, shelf slots and loose inventory cuts.</p>
              <p>Other **Off-Site Storage locations** track pallets, boxes and bulk cuts in transit.</p>
              <p>**Delivery outlets** (restaurants, retail centers, processors, butchers) lets you log exactly where wholesale products are routed.</p>
              <button
                onClick={() => {
                  resetForm();
                  setFormVisible(true);
                }}
                className="w-full p-2 bg-cool-gray-800 hover:bg-cool-gray-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                + Register New Location
              </button>
            </div>
          )}
        </div>
      </div>

      {renamePalletModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-2">Rename Pallet</h3>
            <p className="text-sm text-cool-gray-400 mb-4">
              Renaming <span className="font-mono text-amber-400">{renamePalletModal.oldName}</span> will update all existing off-site items and movement targets using this pallet.
            </p>
            <input
              type="text"
              value={renamePalletModal.newName || ''}
              onChange={(e) => setRenamePalletModal({ ...renamePalletModal, newName: e.target.value })}
              className="w-full bg-cool-gray-950 border border-cool-gray-800 rounded-xl p-3 text-white mb-6 focus:border-amber-500 focus:outline-none"
              placeholder="New Pallet Name"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRenamePalletModal(null)}
                className="px-4 py-2 rounded-xl text-cool-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
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

export const NotificationCenterComponent: React.FC<{
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
}> = ({ state, dispatch }) => {
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestMode, setDigestMode] = useState<"combined" | "individual">("combined");
  const [digestTime, setDigestTime] = useState("20:00");
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });
  const [method, setMethod] = useState<"in_app" | "smtp_email" | "webhook">("in_app");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpTo, setSmtpTo] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);

  const [haNotifyService, setHaNotifyService] = useState("notify.notify");
  const [haUrl, setHaUrl] = useState("");
  const [haToken, setHaToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string; results?: any } | null>(null);

  useEffect(() => {
    fetch(getApiUrl("api/notifications/settings"))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data) {
          setDigestEnabled(!!data.digestEnabled);
          setDigestMode(data.digestMode || "combined");
          setDigestTime(data.digestTime || "20:00");
          if (data.timezone) {
            setTimezone(data.timezone);
          }
          if (data.method === "ha_persistent" || data.method === "ha_notify") {
            setMethod("in_app");
          } else {
            setMethod(data.method || "in_app");
          }

          setSmtpHost(data.smtpHost || "");
          setSmtpPort(Number(data.smtpPort) || 587);
          setSmtpUser(data.smtpUser || "");
          setSmtpPass(data.smtpPass || "");
          setSmtpFrom(data.smtpFrom || "");
          setSmtpTo(data.smtpTo || "");
          setSmtpSecure(!!data.smtpSecure);

          setHaNotifyService(data.haNotifyService || "notify.notify");
          setHaUrl(data.haUrl || "");
          setHaToken(data.haToken || "");
          setWebhookUrl(data.webhookUrl || "");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load notification settings:", err);
        setIsLoading(false);
      });
  }, []);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setTestResult(null);
    setTriggerResult(null);

    const settings = {
      id: "global",
      digestEnabled,
      digestMode,
      digestTime,
      timezone,
      method,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      smtpTo,
      smtpSecure,
      haNotifyService,
      haUrl,
      haToken,
      webhookUrl,
    };

    try {
      const res = await fetch(getApiUrl("api/notifications/save-settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: "Notification settings saved successfully!" });
      } else {
        setTestResult({ success: false, message: data.error || "Failed to save settings." });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Network error while saving." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSettings = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTriggerResult(null);

    const settings = {
      id: "global",
      digestEnabled,
      digestMode,
      digestTime,
      timezone,
      method,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      smtpTo,
      smtpSecure,
      haNotifyService,
      haUrl,
      haToken,
      webhookUrl,
    };

    try {
      const res = await fetch(getApiUrl("api/notifications/test-settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: "Gateway connection test succeeded! Test message delivered successfully." });
      } else {
        setTestResult({ success: false, message: data.error || "Gateway connection test failed. Please verify credentials." });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Network error while testing." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTriggerNow = async () => {
    setIsTriggering(true);
    setTestResult(null);
    setTriggerResult(null);

    try {
      const res = await fetch(getApiUrl("api/notifications/trigger-now"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listIds: null }), // triggers all lists
      });
      const data = await res.json();
      if (data.success) {
        setTriggerResult({
          success: true,
          message: `Daily digests executed successfully! ${data.messagesSent || 0} notifications dispatched.`,
        });
      } else {
        setTriggerResult({ success: false, message: data.error || "Failed to trigger notifications." });
      }
    } catch (err: any) {
      setTriggerResult({ success: false, message: err.message || "Network error while triggering." });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all notification log history?")) return;
    try {
      await fetch(getApiUrl("api/notifications/clear-logs"), { method: "POST" });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-cool-gray-850 p-8 border border-cool-gray-750 rounded-xl text-center text-cool-gray-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
        <span className="font-bold">Loading Notification Engine configuration...</span>
      </div>
    );
  }

  const logs = state.notificationLogs || [];

  return (
    <div className="bg-cool-gray-855 p-5 rounded-xl border border-cool-gray-750 shadow-sm space-y-5 animate-fade-in text-sm text-cool-gray-200">
      <div className="border-b border-cool-gray-700 pb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-extrabold text-cool-gray-150 flex items-center gap-2">
            <Bell size={20} className="text-amber-500" />
            Notification Center Settings
          </h4>
          <p className="text-xs text-cool-gray-400 mt-0.5">
            Configure gateways, SMTP routes, webhooks, and automated daily inventory digest timers.
          </p>
        </div>
        <span className="text-[10px] font-bold text-amber-400 bg-amber-950/20 border border-amber-500/20 px-2.5 py-0.5 rounded font-mono uppercase tracking-widest">
          Engine Active
        </span>
      </div>

      {testResult && (
        <div
          className={`p-3.5 rounded-lg border flex items-start gap-3 text-xs animate-scale-up ${
            testResult.success
              ? "bg-green-950/20 border-green-500/30 text-green-400"
              : "bg-rose-950/20 border-rose-500/30 text-rose-450"
          }`}
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="font-semibold">{testResult.message}</div>
        </div>
      )}

      {triggerResult && (
        <div
          className={`p-3.5 rounded-lg border flex items-start gap-3 text-xs animate-scale-up ${
            triggerResult.success
              ? "bg-amber-950/20 border-amber-500/30 text-amber-400"
              : "bg-rose-950/20 border-rose-500/30 text-rose-450"
          }`}
        >
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <div className="font-semibold">{triggerResult.message}</div>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-5">
        {/* SECTION 1: Automatic Scheduled Digests */}
        <div className="bg-cool-gray-900 rounded-xl p-4 border border-cool-gray-800 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="digestEnabledCheck"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <div className="text-xs leading-normal">
                <label htmlFor="digestEnabledCheck" className="font-bold text-cool-gray-200 block cursor-pointer select-none">
                  Enable Scheduled Daily Digests
                </label>
                <span className="text-cool-gray-400 block mt-0.5">
                  Automatically bundle notifiable lists and dispatch them daily at your chosen hour.
                </span>
              </div>
            </div>
          </div>

          {digestEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2.5 border-t border-cool-gray-800 animate-scale-up">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cool-gray-300 block">
                  Digest Delivery Option
                </label>
                <select
                  value={digestMode}
                  onChange={(e: any) => setDigestMode(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-850 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="combined">Combined daily digest (single notification for all lists)</option>
                  <option value="individual">Individual list daily digest (one notification per list)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cool-gray-300 block">
                  Daily Dispatch Hour
                </label>
                <input
                  type="time"
                  required
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-850 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cool-gray-300 block">
                  Time Zone
                </label>
                <select
                  value={timezone}
                  onChange={(e: any) => setTimezone(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-850 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="America/New_York">Eastern Time (America/New_York)</option>
                  <option value="America/Chicago">Central Time (America/Chicago)</option>
                  <option value="America/Denver">Mountain Time (America/Denver)</option>
                  <option value="America/Phoenix">Arizona (America/Phoenix)</option>
                  <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
                  <option value="America/Anchorage">Alaska Time (America/Anchorage)</option>
                  <option value="Pacific/Honolulu">Hawaii Time (Pacific/Honolulu)</option>
                  <option value="Europe/London">London / GMT (Europe/London)</option>
                  <option value="Europe/Paris">Central Europe (Europe/Paris)</option>
                  <option value="Europe/Athens">Eastern Europe (Europe/Athens)</option>
                  <option value="Asia/Tokyo">Japan (Asia/Tokyo)</option>
                  <option value="Asia/Sydney">Sydney (Australia/Sydney)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Dispatch Gateway selection */}
        <div className="bg-cool-gray-900 rounded-xl p-4 border border-cool-gray-800 space-y-4">
          <h5 className="text-xs font-bold text-cool-gray-300 uppercase tracking-widest flex items-center gap-2 border-b border-cool-gray-850 pb-2">
            <Mail size={14} className="text-cyan-400" /> Notification Delivery Method & Gateways
          </h5>

          <div className="space-y-2">
            <label className="text-xs font-bold text-cool-gray-400 block">
              Active Delivery Gateway
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className={`flex items-center gap-2.5 p-2.5 border rounded cursor-pointer select-none transition-all ${method === "smtp_email" ? "bg-cyan-950/15 border-cyan-500/70 text-cyan-300" : "bg-cool-gray-950 border-cool-gray-800 text-cool-gray-450 hover:border-cool-gray-700"}`}>
                <input type="radio" name="deliveryMethod" value="smtp_email" checked={method === "smtp_email"} onChange={() => setMethod("smtp_email")} className="w-3.5 h-3.5 text-cyan-500" />
                <div className="text-left leading-normal">
                  <span className="font-extrabold text-xs block">SMTP Email</span>
                  <span className="text-[9px] block">Deliver as email reports</span>
                </div>
              </label>

              <label className={`flex items-center gap-2.5 p-2.5 border rounded cursor-pointer select-none transition-all ${method === "webhook" ? "bg-purple-950/15 border-purple-500/70 text-purple-300" : "bg-cool-gray-950 border-cool-gray-800 text-cool-gray-455 hover:border-cool-gray-700"}`}>
                <input type="radio" name="deliveryMethod" value="webhook" checked={method === "webhook"} onChange={() => setMethod("webhook")} className="w-3.5 h-3.5 text-purple-500" />
                <div className="text-left leading-normal">
                  <span className="font-extrabold text-xs block">Webhook POST</span>
                  <span className="text-[9px] block">Send JSON payload to URL</span>
                </div>
              </label>

              <label className={`flex items-center gap-2.5 p-2.5 border rounded cursor-pointer select-none transition-all ${method === "in_app" ? "bg-cool-gray-900 border-cool-gray-700 text-cool-gray-200" : "bg-cool-gray-950 border-cool-gray-800 text-cool-gray-455 hover:border-cool-gray-700"}`}>
                <input type="radio" name="deliveryMethod" value="in_app" checked={method === "in_app"} onChange={() => setMethod("in_app")} className="w-3.5 h-3.5 text-cool-gray-500" />
                <div className="text-left leading-normal">
                  <span className="font-extrabold text-xs block">In-App Log Only</span>
                  <span className="text-[9px] block">Write history logs only</span>
                </div>
              </label>
            </div>
          </div>

          {/* GATEWAY OPTIONS: SMTP EMAIL */}
          {method === "smtp_email" && (
            <div className="p-4 bg-cool-gray-950 rounded-xl border border-cool-gray-800 space-y-3 animate-scale-up text-xs">
              <h6 className="font-bold text-cyan-400 block mb-1">📬 SMTP Credentials & Addressing</h6>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold block">SMTP Host Server</label>
                  <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded p-2 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold block">SMTP Port</label>
                  <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} placeholder="587" className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded p-2 text-white" />
                </div>
                <div className="space-y-1 pt-4.5 flex items-center pl-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} className="w-4 h-4 bg-cool-gray-900 border-cool-gray-750 rounded text-cyan-500 focus:ring-1" />
                    <span className="font-bold text-cool-gray-300">Use SSL (Port 465)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold block">SMTP User Login</label>
                  <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="your-email@gmail.com" className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded p-2 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold block">SMTP Account Password / App Key</label>
                  <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••••••••••" className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded p-2 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-cool-gray-850 pt-2">
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold block">Sender Address ("From")</label>
                  <input type="email" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="Freezer Tracker <your-email@gmail.com>" className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded p-2 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold block">Recipient Address ("To")</label>
                  <input type="text" value={smtpTo} onChange={(e) => setSmtpTo(e.target.value)} placeholder="butcher-shop@domain.com" className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded p-2 text-white" />
                </div>
              </div>
            </div>
          )}

          {/* GATEWAY OPTIONS: WEBHOOK */}
          {method === "webhook" && (
            <div className="p-4 bg-cool-gray-950 rounded-xl border border-cool-gray-800 space-y-3 animate-scale-up text-xs">
              <h6 className="font-bold text-purple-400 block mb-1">🔗 Outgoing JSON Webhook Router</h6>
              <div className="space-y-1">
                <label className="text-cool-gray-400 font-bold block">Target HTTP Webhook URL</label>
                <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://api.domain.com/v1/endpoints/freezer-notifications" className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded p-2 text-white font-mono" />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Bottom action console */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestSettings}
              className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-250 hover:text-white border border-cool-gray-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 select-none cursor-pointer"
            >
              <RefreshCw size={13} className={isTesting ? "animate-spin text-cyan-400" : "text-cyan-500"} />
              {isTesting ? "Testing Gateway..." : "Test Gateway Setup"}
            </button>

            <button
              type="button"
              disabled={isTriggering}
              onClick={handleTriggerNow}
              className="px-4 py-2 bg-amber-950/20 border border-amber-900/35 hover:bg-amber-900/30 text-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 select-none cursor-pointer"
              title="Deliver digest reports configured above immediately to active receivers."
            >
              <Send size={13} className={isTriggering ? "animate-pulse" : ""} />
              {isTriggering ? "Dispatching Digests..." : "Send Notification Now"}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-5 py-2 bg-cyan-600 hover:bg-cyan-550 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-950/15"
          >
            <Save size={13} />
            {isSaving ? "Saving Settings..." : "Save Configuration"}
          </button>
        </div>
      </form>

      {/* SECTION 4: Dispatch History & logs feed */}
      <div className="bg-cool-gray-900 rounded-xl p-4 border border-cool-gray-800 space-y-3">
        <div className="flex justify-between items-center border-b border-cool-gray-850 pb-2">
          <h5 className="text-xs font-bold text-cool-gray-300 uppercase tracking-widest flex items-center gap-2">
            <History size={14} className="text-amber-400" /> System Dispatch Logs Feed
          </h5>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="text-[10px] bg-red-950/10 hover:bg-red-950/30 text-red-400 border border-red-950/30 px-2 py-1 rounded transition cursor-pointer"
            >
              Clear Logs History
            </button>
          )}
        </div>

        <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 font-sans">
          {logs.map((log) => (
            <div key={log.id} className="p-2.5 rounded bg-cool-gray-950 border border-cool-gray-850 flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-cool-gray-250 truncate max-w-[250px]">{log.title}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${log.status === "success" ? "bg-green-950/20 text-green-400 border border-green-950/20" : "bg-rose-950/25 text-rose-400 border border-rose-950/20"}`}>
                  {log.status === "success" ? "● Success" : "● Failed"}
                </span>
              </div>
              <div className="text-[10px] text-cool-gray-400 truncate font-mono leading-relaxed">{log.message}</div>
              {log.error && <div className="text-[9px] text-rose-450 bg-rose-950/15 p-1 rounded font-mono border border-rose-950/20 mt-1">{log.error}</div>}
              <div className="flex items-center justify-between text-[9px] text-cool-gray-500 font-bold uppercase tracking-wider mt-1 border-t border-cool-gray-850/40 pt-1">
                <span>Method: {log.method}</span>
                <span>{new Date(log.sentAt).toLocaleString()}</span>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="p-6 text-center text-cool-gray-500 text-xs">
              No recent notifications dispatched yet. Configure lists and gateways above to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryView;
