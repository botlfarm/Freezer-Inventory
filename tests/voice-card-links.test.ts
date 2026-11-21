import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { VoiceControlView } from '../views/VoiceControlView';
import { DisplayCaseView } from '../views/DisplayCaseView';
import { InventoryState } from '../types';

const createTestState = (): InventoryState => ({
  freezers: [
    { id: 'fz-display', name: 'Display Case', isSpecial: true },
    { id: 'fz-1', name: 'Canada Freezer' },
  ],
  containers: [
    { id: 'fz-display_loose', name: 'Display Case (Loose)', freezerId: 'fz-display', icon: 'generic' },
    { id: 'cont-orange', name: 'Orange Bin', freezerId: 'fz-1', icon: 'box' },
    { id: 'cont-empty', name: 'Empty Tote', freezerId: 'fz-1', icon: 'box' },
  ],
  products: [
    {
      id: 'prod-brats',
      name: 'Pork Brats',
      primaryCategory: 'Pork',
      subCategory: 'Sausage',
    },
    {
      id: 'prod-ribeye',
      name: 'Ribeye Steak',
      primaryCategory: 'Beef',
      subCategory: 'Steaks',
    },
  ],
  meatCuts: [
    {
      id: 'mc-1',
      productId: 'prod-brats',
      containerId: 'fz-display_loose',
      quantity: 5,
      tagIds: ['tag-vac'],
    },
    {
      id: 'mc-2',
      productId: 'prod-ribeye',
      containerId: 'cont-orange',
      quantity: 3,
      tagIds: ['tag-vac'],
    },
  ],
  history: [],
  tags: [{ id: 'tag-vac', name: 'Vacuum Sealed', color: '#14b8a6' }],
  customLists: [
    {
      id: 'list-restock',
      name: 'Restock List',
      description: '',
      allowNotes: false,
      isInventoryControlled: false,
      items: [{ productId: 'prod-brats', threshold: 4 }],
    },
  ],
  locations: [],
  butcherOrders: [],
  offSiteEntries: [],
  movementOrders: [],
  containerTemplates: [],
});

