import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LIBRARY_GROUPS,
  LIBRARY_SECTIONS,
  normalizeLibraryTab,
  isSectionAdminOnly,
  getLibrarySectionMeta,
  getVisibleLibraryGroups,
} from '../utils/libraryNavigation';
import {
  OFFSITE_USER_CONFIG_KEYS,
  extractAppConfigRequestKeys,
  canNonAdminWriteAppConfig,
} from '../utils/appConfigPermissions';
import { createTestDatabase } from './test-harness';

describe('Catalog & Settings Navigation Structure', () => {
  it('defines the three logical navigation groups in order with all 14 sections', () => {
    expect(LIBRARY_GROUPS.map((g) => g.id)).toEqual(['catalog', 'operations', 'admin']);
    expect(LIBRARY_GROUPS.map((g) => g.label)).toEqual([
      'Catalog',
      'Operations',
      'System & Admin',
    ]);
    expect(LIBRARY_SECTIONS).toHaveLength(14);
  });

  it('normalizes legacy and alias hash routes accurately', () => {
    expect(normalizeLibraryTab('pwa')).toBe('users_devices');
    expect(normalizeLibraryTab('users_devices')).toBe('users_devices');
    expect(normalizeLibraryTab('offsite_settings')).toBe('offsite_settings');
    expect(normalizeLibraryTab('pallets')).toBe('pallets');
    expect(normalizeLibraryTab('lists')).toBe('lists');
    expect(normalizeLibraryTab('  tags  ')).toBe('tags');
    expect(normalizeLibraryTab('')).toBe('products');
    expect(normalizeLibraryTab(null)).toBe('products');
    expect(normalizeLibraryTab('nonexistent_tab')).toBe('products');
  });

  it('keeps Off-Site Settings and Catalog sections available to regular users while gating System & Admin', () => {
    // Non-admin / regular user sections
    expect(isSectionAdminOnly('products')).toBe(false);
    expect(isSectionAdminOnly('containers')).toBe(false);
    expect(isSectionAdminOnly('freezers')).toBe(false);
    expect(isSectionAdminOnly('lists')).toBe(false);
    expect(isSectionAdminOnly('tags')).toBe(false);
    expect(isSectionAdminOnly('locations')).toBe(false);
    expect(isSectionAdminOnly('photos')).toBe(false);
    expect(isSectionAdminOnly('offsite_settings')).toBe(false);
    expect(isSectionAdminOnly('butcher_settings')).toBe(false);
    expect(isSectionAdminOnly('voice_dictionary')).toBe(false);

    // Admin-only sections (including legacy pwa alias and Notifications)
    expect(isSectionAdminOnly('import')).toBe(true);
    expect(isSectionAdminOnly('users_devices')).toBe(true);
    expect(isSectionAdminOnly('pwa')).toBe(true);
    expect(isSectionAdminOnly('notifications')).toBe(true);
    expect(isSectionAdminOnly('settings')).toBe(true);
  });

  it('filters visible groups for gated non-admin users vs admins', () => {
    const gatedGroups = getVisibleLibraryGroups(true);
    expect(gatedGroups.map((g) => g.group.id)).toEqual(['catalog', 'operations']);
    expect(gatedGroups.find((g) => g.group.id === 'catalog')?.sections).toHaveLength(7);
    expect(
      gatedGroups.find((g) => g.group.id === 'operations')?.sections.map((s) => s.id),
    ).toEqual(['offsite_settings', 'butcher_settings', 'voice_dictionary']);

    const adminGroups = getVisibleLibraryGroups(false);
    expect(adminGroups.map((g) => g.group.id)).toEqual(['catalog', 'operations', 'admin']);
    expect(adminGroups.find((g) => g.group.id === 'admin')?.sections.map((s) => s.id)).toEqual([
      'import',
      'users_devices',
      'notifications',
      'settings',
    ]);
  });

  it('returns section metadata with fallback to products', () => {
    expect(getLibrarySectionMeta('offsite_settings').label).toBe('Off-Site Settings');
    expect(getLibrarySectionMeta('butcher_settings').label).toBe('Butcher Settings');
    expect(getLibrarySectionMeta('pwa').id).toBe('users_devices');
    expect(getLibrarySectionMeta('unknown').id).toBe('products');
  });
});

