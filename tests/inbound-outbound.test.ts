import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryState } from '../types';
import { inboundMeatCut, outboundMeatCut } from '../utils/inventoryOperations';

describe('Workflow: Inbounding & Outbounding Products', () => {
  let initialState: InventoryState;

  beforeEach(() => {
    initialState = {
      freezers: [{ id: 'f1', name: 'Freezer #1' }],
      containers: [
        { id: 'c1', name: 'Poultry Bin', freezerId: 'f1', icon: 'Box', deleteOnEmpty: false },
        { id: 'c2', name: 'Beef Box', freezerId: 'f1', icon: 'Box', deleteOnEmpty: true },
      ],
      products: [
        { id: 'p-chicken', name: 'Whole Pastured Chicken', primaryCategory: 'Poultry', subCategory: 'Whole' },
        { id: 'p-ground-beef', name: 'Ground Beef 1lb', primaryCategory: 'Beef', subCategory: 'Ground' },
      ],
      meatCuts: [],
      history: [],
    };
  });

  describe('Inbounding Inventory', () => {
    it('creates a new meat cut with full traceability data (lot, weight, pack date)', () => {
      const { state: nextState, cutId } = inboundMeatCut(
        initialState,
        {
          productId: 'p-chicken',
          quantity: 12,
          containerId: 'c1',
          lot: 'LOT-2026-10',
          packDate: '2026-10-15',
          weight: 48.5,
          notes: 'Freshly harvested',
        },
        { user: 'Farmer John', clientDevice: 'Mobile App' }
      );

      const created = nextState.meatCuts.find(mc => mc.id === cutId);
      expect(created).toBeDefined();
      expect(created?.productId).toBe('p-chicken');
      expect(created?.quantity).toBe(12);
      expect(created?.lot).toBe('LOT-2026-10');
      expect(created?.weight).toBe(48.5);
      expect(created?.notes).toBe('Freshly harvested');

      // History audit
      const hist = nextState.history[0];
      expect(hist.description).toContain('Inbound: Created 12x "Whole Pastured Chicken"');
      expect(hist.user).toBe('Farmer John');
      expect(hist.clientDevice).toBe('Mobile App');
    });

    it('increments quantity when inbounding an identical product variant into the same container', () => {
      // First intake of 10 packages
      const { state: state1, cutId: id1 } = inboundMeatCut(initialState, {
        productId: 'p-ground-beef',
        quantity: 10,
        containerId: 'c2',
        notes: '80/20 Lean',
      });

      // Second intake of 15 packages of the identical product & variant
      const { state: state2, cutId: id2 } = inboundMeatCut(state1, {
        productId: 'p-ground-beef',
        quantity: 15,
        containerId: 'c2',
        notes: '80/20 Lean',
      });

      expect(id2).toBe(id1); // Reuses the same cut row
      expect(state2.meatCuts.length).toBe(1);
      expect(state2.meatCuts[0].quantity).toBe(25); // 10 + 15

      const latestHist = state2.history[0];
      expect(latestHist.description).toContain('Inbound: Added 15x "Ground Beef 1lb"');
      expect(latestHist.description).toContain('New total: 25');
    });

    it('rejects invalid non-existent products or non-positive quantities', () => {
      expect(() =>
        inboundMeatCut(initialState, {
          productId: 'non-existent-id',
          quantity: 5,
          containerId: 'c1',
        })
      ).toThrowError(/not found/i);

      expect(() =>
        inboundMeatCut(initialState, {
          productId: 'p-chicken',
          quantity: 0,
          containerId: 'c1',
        })
      ).toThrowError(/greater than zero/i);

      expect(() =>
        inboundMeatCut(initialState, {
          productId: 'p-chicken',
          quantity: -3,
          containerId: 'c1',
        })
      ).toThrowError(/greater than zero/i);
    });
  });

  describe('Outbounding Inventory (Depletions / Sales)', () => {
    beforeEach(() => {
      initialState.meatCuts = [
        {
          id: 'cut-chicken',
          productId: 'p-chicken',
          quantity: 20,
          containerId: 'c1',
        },
      ];
    });

    it('deducts partial quantity and logs audit trail', () => {
      const { state: nextState, remainingQuantity } = outboundMeatCut(
        initialState,
        'cut-chicken',
        6,
        { user: 'Cashier' }
      );

      expect(remainingQuantity).toBe(14);
      const updatedCut = nextState.meatCuts.find(mc => mc.id === 'cut-chicken');
      expect(updatedCut?.quantity).toBe(14);

      const hist = nextState.history[0];
      expect(hist.description).toContain('Outbound: Depleted 6x "Whole Pastured Chicken" (Remaining: 14)');
      expect(hist.user).toBe('Cashier');
    });

    it('completely removes meat cut when depleted to zero and archives container', () => {
      const { state: nextState, remainingQuantity } = outboundMeatCut(
        initialState,
        'cut-chicken',
        20,
        { user: 'Cashier' }
      );

      expect(remainingQuantity).toBe(0);
      const remainingCut = nextState.meatCuts.find(mc => mc.id === 'cut-chicken');
      expect(remainingCut).toBeUndefined();

      // Since c1 has deleteOnEmpty: false, it should become archived
      const container = nextState.containers.find(c => c.id === 'c1');
      expect(container?.isArchived).toBe(true);
      expect(container?.freezerId).toBeUndefined();
    });

    it('retires temporary container when its last product is outbounded', () => {
      // Add cut to c2 (which has deleteOnEmpty: true)
      initialState.meatCuts.push({
        id: 'cut-beef',
        productId: 'p-ground-beef',
        quantity: 5,
        containerId: 'c2',
      });

      const { state: nextState } = outboundMeatCut(initialState, 'cut-beef', 5);

      // c2 should be removed from containers entirely
      const containerC2 = nextState.containers.find(c => c.id === 'c2');
      expect(containerC2).toBeUndefined();
    });

    it('throws error and prevents negative inventory when attempting to outbound more than available', () => {
      expect(() =>
        outboundMeatCut(initialState, 'cut-chicken', 25) // Only 20 available!
      ).toThrowError(/available quantity is only 20/i);

      // Inventory remains unchanged
      expect(initialState.meatCuts[0].quantity).toBe(20);
    });

    it('throws error when outbounding with zero or negative quantity', () => {
      expect(() => outboundMeatCut(initialState, 'cut-chicken', 0)).toThrowError(
        /greater than zero/i
      );
      expect(() => outboundMeatCut(initialState, 'cut-chicken', -5)).toThrowError(
        /greater than zero/i
      );
    });
  });
});
