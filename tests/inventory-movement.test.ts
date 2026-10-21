import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryState } from '../types';
import { moveMeatCut, moveContainer } from '../utils/inventoryOperations';

describe('Workflow: Moving Products & Containers', () => {
  let initialState: InventoryState;

  beforeEach(() => {
    initialState = {
      freezers: [
        { id: 'freezer-main', name: 'Main Walk-In Freezer' },
        { id: 'freezer-display', name: 'Retail Display Case' },
      ],
      containers: [
        { id: 'bin-1', name: 'Bin 1 (Ribeyes)', freezerId: 'freezer-main', icon: 'Box', deleteOnEmpty: false },
        { id: 'bin-2', name: 'Bin 2 (Front Case)', freezerId: 'freezer-display', icon: 'Box', deleteOnEmpty: false },
        { id: 'bin-temp', name: 'Temporary Tote', freezerId: 'freezer-main', icon: 'Package', deleteOnEmpty: true },
        { id: 'staging_loose', name: 'Loose Sorting Table', freezerId: undefined, icon: 'Layers' },
      ],
      products: [
        { id: 'prod-ribeye', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks' },
        { id: 'prod-pork-chop', name: 'Pork Chops', primaryCategory: 'Pork', subCategory: 'Chops' },
      ],
      meatCuts: [
        {
          id: 'cut-1',
          productId: 'prod-ribeye',
          containerId: 'bin-1',
          quantity: 6,
          notes: 'Standard Cut',
          tagIds: ['tag-choice'],
        },
      ],
      history: [],
    };
  });

  it('moves entire quantity of a product between containers and updates source/destination cleanly', () => {
    const { state: nextState, destCutId } = moveMeatCut(
      initialState,
      {
        meatCutId: 'cut-1',
        newContainerId: 'bin-2',
        quantity: 6,
      },
      { user: 'Tester', clientDevice: 'Desktop Chrome' }
    );

    // Source cut should no longer exist since full quantity was moved
    const sourceCut = nextState.meatCuts.find(mc => mc.id === 'cut-1');
    expect(sourceCut).toBeUndefined();

    // Destination should have 6 items
    const destCut = nextState.meatCuts.find(mc => mc.id === destCutId);
    expect(destCut).toBeDefined();
    expect(destCut?.containerId).toBe('bin-2');
    expect(destCut?.quantity).toBe(6);
    expect(destCut?.productId).toBe('prod-ribeye');

    // Audit history must record the movement
    expect(nextState.history.length).toBeGreaterThan(0);
    const moveHistory = nextState.history.find(h => h.description.includes('Moved 6x "Ribeye Steak"'));
    expect(moveHistory).toBeDefined();
    expect(moveHistory?.description).toContain('from "Bin 1 (Ribeyes)" to "Bin 2 (Front Case)"');
    expect(moveHistory?.user).toBe('Tester');
  });

  it('partially moves product quantity (split item) leaving correct balance in source container', () => {
    const { state: nextState, destCutId } = moveMeatCut(
      initialState,
      {
        meatCutId: 'cut-1',
        newContainerId: 'bin-2',
        quantity: 2,
      },
      { user: 'Staff' }
    );

    // Source cut should remain with 4 (6 - 2)
    const sourceCut = nextState.meatCuts.find(mc => mc.id === 'cut-1');
    expect(sourceCut).toBeDefined();
    expect(sourceCut?.quantity).toBe(4);
    expect(sourceCut?.containerId).toBe('bin-1');

    // Destination cut should have 2
    const destCut = nextState.meatCuts.find(mc => mc.id === destCutId);
    expect(destCut).toBeDefined();
    expect(destCut?.quantity).toBe(2);
    expect(destCut?.containerId).toBe('bin-2');

    // Total steaks across entire inventory must remain exactly 6
    const totalSteaks = nextState.meatCuts
      .filter(mc => mc.productId === 'prod-ribeye')
      .reduce((sum, mc) => sum + mc.quantity, 0);
    expect(totalSteaks).toBe(6);
  });

  it('merges identical variants when moving into a destination container that already contains that cut', () => {
    // Add existing Ribeyes with same variant to bin-2
    initialState.meatCuts.push({
      id: 'cut-dest-existing',
      productId: 'prod-ribeye',
      containerId: 'bin-2',
      quantity: 3,
      notes: 'Standard Cut',
      tagIds: ['tag-choice'],
    });

    const { state: nextState } = moveMeatCut(initialState, {
      meatCutId: 'cut-1',
      newContainerId: 'bin-2',
      quantity: 4,
    });

    // In bin-2, cuts should be consolidated into a single row with 3 + 4 = 7
    const destCuts = nextState.meatCuts.filter(mc => mc.containerId === 'bin-2');
    expect(destCuts.length).toBe(1);
    expect(destCuts[0].quantity).toBe(7);

    // In bin-1, source cut retains 2 (6 - 4)
    const sourceCut = nextState.meatCuts.find(mc => mc.id === 'cut-1');
    expect(sourceCut?.quantity).toBe(2);
  });

  it('does NOT merge different variants (e.g. different notes or tags) when moved to the same container', () => {
    // Existing item in bin-2 has a different note
    initialState.meatCuts.push({
      id: 'cut-dest-aged',
      productId: 'prod-ribeye',
      containerId: 'bin-2',
      quantity: 2,
      notes: 'Dry-Aged 45 Days',
      tagIds: ['tag-choice'],
    });

    const { state: nextState } = moveMeatCut(initialState, {
      meatCutId: 'cut-1',
      newContainerId: 'bin-2',
      quantity: 2,
    });

    // Both cuts should exist separately in bin-2 to preserve label integrity
    const destCuts = nextState.meatCuts.filter(mc => mc.containerId === 'bin-2');
    expect(destCuts.length).toBe(2);

    const agedCut = destCuts.find(mc => mc.notes === 'Dry-Aged 45 Days');
    const freshCut = destCuts.find(mc => mc.notes === 'Standard Cut');
    expect(agedCut?.quantity).toBe(2);
    expect(freshCut?.quantity).toBe(2);
  });

  it('retires and deletes temporary container (deleteOnEmpty: true) when emptied', () => {
    // Put cut in bin-temp
    initialState.meatCuts = [
      {
        id: 'cut-temp',
        productId: 'prod-pork-chop',
        containerId: 'bin-temp',
        quantity: 5,
      },
    ];

    const { state: nextState } = moveMeatCut(initialState, {
      meatCutId: 'cut-temp',
      newContainerId: 'bin-2',
      quantity: 5,
    });

    // bin-temp should be completely removed from containers list
    const tempContainer = nextState.containers.find(c => c.id === 'bin-temp');
    expect(tempContainer).toBeUndefined();

    // History should reflect retirement
    const retireHist = nextState.history.find(h => h.description.includes('was emptied and retired'));
    expect(retireHist).toBeDefined();
  });

  it('archives standard container (deleteOnEmpty: false) when completely emptied', () => {
    const { state: nextState } = moveMeatCut(initialState, {
      meatCutId: 'cut-1',
      newContainerId: 'bin-2',
      quantity: 6,
    });

    // bin-1 should be archived with freezerId removed
    const bin1 = nextState.containers.find(c => c.id === 'bin-1');
    expect(bin1).toBeDefined();
    expect(bin1?.isArchived).toBe(true);
    expect(bin1?.freezerId).toBeUndefined();
  });

  it('moves entire container from one freezer to another while keeping internal items intact', () => {
    const nextState = moveContainer(
      initialState,
      {
        containerId: 'bin-1',
        newFreezerId: 'freezer-display',
      },
      { user: 'Manager' }
    );

    const movedContainer = nextState.containers.find(c => c.id === 'bin-1');
    expect(movedContainer?.freezerId).toBe('freezer-display');

    // All cuts inside bin-1 remain untouched and linked
    const cutsInBin1 = nextState.meatCuts.filter(mc => mc.containerId === 'bin-1');
    expect(cutsInBin1.length).toBe(1);
    expect(cutsInBin1[0].quantity).toBe(6);

    // Audit log should verify container relocation
    const moveLog = nextState.history.find(h => h.targetId === 'bin-1');
    expect(moveLog?.description).toContain('moved from "Main Walk-In Freezer" to "Retail Display Case"');
  });
});