describe('Off-Site Settings App Config Permissions', () => {
  it('allows regular users to update only the three off-site config keys', () => {
    expect(Array.from(OFFSITE_USER_CONFIG_KEYS).sort()).toEqual([
      'offsite-theoretical-box-weight',
      'report-from-address',
      'report-from-name',
    ]);

    expect(
      canNonAdminWriteAppConfig({
        key: 'report-from-name',
        value: 'Maple Ridge Farm',
      }),
    ).toBe(true);

    expect(
      canNonAdminWriteAppConfig({
        key: 'report-from-address',
        value: '123 Pasture Ln',
      }),
    ).toBe(true);

    expect(
      canNonAdminWriteAppConfig({
        key: 'offsite-theoretical-box-weight',
        value: '42.5',
      }),
    ).toBe(true);

    expect(
      canNonAdminWriteAppConfig({
        configs: {
          'report-from-name': 'Maple Ridge Farm',
          'report-from-address': '123 Pasture Ln',
          'offsite-theoretical-box-weight': '40',
        },
      }),
    ).toBe(true);
  });

  it('blocks non-admin writes when any admin-only or empty key is present', () => {
    expect(canNonAdminWriteAppConfig({})).toBe(false);
    expect(canNonAdminWriteAppConfig(null)).toBe(false);
    expect(canNonAdminWriteAppConfig({ key: '   ' })).toBe(false);
    expect(canNonAdminWriteAppConfig({ key: 'pwa_app_name', value: 'Custom' })).toBe(false);
    expect(canNonAdminWriteAppConfig({ key: 'cf_token_refresh_enabled', value: 'true' })).toBe(false);
    expect(canNonAdminWriteAppConfig({ key: 'require_login_for_edits', value: 'false' })).toBe(false);
    expect(
      canNonAdminWriteAppConfig({
        configs: {
          'report-from-name': 'Farm A',
          pwa_app_name: 'Hijacked Name',
        },
      }),
    ).toBe(false);
  });

  it('deduplicates keys across key and configs payload properties', () => {
    expect(
      extractAppConfigRequestKeys({
        key: 'report-from-name',
        configs: {
          'report-from-name': 'Farm A',
          ' offsite-theoretical-box-weight ': '45',
        },
      }).sort(),
    ).toEqual(['offsite-theoretical-box-weight', 'report-from-name']);
  });
});

describe('Off-Site Settings SQLite Persistence Roundtrip', () => {
  it('persists and retrieves shipper name, shipper address, and theoretical box weight in app_config', () => {
    const db = createTestDatabase(':memory:');
    try {
      const upsert = db.prepare(`
        INSERT INTO app_config (key, value, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
      `);
      const now = new Date().toISOString();
      upsert.run('report-from-name', 'Prairie Harvest Ranch', now);
      upsert.run('report-from-address', '500 Meadow Rd, Austin, TX 78701', now);
      upsert.run('offsite-theoretical-box-weight', '42', now);

      const rows = db
        .prepare('SELECT key, value FROM app_config WHERE key IN (?, ?, ?)')
        .all('report-from-name', 'report-from-address', 'offsite-theoretical-box-weight') as Array<{
        key: string;
        value: string;
      }>;

      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      expect(map['report-from-name']).toBe('Prairie Harvest Ranch');
      expect(map['report-from-address']).toBe('500 Meadow Rd, Austin, TX 78701');
      expect(map['offsite-theoretical-box-weight']).toBe('42');
    } finally {
      db.close();
    }
  });
});

