import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import HistoryView from '../views/HistoryView';
import { InventoryState } from '../types';

const createMinimalState = (): InventoryState => ({
  freezers: [{ id: 'fz-1', name: 'Garage Freezer' }],
  containers: [{ id: 'cont-1', name: 'Bin A', freezerId: 'fz-1', icon: 'box' }],
  products: [
    {
      id: 'prod-1',
      name: 'Ribeye Steak',
      primaryCategory: 'Beef',
      subCategory: 'Steaks'
    }
  ],
  meatCuts: [],
  history: [
    {
      id: 'h-1',
      timestamp: new Date().toISOString(),
      description: 'Added 2 Ribeye Steak to Bin A',
      targetId: 'cont-1',
      user: 'nick',
      clientDevice: 'Desktop Browser'
    }
  ],
  tags: [],
  customLists: [],
  locations: [],
  butcherOrders: [],
  offSiteEntries: [],
  movementOrders: [],
  containerTemplates: []
});

describe('Audit History Collapsible Filters', () => {
  it('renders search input and Filters button while hiding all filter controls by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(HistoryView, {
        state: createMinimalState(),
        dispatch: () => {}
      })
    );

    // Search input and Filters button are immediately visible
    expect(html).toContain('id="history-search-input"');
    expect(html).toContain('id="history-filters-toggle-btn"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Filters');

    // All non-search filters are hidden by default
    expect(html).not.toContain('id="history-filters-panel"');
    expect(html).not.toContain('Time Period: Last 24 Hours');
    expect(html).not.toContain('Quick Window:');
    expect(html).not.toContain('All Freezers');
    expect(html).not.toContain('All Containers');
    expect(html).not.toContain('All Products');
    expect(html).not.toContain('All Users');
    expect(html).not.toContain('All Devices / Apps');
  });

  it('wires the Filters button to toggle the full filter panel in HistoryView.tsx', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../views/HistoryView.tsx'), 'utf-8');

    expect(source).toContain('const [showFilters, setShowFilters] = useState(false);');
    expect(source).toContain('onClick={() => setShowFilters(prev => !prev)}');
    expect(source).toContain('{showFilters && (');
    expect(source).toContain('id="history-filters-panel"');

    // Ensure all filter sections live inside the collapsible panel
    const panelStart = source.indexOf('id="history-filters-panel"');
    expect(panelStart).toBeGreaterThan(-1);
    const panelSlice = source.slice(panelStart, source.indexOf('{/* Log Entry List */}'));
    expect(panelSlice).toContain('Time Period: Last 24 Hours');
    expect(panelSlice).toContain('Quick Window:');
    expect(panelSlice).toContain('label="Freezers"');
    expect(panelSlice).toContain('label="Containers"');
    expect(panelSlice).toContain('label="Products"');
    expect(panelSlice).toContain('label="Users"');
    expect(panelSlice).toContain('label="Devices / Apps"');
  });

  it('hides Purge / Maintenance for non-admins and renders it only when canPurgeHistory is true', () => {
    const defaultHtml = renderToStaticMarkup(
      React.createElement(HistoryView, {
        state: createMinimalState(),
        dispatch: () => {}
      })
    );
    expect(defaultHtml).not.toContain('id="history-purge-maintenance-btn"');
    expect(defaultHtml).not.toContain('Purge / Maintenance');

    const nonAdminHtml = renderToStaticMarkup(
      React.createElement(HistoryView, {
        state: createMinimalState(),
        dispatch: () => {},
        canPurgeHistory: false
      })
    );
    expect(nonAdminHtml).not.toContain('id="history-purge-maintenance-btn"');
    expect(nonAdminHtml).not.toContain('Purge / Maintenance');

    const adminHtml = renderToStaticMarkup(
      React.createElement(HistoryView, {
        state: createMinimalState(),
        dispatch: () => {},
        canPurgeHistory: true
      })
    );
    expect(adminHtml).toContain('id="history-purge-maintenance-btn"');
    expect(adminHtml).toContain('Purge / Maintenance');
  });

  it('wires canPurgeHistory={canAccessAdmin} in App.tsx and enforces admin auth for PURGE_HISTORY in server.ts', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
    expect(appSource).toContain('canPurgeHistory={canAccessAdmin}');

    const serverSource = fs.readFileSync(path.resolve(__dirname, '../server.ts'), 'utf-8');
    const actionIdx = serverSource.indexOf("app.post('/api/inventory/action'");
    expect(actionIdx).toBeGreaterThan(-1);
    const actionHead = serverSource.slice(actionIdx, actionIdx + 900);
    expect(actionHead).toContain("action.type === 'PURGE_HISTORY'");
    expect(actionHead).toContain('auth.usersConfigured && !auth.isAdmin');
    expect(actionHead).toContain('ADMIN_REQUIRED');
    expect(actionHead).toContain('AUTH_REQUIRED');
  });
});
