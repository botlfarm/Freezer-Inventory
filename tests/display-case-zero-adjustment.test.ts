import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { DisplayCaseView, buildDisplayQuantityAdjustmentAction } from '../views/DisplayCaseView';
import { InventoryState } from '../types';

function createBaseState(): InventoryState {
  return {
    freezers: [
      { id: 'f-display-1', name: 'Front Display Case', isSpecial: true },
      { id: 'f-display-2', name: 'Side Display Case', isSpecial: true },
      { id: 'f-storage', name: 'Walk-In Backstock', isSpecial: false },
    ],
    containers: [
      { id: 'f-display-1_loose', name: 'Loose', freezerId: 'f-display-1', icon: 'loose' },
      { id: 'f-display-2_loose', name: 'Loose', freezerId: 'f-display-2', icon: 'loose' },
      { id: 'c-storage-1', name: 'Beef Crate', freezerId: 'f-storage', icon: 'box' },
    ],
    products: [
      { id: 'p-ribeye', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks' },
      { id: 'p-brisket', name: 'Whole Brisket', primaryCategory: 'Beef', subCategory: 'Roasts' },
      { id: 'p-tagged', name: 'Promo Sirloin', primaryCategory: 'Beef', subCategory: 'Steaks' },
    ],
    categories: [],
    tags: [
      { id: 'tag-promo', name: 'Promo', color: '#f59e0b' },
    ],
    meatCuts: [
      // Ribeye has backstock only (0 in display)
      { id: 'cut-backstock-ribeye', productId: 'p-ribeye', quantity: 6, containerId: 'c-storage-1' },
      // Brisket has 0 everywhere (0 display, 0 backstock)
      // Promo Sirloin has stock in Display 1 with tag-promo (0 in Display 2)
      { id: 'cut-display-tagged', productId: 'p-tagged', quantity: 4, containerId: 'f-display-1_loose', tagIds: ['tag-promo'] },
    ],
    history: [],
  };
}

describe('Display Case View — Zero-Inventory Manual Quantity Adjustment', () => {
  describe('buildDisplayQuantityAdjustmentAction', () => {
    it('dispatches ADD_MEAT_CUT (not invalid ADD_MEAT) when incrementing a virtual zero-inventory row', () => {
      const action = buildDisplayQuantityAdjustmentAction(
        { id: 'virtual_zero_p-ribeye_f-display-1', productId: 'p-ribeye' },
        'f-display-1_loose',
        1
      );

      expect(action).toEqual({
        type: 'ADD_MEAT_CUT',
        payload: {
          productId: 'p-ribeye',
          containerId: 'f-display-1_loose',
          quantity: 1,
        },
      });
    });

    it('dispatches ADD_MEAT_CUT when typing a direct quantity on a virtual zero-inventory row', () => {
      const action = buildDisplayQuantityAdjustmentAction(
        { id: 'virtual_zero_p-brisket_f-display-1', productId: 'p-brisket' },
        'f-display-1_loose',
        5
      );

      expect(action).toEqual({
        type: 'ADD_MEAT_CUT',
        payload: {
          productId: 'p-brisket',
          containerId: 'f-display-1_loose',
          quantity: 5,
        },
      });
    });

    it('returns null (no-op) when virtual zero-inventory row stays at 0 or negative', () => {
      expect(
        buildDisplayQuantityAdjustmentAction(
          { id: 'virtual_zero_p-ribeye_f-display-1', productId: 'p-ribeye' },
          'f-display-1_loose',
          0
        )
      ).toBeNull();

      expect(
        buildDisplayQuantityAdjustmentAction(
          { id: 'virtual_zero_p-ribeye_f-display-1', productId: 'p-ribeye' },
          'f-display-1_loose',
          -3
        )
      ).toBeNull();
    });

    it('dispatches UPDATE_MEAT_QUANTITY for real existing display cuts', () => {
      const action = buildDisplayQuantityAdjustmentAction(
        { id: 'cut-real-123', productId: 'p-ribeye' },
        'f-display-1_loose',
        7
      );

      expect(action).toEqual({
        type: 'UPDATE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'cut-real-123',
          newQuantity: 7,
        },
      });

      const zeroAction = buildDisplayQuantityAdjustmentAction(
        { id: 'cut-real-123', productId: 'p-ribeye' },
        'f-display-1_loose',
        -2
      );
      expect(zeroAction).toEqual({
        type: 'UPDATE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'cut-real-123',
          newQuantity: 0,
        },
      });
    });
  });

  describe('DisplayCaseView zero-inventory row rendering', () => {
    it('renders adjustable 0-quantity controls for zero-display items with backstock', () => {
      const state = createBaseState();
      const html = renderToStaticMarkup(
        React.createElement(DisplayCaseView, {
          state,
          dispatch: vi.fn(),
          openModal: vi.fn(),
          searchTerm: '',
          onNavigateToContainer: vi.fn(),
          onNavigateToStaging: vi.fn(),
          selectedPrimary: null,
          selectedSub: null,
          selectedFreezerId: 'f-display-1',
          hideZeroQuantity: true,
          showZeroQtyWithStock: true,
          activeCheckedTags: ['untagged', 'tag-promo'],
          setSelectedPrimary: vi.fn(),
          setSelectedSub: vi.fn(),
        })
      );

      expect(html).toContain('prod-card-p-ribeye');
      expect(html).toContain('data-action="increment"');
      expect(html).toContain('value="0"');
      // Brisket has 0 everywhere and hideZeroQuantity=true -> hidden
      expect(html).not.toContain('prod-card-p-brisket');
    });

    const getProductCardHtml = (html: string, productId: string): string => {
      const marker = `id="prod-card-${productId}"`;
      const start = html.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      const nextCard = html.indexOf('id="prod-card-', start + marker.length);
      return nextCard > -1 ? html.slice(start, nextCard) : html.slice(start);
    };

    it('renders adjustable 0-quantity controls for completely zero-stock items when hideZeroQuantity is false', () => {
      const state = createBaseState();
      const html = renderToStaticMarkup(
        React.createElement(DisplayCaseView, {
          state,
          dispatch: vi.fn(),
          openModal: vi.fn(),
          searchTerm: '',
          onNavigateToContainer: vi.fn(),
          onNavigateToStaging: vi.fn(),
          selectedPrimary: null,
          selectedSub: null,
          selectedFreezerId: 'f-display-1',
          hideZeroQuantity: false,
          showZeroQtyWithStock: true,
          activeCheckedTags: ['untagged', 'tag-promo'],
          setSelectedPrimary: vi.fn(),
          setSelectedSub: vi.fn(),
        })
      );

      // Brisket card should render an adjustable input row rather than the unadjustable empty placeholder
      const brisketChunk = getProductCardHtml(html, 'p-brisket');
      expect(brisketChunk).toContain('data-action="increment"');
      expect(brisketChunk).toContain('value="0"');
      expect(brisketChunk).not.toContain('not present in any Display Case container yet');
    });

    it('renders a virtual 0-quantity row for a specific display freezer even when stock exists in another display freezer', () => {
      const state = createBaseState();
      const html = renderToStaticMarkup(
        React.createElement(DisplayCaseView, {
          state,
          dispatch: vi.fn(),
          openModal: vi.fn(),
          searchTerm: '',
          onNavigateToContainer: vi.fn(),
          onNavigateToStaging: vi.fn(),
          selectedPrimary: null,
          selectedSub: null,
          selectedFreezerId: 'f-display-2',
          hideZeroQuantity: false,
          showZeroQtyWithStock: true,
          activeCheckedTags: ['untagged', 'tag-promo'],
          setSelectedPrimary: vi.fn(),
          setSelectedSub: vi.fn(),
        })
      );

      // Promo Sirloin has 4 in f-display-1, 0 in f-display-2 -> f-display-2 should show adjustable 0 row
      const taggedChunk = getProductCardHtml(html, 'p-tagged');
      expect(taggedChunk).toContain('Side Display Case');
      expect(taggedChunk).toContain('data-action="increment"');
      expect(taggedChunk).toContain('value="0"');
    });

    it('does not synthesize a misleading 0 row when display stock exists but is hidden strictly by tag filters', () => {
      const state = createBaseState();
      const html = renderToStaticMarkup(
        React.createElement(DisplayCaseView, {
          state,
          dispatch: vi.fn(),
          openModal: vi.fn(),
          searchTerm: '',
          onNavigateToContainer: vi.fn(),
          onNavigateToStaging: vi.fn(),
          selectedPrimary: null,
          selectedSub: null,
          selectedFreezerId: 'f-display-1',
          hideZeroQuantity: false,
          showZeroQtyWithStock: true,
          // Only untagged checked -> tag-promo cut in f-display-1 is filtered out by tag
          activeCheckedTags: ['untagged'],
          setSelectedPrimary: vi.fn(),
          setSelectedSub: vi.fn(),
        })
      );

      const taggedChunk = getProductCardHtml(html, 'p-tagged');
      expect(taggedChunk).not.toContain('data-action="increment"');
    });
  });

  describe('Source & Server Integration Guardrails', () => {
    it('never dispatches invalid action type ADD_MEAT in DisplayCaseView.tsx', () => {
      const source = fs.readFileSync(path.resolve(__dirname, '../views/DisplayCaseView.tsx'), 'utf8');
      expect(source).not.toMatch(/dispatch\(\s*\{\s*type:\s*['"]ADD_MEAT['"]/);
      expect(source).toContain("type: 'ADD_MEAT_CUT'");
    });

    it('supports client-provided id, positive quantity validation, and *_loose auto-provisioning in server.ts and useInventory.ts', () => {
      const serverSource = fs.readFileSync(path.resolve(__dirname, '../server.ts'), 'utf8');
      const addMeatCutIdx = serverSource.indexOf("case 'ADD_MEAT_CUT': {");
      const nextCaseIdx = serverSource.indexOf("case 'BATCH_UPDATE_MEAT_QUANTITY': {", addMeatCutIdx);
      expect(addMeatCutIdx).toBeGreaterThan(-1);
      expect(nextCaseIdx).toBeGreaterThan(addMeatCutIdx);
      const addMeatCutBlock = serverSource.slice(addMeatCutIdx, nextCaseIdx);
      expect(addMeatCutBlock).toContain('Quantity must be greater than zero.');
      expect(addMeatCutBlock).toContain("containerId.endsWith('_loose')");
      expect(addMeatCutBlock).toContain('requestedId');

      const hookSource = fs.readFileSync(path.resolve(__dirname, '../hooks/useInventory.ts'), 'utf8');
      const hookAddIdx = hookSource.indexOf("if (action.type === 'ADD_MEAT_CUT')");
      const hookNextIdx = hookSource.indexOf("if (action.type === 'UPDATE_MEAT_QUANTITY')", hookAddIdx);
      expect(hookAddIdx).toBeGreaterThan(-1);
      expect(hookNextIdx).toBeGreaterThan(hookAddIdx);
      const hookAddBlock = hookSource.slice(hookAddIdx, hookNextIdx);
      expect(hookAddBlock).toContain('generateUUID()');
      expect(hookAddBlock).toContain("containerId.endsWith('_loose')");
      expect(hookAddBlock).toContain('sendActionToServer(actionWithId)');
    });
  });
});
