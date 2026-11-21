export type LibraryTab =
  | 'products'
  | 'containers'
  | 'freezers'
  | 'pallets'
  | 'lists'
  | 'settings'
  | 'import'
  | 'tags'
  | 'locations'
  | 'photos'
  | 'users_devices'
  | 'notifications'
  | 'pwa'
  | 'voice_dictionary'
  | 'offsite_settings'
  | 'butcher_settings';

export type LibraryGroupId = 'catalog' | 'operations' | 'admin';

export interface LibrarySectionMeta {
  id: Exclude<LibraryTab, 'pwa' | 'pallets'>;
  groupId: LibraryGroupId;
  label: string;
  shortLabel: string;
  description: string;
  adminOnly: boolean;
}

export interface LibraryGroupMeta {
  id: LibraryGroupId;
  label: string;
}

export const LIBRARY_GROUPS: LibraryGroupMeta[] = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'operations', label: 'Operations' },
  { id: 'admin', label: 'System & Admin' },
];

export const LIBRARY_SECTIONS: LibrarySectionMeta[] = [
  {
    id: 'products',
    groupId: 'catalog',
    label: 'Products & Categories',
    shortLabel: 'Products',
    description: 'Browse, categorize, price, and archive catalog items and category icons.',
    adminOnly: false,
  },
  {
    id: 'containers',
    groupId: 'catalog',
    label: 'Containers',
    shortLabel: 'Containers',
    description: 'Manage reusable container templates and active placed container instances.',
    adminOnly: false,
  },
  {
    id: 'freezers',
    groupId: 'catalog',
    label: 'Freezers',
    shortLabel: 'Freezers',
    description: 'Configure on-site freezers, layout organization, and storage capacities.',
    adminOnly: false,
  },
  {
    id: 'lists',
    groupId: 'catalog',
    label: 'Lists',
    shortLabel: 'Lists',
    description: 'Manage custom checklists, threshold rules, bulk matrix settings, and alerts.',
    adminOnly: false,
  },
  {
    id: 'tags',
    groupId: 'catalog',
    label: 'Tags',
    shortLabel: 'Tags',
    description: 'Configure item tags, restock rules, and automatic default product assignments.',
    adminOnly: false,
  },
  {
    id: 'locations',
    groupId: 'catalog',
    label: 'Locations',
    shortLabel: 'Locations',
    description: 'Manage your Home Base, off-site warehouses, processors, and delivery outlets.',
    adminOnly: false,
  },
  {
    id: 'photos',
    groupId: 'catalog',
    label: 'Photo Manager',
    shortLabel: 'Photos',
    description: 'Inspect catalog photos, find unattached files, and assign missing item images.',
    adminOnly: false,
  },
  {
    id: 'offsite_settings',
    groupId: 'operations',
    label: 'Off-Site Settings',
    shortLabel: 'Off-Site',
    description: 'Set default movement report shipper details and simulated box weights.',
    adminOnly: false,
  },
  {
    id: 'butcher_settings',
    groupId: 'operations',
    label: 'Butcher Settings',
    shortLabel: 'Butcher',
    description: 'Manage butcher species, order tags, yield baseline rules, and document link types.',
    adminOnly: false,
  },
  {
    id: 'voice_dictionary',
    groupId: 'operations',
    label: 'Voice Dictionary',
    shortLabel: 'Voice Dict',
    description: 'Configure default voice display freezer and phonetic recognition mappings.',
    adminOnly: false,
  },
  {
    id: 'import',
    groupId: 'admin',
    label: 'Import / Manage Data',
    shortLabel: 'Data & Backups',
    description: 'Create snapshots, inspect tables, restore archives, or reset database scopes.',
    adminOnly: true,
  },
  {
    id: 'users_devices',
    groupId: 'admin',
    label: 'Users & Devices',
    shortLabel: 'Users',
    description: 'Manage user PIN accounts, sign-in policies, and trusted PWA devices.',
    adminOnly: true,
  },
  {
    id: 'notifications',
    groupId: 'admin',
    label: 'Notifications',
    shortLabel: 'Notifications',
    description: 'Configure reusable delivery channels, daily digest schedules, system routing, and logs.',
    adminOnly: true,
  },
  {
    id: 'settings',
    groupId: 'admin',
    label: 'General Settings',
    shortLabel: 'General',
    description: 'Configure offline PWA branding, custom URLs, sandbox mode, and updates.',
    adminOnly: true,
  },
];

const KNOWN_SECTIONS = new Set<string>(LIBRARY_SECTIONS.map((s) => s.id));

export function normalizeLibraryTab(tab?: string | null): LibraryTab {
  if (!tab) return 'products';
  const cleaned = tab.trim();
  if (cleaned === 'pwa') return 'users_devices';
  if (cleaned === 'pallets') return 'pallets';
  if (KNOWN_SECTIONS.has(cleaned)) return cleaned as LibraryTab;
  return 'products';
}

export function isSectionAdminOnly(tab?: string | null): boolean {
  const normalized = normalizeLibraryTab(tab);
  const found = LIBRARY_SECTIONS.find((s) => s.id === normalized);
  return found ? found.adminOnly : false;
}

export function getLibrarySectionMeta(tab?: string | null): LibrarySectionMeta {
  const normalized = normalizeLibraryTab(tab);
  return (
    LIBRARY_SECTIONS.find((s) => s.id === normalized) ||
    LIBRARY_SECTIONS[0]
  );
}

export function getVisibleLibraryGroups(isAdminGated: boolean): Array<{
  group: LibraryGroupMeta;
  sections: LibrarySectionMeta[];
}> {
  return LIBRARY_GROUPS.map((group) => ({
    group,
    sections: LIBRARY_SECTIONS.filter(
      (section) => section.groupId === group.id && (!isAdminGated || !section.adminOnly),
    ),
  })).filter((entry) => entry.sections.length > 0);
}