describe('Unified Settings & Catalog UI Architecture Checks', () => {
  it('implements grouped desktop sidebar, mobile drawer, and two-step Lists/Tags flows in LibraryView', () => {
    const librarySrc = fs.readFileSync(path.resolve(__dirname, '../views/LibraryView.tsx'), 'utf-8');
    const serverSrc = fs.readFileSync(path.resolve(__dirname, '../server.ts'), 'utf-8');
    const spreadsheetSrc = fs.readFileSync(
      path.resolve(__dirname, '../views/OffSiteSpreadsheet.tsx'),
      'utf-8',
    );

    // Unified navigation shell imports & grouped layout
    expect(librarySrc).toContain('getVisibleLibraryGroups');
    expect(librarySrc).toContain('mobileNavOpen');
    expect(librarySrc).toContain('OffSiteSettingsPanel');
    expect(librarySrc).toContain('ButcherSettingsPanel');
    expect(librarySrc).toContain('hideInternalHeader');

    // Off-site & butcher settings live in dedicated Operations tabs
    expect(librarySrc).toContain('case "offsite_settings":');
    expect(librarySrc).toContain('case "butcher_settings":');

    // Regression guard: ensure no stale duplicate case "lists" bypasses shell header wiring
    const listCaseMatches = librarySrc.match(/case "lists":/g) || [];
    expect(listCaseMatches).toHaveLength(1);
    expect(librarySrc).toContain('mode={listsViewMode}');
    expect(librarySrc).toContain('createRequestCount={listCreateTrigger}');

    // Products archive filter lives in the top unified header segmented bar
    expect(librarySrc).toContain('Active Catalog ({activeProductsCount})');
    expect(librarySrc).toContain('Show All ({(state.products || []).length})');

    // Lists, Tags, and Locations use single-column card stacks
    expect(librarySrc).not.toContain('grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4');
    expect(librarySrc).not.toContain('grid-cols-1 xl:grid-cols-3 gap-6');
    expect(librarySrc).toContain('grid-cols-1 gap-3');

    // Server uses canNonAdminWriteAppConfig on POST /api/app-config
    expect(serverSrc).toContain('canNonAdminWriteAppConfig(req.body)');

    // OffSiteSpreadsheet reads theoretical box weight from shared appConfig with localStorage fallback
    expect(spreadsheetSrc).toContain("c.key === 'offsite-theoretical-box-weight'");

    // Confirm internal sub-view headers can be suppressed cleanly
    for (const file of [
      '../views/PhotoManagerView.tsx',
      '../views/DataImportView.tsx',
      '../components/UsersAndDevicesPanel.tsx',
    ]) {
      const content = fs.readFileSync(path.resolve(__dirname, file), 'utf-8');
      expect(content).toContain('hideInternalHeader');
    }
  });

  it('uses shared CatalogSearchFilterBar with condensed-by-default filters across all 7 catalog pages and tightened Locations padding', () => {
    const filterBarSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/CatalogSearchFilterBar.tsx'),
      'utf-8',
    );
    const librarySrc = fs.readFileSync(path.resolve(__dirname, '../views/LibraryView.tsx'), 'utf-8');
    const managementFormsSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/ManagementForms.tsx'),
      'utf-8',
    );
    const photoManagerSrc = fs.readFileSync(
      path.resolve(__dirname, '../views/PhotoManagerView.tsx'),
      'utf-8',
    );

    // Filter drawer content renders only when expanded
    expect(filterBarSrc).toContain('{isFiltersOpen && children && (');
    expect(filterBarSrc).toContain('aria-expanded={isFiltersOpen}');

    // Legacy top-header search bar removed from LibraryView header
    expect(librarySrc).not.toContain('normalizedActiveTab === "products" || normalizedActiveTab === "containers"');

    // All catalog sections inside LibraryView render CatalogSearchFilterBar with condensed (false) defaults
    for (const stateHook of [
      'const [showProductFilters, setShowProductFilters] = useState(false);',
      'const [showTemplateFilters, setShowTemplateFilters] = useState(false);',
      'const [showContainerFilters, setShowContainerFilters] = useState(false);',
      'const [showOverviewFilters, setShowOverviewFilters] = useState(false);',
      'const [showMatrixFilters, setShowMatrixFilters] = useState(false);',
      'const [showTagFilters, setShowTagFilters] = useState(false);',
      'const [showLocationFilters, setShowLocationFilters] = useState(false);',
    ]) {
      expect(librarySrc).toContain(stateHook);
    }

    const barMatches = librarySrc.match(/<CatalogSearchFilterBar/g) || [];
    expect(barMatches.length).toBeGreaterThanOrEqual(7);

    // Freezers (ManageFreezers in ManagementForms)
    expect(managementFormsSrc).toContain('const [showFreezerFilters, setShowFreezerFilters] = useState(false);');
    expect(managementFormsSrc).toContain('<CatalogSearchFilterBar');

    // Photo Manager (Library & Missing sub-tabs)
    expect(photoManagerSrc).toContain('const [showLibraryFilters, setShowLibraryFilters] = useState(false);');
    expect(photoManagerSrc).toContain('const [showMissingFilters, setShowMissingFilters] = useState(false);');
    expect((photoManagerSrc.match(/<CatalogSearchFilterBar/g) || []).length).toBeGreaterThanOrEqual(2);

    // Notifications center moved from Lists into System & Admin -> Notifications
    expect(librarySrc).toContain('case "notifications":');
    expect(librarySrc).toContain('<NotificationCenterPanel');
    expect(librarySrc).not.toContain('export const NotificationCenterComponent');
    const listsStart = librarySrc.indexOf('export const ManageLists');
    const listsEnd = librarySrc.indexOf('export const ManageLocations', listsStart);
    const listsSlice = librarySrc.slice(listsStart, listsEnd);
    expect(listsSlice).not.toContain('useState<"overview" | "matrix" | "notifications">');

    // Locations view uses compact horizontal row-cards, modal editor, and valid cool-gray surfaces
    const locationsStart = librarySrc.indexOf('export const ManageLocations');
    const locationsEnd = librarySrc.indexOf('export default LibraryView;', locationsStart);
    const locationsSlice = librarySrc.slice(locationsStart, locationsEnd);
    expect(locationsSlice).toContain('<div className="space-y-3.5">');
    expect(locationsSlice).toContain('flex flex-col sm:flex-row sm:items-center justify-between gap-3');
    expect(locationsSlice).toContain('grid-cols-1 md:grid-cols-2 gap-2.5');
    expect(locationsSlice).not.toContain('bg-cool-gray-855');
    expect(locationsSlice).not.toContain('grid-cols-3 gap-2 text-center');
    expect(locationsSlice).not.toContain('p-5 rounded-2xl');
    expect(locationsSlice).not.toContain('p-12 rounded-2xl');
  });
});

