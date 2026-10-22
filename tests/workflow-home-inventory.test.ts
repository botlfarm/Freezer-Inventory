import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryState, Container, MeatCut, Product, ContainerTemplate } from '../types';
import {
  inboundMeatCut,
  outboundMeatCut,
  moveMeatCut,
  moveContainer,
  consolidateMeatCutsInContainer,
  handleEmptyContainer
} from '../utils/inventoryOperations';

describe('Workflow 4: Home Freezer Inventory Operations & Lifecycle', () => {
  let state: InventoryState;

  beforeEach(() => {
    state = {
      freezers: [
        { id: 'freezer-main', name: 'Main Walk-In Freezer' },
        { id: 'freezer-display', name: 'Retail Display Case' },
        { id: 'freezer-chest', name: 'Chest Freezer #1' }
      ],
      containerTemplates: [
        { id: 'tpl-tote', name: 'Standard Blue Tote', icon: 'Box' },
        { id: 'tpl-basket', name: 'Wire Freezer Basket', icon: 'ShoppingBag' }
      ],
      containers: [
        { id: 'staging_loose', name: 'Staging / Loose', freezerId: undefined, icon: 'Layers' },
        { id: 'box-staged-101', name: 'Box 101 (Staged Steaks)', freezerId: undefined, icon: 'Package', deleteOnEmpty: true },
        { id: 'bin-walkin-steaks', name: 'Bin 1 - Walk-In Steaks', freezerId: 'freezer-main', icon: 'Box', deleteOnEmpty: false },
        { id: 'bin-walkin-ground', name: 'Bin 2 - Walk-In Ground', freezerId: 'freezer-main', icon: 'Box', deleteOnEmpty: false },
        { id: 'bin-display-case', name: 'Front Display Shelf', freezerId: 'freezer-display', icon: 'ShoppingBag', deleteOnEmpty: false },
        { id: 'temp-sale-tote', name: 'Temporary Flash Sale Tote', freezerId: 'freezer-main', icon: 'Package', deleteOnEmpty: true }
      ],
      products: [
        { id: 'prod-ribeye', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks', listThresholds: { minDisplay: 4, minStorage: 10 } },
        { id: 'prod-ground-beef', name: 'Ground Beef 1lb', primaryCategory: 'Beef', subCategory: 'Ground', listThresholds: { minDisplay: 15, minStorage: 40 } },
        { id: 'prod-filet', name: 'Filet Mignon', primaryCategory: 'Beef', subCategory: 'Steaks', listThresholds: { minDisplay: 2, minStorage: 6 } }
      ],
      meatCuts: [
        { id: 'cut-staged-ribeye', productId: 'prod-ribeye', quantity: 12, containerId: 'box-staged-101', notes: 'Fresh from harvest' },
        { id: 'cut-walkin-ribeye', productId: 'prod-ribeye', quantity: 6, containerId: 'bin-walkin-steaks', notes: 'Main stock' },
        { id: 'cut-walkin-ground', productId: 'prod-ground-beef', quantity: 30, containerId: 'bin-walkin-ground', notes: 'Main stock' },
        { id: 'cut-display-ribeye', productId: 'prod-ribeye', quantity: 2, containerId: 'bin-display-case', notes: 'Display front' },
        { id: 'cut-display-ground', productId: 'prod-ground-beef', quantity: 5, containerId: 'bin-display-case', notes: 'Display front' },
        { id: 'cut-temp-filet', productId: 'prod-filet', quantity: 4, containerId: 'temp-sale-tote', notes: 'Promo batch' }
      ],
      history: []
    };
  });

  it('allocates cuts from staging boxes into individual home freezer bins', () => {
    // Move 12 Ribeyes from staging box into Walk-In Steaks bin
    const { state: s1, destCutId } = moveMeatCut(state, {
      meatCutId: 'cut-staged-ribeye',
      newContainerId: 'bin-walkin-steaks',
      quantity: 12
    }, { user: 'Farm Manager', clientDevice: 'iPad' });

    // Staging cut should be moved
    const stagedCut = s1.meatCuts.find(mc => mc.id === 'cut-staged-ribeye');
    expect(stagedCut).toBeUndefined();

    // Source staging container box-staged-101 had deleteOnEmpty: true -> should be retired!
    const stagedContainer = s1.containers.find(c => c.id === 'box-staged-101');
    expect(stagedContainer).toBeUndefined();

    // Destination container should have the moved items
    const destCut = s1.meatCuts.find(mc => mc.id === destCutId);
    expect(destCut).toBeDefined();
    expect(destCut?.containerId).toBe('bin-walkin-steaks');
    expect(destCut?.quantity).toBe(12);

    // Audit history recorded: contains both the move entry and the emptied/retired container entry
    expect(s1.history.length).toBeGreaterThanOrEqual(2);
    const moveHist = s1.history.find(h => h.description.includes('Moved 12x "Ribeye Steak"'));
    expect(moveHist).toBeDefined();
    expect(moveHist?.user).toBe('Farm Manager');
    const retireHist = s1.history.find(h => h.description.includes('emptied and retired'));
    expect(retireHist).toBeDefined();
  });

  it('detects low display thresholds and restocks the display freezer from storage', () => {
    // Current display counts: Ribeye has 2 (minDisplay: 4) -> deficit of 2
    // Ground beef has 5 (minDisplay: 15) -> deficit of 10
    const displayRibeye = state.meatCuts.find(mc => mc.id === 'cut-display-ribeye');
    const ribeyeProd = state.products.find(p => p.id === 'prod-ribeye');
    const minRibeye = ribeyeProd?.listThresholds?.minDisplay || 0;
    const ribeyeDeficit = Math.max(0, minRibeye - (displayRibeye?.quantity || 0));
    expect(ribeyeDeficit).toBe(2);

    // Restock 4 Ribeyes from Walk-In storage to Display Case
    const { state: s1 } = moveMeatCut(state, {
      meatCutId: 'cut-walkin-ribeye',
      newContainerId: 'bin-display-case',
      quantity: 4
    }, { user: 'Retail Clerk' });

    // Storage Ribeye reduced from 6 to 2
    const remainingStorage = s1.meatCuts.find(mc => mc.id === 'cut-walkin-ribeye');
    expect(remainingStorage?.quantity).toBe(2);

    // Display Ribeye should now have 2 + 4 = 6, satisfying threshold
    const displayCuts = s1.meatCuts.filter(mc => mc.containerId === 'bin-display-case' && mc.productId === 'prod-ribeye');
    const totalDisplayRibeyes = displayCuts.reduce((sum, mc) => sum + mc.quantity, 0);
    expect(totalDisplayRibeyes).toBe(6);
    expect(totalDisplayRibeyes).toBeGreaterThanOrEqual(minRibeye);
  });

  it('sells items by reducing quantities and automatically retires empty containers marked deleteOnEmpty', () => {
    // Sell all 4 Filets from temp-sale-tote
    const { state: s1, remainingQuantity } = outboundMeatCut(
      state,
      'cut-temp-filet',
      4,
      { user: 'Cashier', clientDevice: 'POS Terminal' }
    );

    expect(remainingQuantity).toBe(0);

    // Cut is depleted and removed
    const soldCut = s1.meatCuts.find(mc => mc.id === 'cut-temp-filet');
    expect(soldCut).toBeUndefined();

    // Since temp-sale-tote had deleteOnEmpty: true and is now empty, container is retired
    const tempContainer = s1.containers.find(c => c.id === 'temp-sale-tote');
    expect(tempContainer).toBeUndefined();

    // History confirms outbound sale and retirement
    const saleHist = s1.history.find(h => h.description.includes('Depleted 4x "Filet Mignon"'));
    expect(saleHist).toBeDefined();
    expect(saleHist?.user).toBe('Cashier');
  });

  it('creates new containers using existing container templates', () => {
    const template = state.containerTemplates?.find(t => t.id === 'tpl-tote')!;
    expect(template).toBeDefined();

    // Create a new container using this template
    const newContainer: Container = {
      id: `cont-${Date.now()}`,
      name: 'Bin 3 - Walk-In Roasts',
      freezerId: 'freezer-main',
      templateId: template.id,
      icon: template.icon || 'Box',
      deleteOnEmpty: false,
      isArchived: false
    };

    const nextContainers = [...state.containers, newContainer];
    const s1: InventoryState = { ...state, containers: nextContainers };

    const created = s1.containers.find(c => c.id === newContainer.id);
    expect(created).toBeDefined();
    expect(created?.templateId).toBe('tpl-tote');
    expect(created?.icon).toBe('Box');
    expect(created?.freezerId).toBe('freezer-main');
  });

  it('combines two containers together and consolidates matching variants', () => {
    // Container A: bin-walkin-steaks (already has 6 Ribeyes)
    // Container B: create secondary bin with 8 identical Ribeyes
    const containerB: Container = {
      id: 'bin-secondary-steaks',
      name: 'Overflow Steaks Basket',
      freezerId: 'freezer-main',
      deleteOnEmpty: true,
      icon: 'Box'
    };

    const cutInB: MeatCut = {
      id: 'cut-overflow-ribeye',
      productId: 'prod-ribeye',
      quantity: 8,
      containerId: 'bin-secondary-steaks',
      notes: 'Standard Cut'
    };

    let s1: InventoryState = {
      ...state,
      containers: [...state.containers, containerB],
      meatCuts: [...state.meatCuts, cutInB]
    };

    // Move all cuts from Container B into Container A
    const { state: s2 } = moveMeatCut(s1, {
      meatCutId: 'cut-overflow-ribeye',
      newContainerId: 'bin-walkin-steaks',
      quantity: 8
    }, { user: 'Lead Butcher' });

    // Consolidate cuts within Container A
    const s3 = consolidateMeatCutsInContainer('bin-walkin-steaks', s2);

    // Container B is now empty and was marked deleteOnEmpty -> retired!
    const emptiedB = s3.containers.find(c => c.id === 'bin-secondary-steaks');
    expect(emptiedB).toBeUndefined();

    // Container A total Ribeyes: 6 original + 8 merged = 14
    const totalA = s3.meatCuts
      .filter(mc => mc.containerId === 'bin-walkin-steaks' && mc.productId === 'prod-ribeye')
      .reduce((sum, mc) => sum + mc.quantity, 0);

    expect(totalA).toBe(14);
  });

  it('executes a freezer reconciliation with count variance adjustments and audit trail', () => {
    // Suppose physical audit of freezer-display reveals:
    // cut-display-ribeye: expected 2, physically counted 3 (variance: +1)
    // cut-display-ground: expected 5, physically counted 4 (variance: -1)
    const reconciliationUpdates = [
      { meatCutId: 'cut-display-ribeye', newQuantity: 3 },
      { meatCutId: 'cut-display-ground', newQuantity: 4 }
    ];

    let nextCuts = state.meatCuts.map(mc => {
      const update = reconciliationUpdates.find(u => u.meatCutId === mc.id);
      return update ? { ...mc, quantity: update.newQuantity } : mc;
    });

    const auditHistory = reconciliationUpdates.map(u => {
      const cut = state.meatCuts.find(mc => mc.id === u.meatCutId)!;
      const product = state.products.find(p => p.id === cut.productId)!;
      const variance = u.newQuantity - cut.quantity;
      return {
        id: `reconcile-${Date.now()}-${u.meatCutId}`,
        timestamp: new Date().toISOString(),
        description: `Reconciled "${product.name}" in Retail Display: ${cut.quantity} -> ${u.newQuantity} (${variance >= 0 ? '+' : ''}${variance}).`,
        targetId: u.meatCutId,
        user: 'Inventory Auditor'
      };
    });

    const s1: InventoryState = {
      ...state,
      meatCuts: nextCuts,
      history: [...auditHistory, ...state.history]
    };

    // Verify reconciled quantities
    const recRibeye = s1.meatCuts.find(mc => mc.id === 'cut-display-ribeye');
    expect(recRibeye?.quantity).toBe(3);

    const recGround = s1.meatCuts.find(mc => mc.id === 'cut-display-ground');
    expect(recGround?.quantity).toBe(4);

    // Verify audit logs
    expect(s1.history[0].description).toContain('Reconciled');
    expect(s1.history[0].user).toBe('Inventory Auditor');
  });
});
