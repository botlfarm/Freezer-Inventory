import { AppConfigItem, Product } from '../types';
import { getApiUrl } from '../hooks/apiUrl';

export type SortMode = 'alphabetical' | 'custom';

export interface CustomHierarchyOrder {
  primaryCategories: string[];
  subCategories: Record<string, string[]>;
  productOrder: Record<string, string[]>; // Key is `${primaryCategory}:::${subCategory}`
}

export interface SortOrderConfig {
  productSortMode: SortMode;
  displaySortMode: SortMode;
  customOrder: CustomHierarchyOrder;
}

export const SORT_CONFIG_KEY = 'sort-hierarchy-config';

export const DEFAULT_SORT_CONFIG: SortOrderConfig = {
  productSortMode: 'alphabetical',
  displaySortMode: 'alphabetical',
  customOrder: {
    primaryCategories: [],
    subCategories: {},
    productOrder: {}
  }
};

/**
 * Parses and retrieves the hierarchy sort configuration from state.appConfig.
 */
export function loadSortOrderConfig(appConfig?: AppConfigItem[]): SortOrderConfig {
  if (!appConfig || !Array.isArray(appConfig)) {
    return { ...DEFAULT_SORT_CONFIG };
  }

  const configItem = appConfig.find(item => item.key === SORT_CONFIG_KEY);
  if (!configItem || !configItem.value) {
    return { ...DEFAULT_SORT_CONFIG };
  }

  try {
    const parsed = typeof configItem.value === 'string' ? JSON.parse(configItem.value) : configItem.value;
    return {
      productSortMode: parsed.productSortMode === 'custom' ? 'custom' : 'alphabetical',
      displaySortMode: parsed.displaySortMode === 'custom' ? 'custom' : 'alphabetical',
      customOrder: {
        primaryCategories: Array.isArray(parsed.customOrder?.primaryCategories) ? parsed.customOrder.primaryCategories : [],
        subCategories: (parsed.customOrder?.subCategories && typeof parsed.customOrder.subCategories === 'object') ? parsed.customOrder.subCategories : {},
        productOrder: (parsed.customOrder?.productOrder && typeof parsed.customOrder.productOrder === 'object') ? parsed.customOrder.productOrder : {}
      }
    };
  } catch (e) {
    console.error('Failed to parse hierarchy sort configuration:', e);
    return { ...DEFAULT_SORT_CONFIG };
  }
}

/**
 * Persists the sort order configuration to the database via /api/app-config.
 */
export async function saveSortOrderConfig(config: SortOrderConfig): Promise<boolean> {
  try {
    const payload = {
      key: SORT_CONFIG_KEY,
      value: JSON.stringify(config)
    };
    const response = await fetch(getApiUrl('api/app-config'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (err) {
    console.error('Failed to save sort configuration:', err);
    return false;
  }
}

/**
 * Natural string comparison helper for alphabetical mode
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Sorts primary categories based on mode ('alphabetical' or 'custom')
 */
export function sortPrimaryCategories(
  categories: string[],
  mode: SortMode,
  customOrder?: CustomHierarchyOrder
): string[] {
  if (mode === 'alphabetical' || !customOrder?.primaryCategories || customOrder.primaryCategories.length === 0) {
    return [...categories].sort(naturalCompare);
  }

  const orderMap = new Map<string, number>();
  customOrder.primaryCategories.forEach((cat, idx) => {
    orderMap.set(cat.toLowerCase().trim(), idx);
  });

  return [...categories].sort((a, b) => {
    const aKey = a.toLowerCase().trim();
    const bKey = b.toLowerCase().trim();
    const aIndex = orderMap.has(aKey) ? orderMap.get(aKey)! : -1;
    const bIndex = orderMap.has(bKey) ? orderMap.get(bKey)! : -1;

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return naturalCompare(a, b);
  });
}

/**
 * Sorts subcategories within a given primary category based on mode ('alphabetical' or 'custom')
 */
export function sortSubCategories(
  subCategories: string[],
  primaryCategory: string,
  mode: SortMode,
  customOrder?: CustomHierarchyOrder
): string[] {
  const customList = customOrder?.subCategories?.[primaryCategory] || 
                     customOrder?.subCategories?.[primaryCategory.toLowerCase().trim()];

  if (mode === 'alphabetical' || !customList || customList.length === 0) {
    return [...subCategories].sort(naturalCompare);
  }

  const orderMap = new Map<string, number>();
  customList.forEach((sub, idx) => {
    orderMap.set(sub.toLowerCase().trim(), idx);
  });

  return [...subCategories].sort((a, b) => {
    const aKey = a.toLowerCase().trim();
    const bKey = b.toLowerCase().trim();
    const aIndex = orderMap.has(aKey) ? orderMap.get(aKey)! : -1;
    const bIndex = orderMap.has(bKey) ? orderMap.get(bKey)! : -1;

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return naturalCompare(a, b);
  });
}

/**
 * Sorts product items (or objects with a product property) within a primary+sub category
 */
export function sortProductsHierarchy<T>(
  items: T[],
  primaryCategory: string,
  subCategory: string,
  mode: SortMode,
  customOrder?: CustomHierarchyOrder
): T[] {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  const hierarchyKey = `${primaryCategory}:::${subCategory}`;
  const customList = customOrder?.productOrder?.[hierarchyKey] || 
                     customOrder?.productOrder?.[`${primaryCategory.toLowerCase().trim()}:::${subCategory.toLowerCase().trim()}`];

  const getProductName = (item: any): string => {
    if (item && typeof item === 'object') {
      if (item.product && typeof item.product === 'object' && item.product.name) {
        return item.product.name;
      }
      if (item.name) {
        return item.name;
      }
    }
    return '';
  };

  const getProductId = (item: any): string => {
    if (item && typeof item === 'object') {
      if (item.product && typeof item.product === 'object' && item.product.id) {
        return item.product.id;
      }
      if (item.id) {
        return item.id;
      }
    }
    return '';
  };

  if (mode === 'alphabetical' || !customList || customList.length === 0) {
    return [...items].sort((a, b) => naturalCompare(getProductName(a), getProductName(b)));
  }

  const orderMap = new Map<string, number>();
  customList.forEach((entry, idx) => {
    orderMap.set(entry.toLowerCase().trim(), idx);
  });

  return [...items].sort((a, b) => {
    const aNameKey = getProductName(a).toLowerCase().trim();
    const bNameKey = getProductName(b).toLowerCase().trim();
    const aIdKey = getProductId(a).toLowerCase().trim();
    const bIdKey = getProductId(b).toLowerCase().trim();

    // Check by name or by ID
    const aIndex = orderMap.has(aNameKey) ? orderMap.get(aNameKey)! : (orderMap.has(aIdKey) ? orderMap.get(aIdKey)! : -1);
    const bIndex = orderMap.has(bNameKey) ? orderMap.get(bNameKey)! : (orderMap.has(bIdKey) ? orderMap.get(bIdKey)! : -1);

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return naturalCompare(getProductName(a), getProductName(b));
  });
}