describe('Voice Control Cards Link Back to Main App', () => {
  it('wires all main-app navigation handlers from App.tsx into VoiceControlView and DisplayCaseView', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
    const voiceCaseIdx = appSource.indexOf("case 'voice':");
    expect(voiceCaseIdx).toBeGreaterThan(-1);
    const defaultCaseIdx = appSource.indexOf('default:', voiceCaseIdx);
    expect(defaultCaseIdx).toBeGreaterThan(voiceCaseIdx);
    const voiceSlice = appSource.slice(voiceCaseIdx, defaultCaseIdx);

    expect(voiceSlice).toContain('onNavigateToProduct=');
    expect(voiceSlice).toContain('onNavigateToFreezer=');
    expect(voiceSlice).toContain('onNavigateToFreezerUnit=');
    expect(voiceSlice).toContain('onNavigateToDisplayCase={(productId?: string)');
    expect(voiceSlice).toContain('onNavigateToProductsView=');
    expect(voiceSlice).toContain('onNavigateToCategory=');
    expect(voiceSlice).toContain('onNavigateToTag=');
    expect(voiceSlice).toContain('onNavigateToList=');
    expect(voiceSlice).toContain('onNavigateToHistory=');

    const displayCaseIdx = appSource.indexOf("case 'display_case':");
    expect(displayCaseIdx).toBeGreaterThan(-1);
    const productCaseIdx = appSource.indexOf("case 'product':", displayCaseIdx);
    const displaySlice = appSource.slice(displayCaseIdx, productCaseIdx);
    expect(displaySlice).toContain('selectedProductId={selectedProductId}');
    expect(displaySlice).toContain('onClearSelectedProduct={() => setSelectedProductId(null)}');
  });

  it('defaults item links to Product View, display item links to Display Case View, and container/freezer inquiries to Freezer View', () => {
    const voiceSource = fs.readFileSync(
      path.resolve(__dirname, '../views/VoiceControlView.tsx'),
      'utf-8'
    );

    // Smart item router sends display items to Display Case (with productId) and regular items to Product View
    expect(voiceSource).toContain('const navigateToItem = useCallback');
    expect(voiceSource).toContain('onNavigateToDisplayCase(productId);');
    expect(voiceSource).toContain('onNavigateToProduct(productId);');

    // Container queries link container headers to Freezers View and items via navigateToItem(..., res.isDisplay)
    expect(voiceSource).toContain('title="Open container in Freezers view"');
    expect(voiceSource).toContain('navigateToItem(item.product.id, res.isDisplay)');

    // Alert queries send display-scoped alert items to Display Case and global alerts to Product View
    expect(voiceSource).toContain("const isDisplayAlert = !clause.alertQueryMode?.startsWith('global');");
    expect(voiceSource).toContain('navigateToItem(item.product.id, isDisplayAlert)');

    // Tag queries & Stock check queries check display status per item/location
    expect(voiceSource).toContain('navigateToItem(item.product.id, itemIsDisplay)');
    expect(voiceSource).toContain('navigateToItem(res.product.id, allLocationsDisplay)');
    expect(voiceSource).toContain('loc.isDisplay && onNavigateToDisplayCase');

    // Proposed changes cards route items via clauseItemIsDisplay / navigateToItem and container ops to Freezer View
    expect(voiceSource).toContain('navigateToItem(selectedProduct.product.id, true)');
    expect(voiceSource).toContain('navigateToItem(selectedProduct.product.id, clauseItemIsDisplay)');
    expect(voiceSource).toContain('navigateToItem(item.product.id, chipIsDisplay)');
    expect(voiceSource).toContain('onNavigateToFreezer(selectedSourceLoc.containerId)');
    expect(voiceSource).toContain('onNavigateToFreezerUnit(selectedNewFreezer.freezerId)');

    // Applied summary separates container operations vs display items vs regular product items
    expect(voiceSource).toContain('if (item.isContainerOp)');
    expect(voiceSource).toContain('else if (item.isDisplay && item.productId && onNavigateToDisplayCase)');
    expect(voiceSource).toContain('else if (item.productId)');

    // Source container disambiguation hides redundant package stack list and shows per-container available qty
    expect(voiceSource).toContain('!clause.requiresSourceLocationSelection && clause.cutCandidates.length > 1');
    expect(voiceSource).toContain('!clause.requiresSourceLocationSelection &&\n                            clause.cutCandidates.length > 1');
    expect(voiceSource).toContain('const containerStockQty =');
  });

  it('renders VoiceControlView and DisplayCaseView with selectedProductId cleanly', () => {
    const testState = createTestState();
    const voiceHtml = renderToStaticMarkup(
      React.createElement(VoiceControlView, {
        state: testState,
        dispatch: vi.fn(),
        onNavigateToProduct: vi.fn(),
        onNavigateToFreezer: vi.fn(),
        onNavigateToFreezerUnit: vi.fn(),
        onNavigateToDisplayCase: vi.fn(),
        onNavigateToProductsView: vi.fn(),
        onNavigateToCategory: vi.fn(),
        onNavigateToTag: vi.fn(),
        onNavigateToList: vi.fn(),
        onNavigateToHistory: vi.fn(),
      })
    );
    expect(voiceHtml).toContain('On-Site Voice Control');

    const displayHtml = renderToStaticMarkup(
      React.createElement(DisplayCaseView, {
        state: testState,
        dispatch: vi.fn(),
        openModal: vi.fn(),
        searchTerm: '',
        onNavigateToContainer: vi.fn(),
        onNavigateToStaging: vi.fn(),
        selectedProductId: 'prod-brats',
        onClearSelectedProduct: vi.fn(),
        selectedPrimary: null,
        selectedSub: null,
        selectedFreezerId: 'all',
        hideZeroQuantity: true,
        activeCheckedTags: ['untagged', 'tag-vac'],
        setSelectedPrimary: vi.fn(),
        setSelectedSub: vi.fn(),
      })
    );
    expect(displayHtml).toContain('prod-card-prod-brats');
  });
});
