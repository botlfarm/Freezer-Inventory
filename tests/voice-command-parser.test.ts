import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryState } from '../types';
import {
  parseVoiceTranscript,
  buildVoiceDispatchActions,
} from '../utils/voiceCommandParser';

describe('On-Site Local Voice Command Parser & Fuzzy Matcher', () => {
  let state: InventoryState;

  beforeEach(() => {
    state = {
      freezers: [
        { id: 'f-display', name: 'Display Case', isSpecial: true },
        { id: 'f-canada', name: 'Canada' },
        { id: 'f-chest', name: 'Chest Freezer' },
      ],
      containers: [
        { id: 'staging_loose', name: 'Loose', freezerId: undefined, icon: 'Layers' },
        { id: 'f-display_loose', name: 'Loose', freezerId: 'f-display', icon: 'Layers' },
        { id: 'f-canada_loose', name: 'Loose', freezerId: 'f-canada', icon: 'Layers' },
        { id: 'f-chest_loose', name: 'Loose', freezerId: 'f-chest', icon: 'Layers' },
        { id: 'c-orange-canada', name: 'Orange', freezerId: 'f-canada', icon: 'Box' },
        { id: 'c-orange-chest', name: 'Orange', freezerId: 'f-chest', icon: 'Box' },
        { id: 'c-blue-canada', name: 'Blue Tote', freezerId: 'f-canada', icon: 'Box' },
      ],
      products: [
        { id: 'p-brats-mild', name: 'Bratwurst Mild', primaryCategory: 'Pork', subCategory: 'Sausage' },
        { id: 'p-brats-hot', name: 'Bratwurst Jalapeno', primaryCategory: 'Pork', subCategory: 'Sausage' },
        { id: 'p-belly-fresh', name: 'Pork Belly Fresh', primaryCategory: 'Pork', subCategory: 'Belly' },
        { id: 'p-belly-smoked', name: 'Pork Belly Smoked', primaryCategory: 'Pork', subCategory: 'Belly' },
        { id: 'p-ground-pork', name: 'Ground Pork', primaryCategory: 'Pork', subCategory: 'Ground' },
        { id: 'p-chicken-broth', name: 'Chicken Broth', primaryCategory: 'Poultry', subCategory: 'Broth' },
        { id: 'p-hotdogs', name: 'Beef Hot Dogs', primaryCategory: 'Beef', subCategory: 'Sausage' },
        { id: 'p-ribeye', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks' },
        { id: 'p-mac-cheese', name: 'Mac and Cheese', primaryCategory: 'Prepared', subCategory: 'Sides' },
        { id: 'p-archived', name: 'Legacy Brats Archived', primaryCategory: 'Pork', subCategory: 'Sausage', isArchived: true },
      ],
      meatCuts: [
        // Display has Bratwurst Mild (only 1 brat variant in display!), Pork Belly Fresh, Ground Pork, Chicken Broth
        { id: 'mc-disp-brats', productId: 'p-brats-mild', quantity: 8, containerId: 'f-display_loose' },
        { id: 'mc-disp-belly', productId: 'p-belly-fresh', quantity: 5, containerId: 'f-display_loose' },
        { id: 'mc-disp-ground', productId: 'p-ground-pork', quantity: 10, containerId: 'f-display_loose' },
        { id: 'mc-disp-broth', productId: 'p-chicken-broth', quantity: 4, containerId: 'f-display_loose' },

        // Orange in Canada has Beef Hot Dogs and Pork Belly Fresh
        { id: 'mc-canada-hotdogs', productId: 'p-hotdogs', quantity: 12, containerId: 'c-orange-canada' },
        { id: 'mc-canada-belly', productId: 'p-belly-fresh', quantity: 6, containerId: 'c-orange-canada' },

        // Orange in Chest has Beef Hot Dogs too (tests "orange in canada" disambiguation!)
        { id: 'mc-chest-hotdogs', productId: 'p-hotdogs', quantity: 9, containerId: 'c-orange-chest' },
        { id: 'mc-chest-brats-hot', productId: 'p-brats-hot', quantity: 7, containerId: 'f-chest_loose' },
        { id: 'mc-chest-mac', productId: 'p-mac-cheese', quantity: 3, containerId: 'f-display_loose' },
      ],
      tags: [
        { id: 't-vac', name: 'Vacuum Sealed' },
      ],
      // Off-site & Butcher data that must NEVER be touched or matched
      locations: [
        { id: 'offsite-loc-1', name: 'Display Offsite Warehouse', isHome: false, type: 'storage' },
      ],
      offSiteEntries: [
        { id: 'off-1', serial: 'S1', productId: 'p-belly-fresh', pieces: 100, netWeight: 200, currentLocation: 'Pallet-1' },
      ],
      butcherOrders: [
        { id: 'bo-1', orderNumber: 'B-100', species: 'Pork', liveWeight: 300, hotWeight: 220, coldWeight: 210, createdAt: 1000 },
      ],
      history: [],
    };
  });

  it('interprets single remove command from display', () => {
    const parsed = parseVoiceTranscript('remove 2 brats from display', state);
    expect(parsed.clauses).toHaveLength(1);
    const clause = parsed.clauses[0];
    expect(clause.intent).toBe('remove');
    expect(clause.quantity).toBe(2);
    expect(clause.selectedProductId).toBe('p-brats-mild');
    expect(clause.selectedSourceContainerId).toBe('f-display_loose');
    expect(clause.selectedMeatCutId).toBe('mc-disp-brats');
    expect(clause.isValid).toBe(true);

    const actions = buildVoiceDispatchActions(parsed.clauses, state);
    expect(actions).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: { updates: { 'mc-disp-brats': 6 } },
      },
    ]);
  });

  it('interprets multi-item post-sale remove list sharing a trailing location', () => {
    const parsed = parseVoiceTranscript(
      'remove 2 brats, 1 belly, 3 ground pork and 1 chicken broth from display',
      state
    );
    expect(parsed.clauses).toHaveLength(4);
    expect(parsed.pendingSelectionCount).toBe(0);
    expect(parsed.readyMutationCount).toBe(4);

    expect(parsed.clauses.map(c => ({ qty: c.quantity, prod: c.selectedProductId }))).toEqual([
      { qty: 2, prod: 'p-brats-mild' },
      { qty: 1, prod: 'p-belly-fresh' },
      { qty: 3, prod: 'p-ground-pork' },
      { qty: 1, prod: 'p-chicken-broth' },
    ]);

    const actions = buildVoiceDispatchActions(parsed.clauses, state);
    expect(actions).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: {
          updates: {
            'mc-disp-brats': 6,
            'mc-disp-belly': 4,
            'mc-disp-ground': 7,
            'mc-disp-broth': 3,
          },
        },
      },
    ]);
  });

  it('does not split product names containing "and" such as "Mac and Cheese"', () => {
    const parsed = parseVoiceTranscript(
      'remove 2 mac and cheese and 1 chicken broth from display',
      state
    );
    expect(parsed.clauses).toHaveLength(2);
    expect(parsed.clauses[0].selectedProductId).toBe('p-mac-cheese');
    expect(parsed.clauses[0].quantity).toBe(2);
    expect(parsed.clauses[1].selectedProductId).toBe('p-chicken-broth');
    expect(parsed.clauses[1].quantity).toBe(1);
  });

  it('resolves hierarchical "<container> in <freezer>" move commands accurately', () => {
    const parsed = parseVoiceTranscript(
      'Move 4 hotdogs from orange in canada to display',
      state
    );
    expect(parsed.clauses).toHaveLength(1);
    const clause = parsed.clauses[0];
    expect(clause.intent).toBe('move');
    expect(clause.quantity).toBe(4);
    expect(clause.selectedProductId).toBe('p-hotdogs');
    expect(clause.selectedSourceContainerId).toBe('c-orange-canada');
    expect(clause.selectedDestContainerId).toBe('f-display_loose');
    expect(clause.selectedMeatCutId).toBe('mc-canada-hotdogs');
    expect(clause.isValid).toBe(true);

    const actions = buildVoiceDispatchActions(parsed.clauses, state);
    expect(actions).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-hotdogs',
          productId: 'p-hotdogs',
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'f-display_loose',
          quantity: 4,
        },
      },
    ]);
  });

  it('requires explicit user selection when partial names match multiple products or containers', () => {
    // Both Bratwurst Mild AND Bratwurst Jalapeno are stocked in display now
    state.meatCuts.push({
      id: 'mc-disp-brats-hot',
      productId: 'p-brats-hot',
      quantity: 5,
      containerId: 'f-display_loose',
    });

    const ambiguousProd = parseVoiceTranscript('remove 2 brats from display', state);
    const clause = ambiguousProd.clauses[0];
    expect(clause.requiresProductSelection).toBe(true);
    expect(clause.selectedProductId).toBeNull();
    expect(clause.productCandidates).toHaveLength(2);
    expect(clause.isValid).toBe(false);
    expect(buildVoiceDispatchActions(ambiguousProd.clauses, state)).toEqual([]);

    // Once user picks one candidate, clause becomes valid and executable
    const resolved = parseVoiceTranscript('remove 2 brats from display', state, {
      [clause.id]: { productId: 'p-brats-hot' },
    });
    expect(resolved.clauses[0].requiresProductSelection).toBe(false);
    expect(resolved.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(resolved.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: { updates: { 'mc-disp-brats-hot': 3 } },
      },
    ]);

    // Ambiguous container ("orange" without "in canada") exposes both Orange containers and requires selection
    const ambiguousLoc = parseVoiceTranscript('move 3 hotdogs from orange to display', state);
    expect(ambiguousLoc.clauses[0].requiresSourceLocationSelection).toBe(true);
    expect(ambiguousLoc.clauses[0].sourceLocationCandidates).toHaveLength(2);
    expect(ambiguousLoc.clauses[0].isValid).toBe(false);
  });

  it('requires stack selection when a container has multiple MeatCut variants for the same product', () => {
    state.meatCuts.push({
      id: 'mc-disp-brats-tagged',
      productId: 'p-brats-mild',
      quantity: 3,
      containerId: 'f-display_loose',
      notes: 'Promo pack',
      tagIds: ['t-vac'],
    });

    const parsed = parseVoiceTranscript('remove 2 brats from display', state);
    const clause = parsed.clauses[0];
    expect(clause.selectedProductId).toBe('p-brats-mild');
    expect(clause.requiresCutSelection).toBe(true);
    expect(clause.cutCandidates).toHaveLength(2);
    expect(clause.isValid).toBe(false);

    const resolved = parseVoiceTranscript('remove 2 brats from display', state, {
      [clause.id]: { meatCutId: 'mc-disp-brats-tagged' },
    });
    expect(resolved.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(resolved.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: { updates: { 'mc-disp-brats-tagged': 1 } },
      },
    ]);
  });

  it('executes stock queries immediately and strictly counts on-site inventory (excluding off-site)', () => {
    const parsed = parseVoiceTranscript('How many belly fresh do we have', state);
    expect(parsed.hasQueries).toBe(true);
    expect(parsed.hasMutations).toBe(false);

    const queryClause = parsed.clauses[0];
    expect(queryClause.intent).toBe('query');
    expect(queryClause.queryResults).toHaveLength(1);

    const bellyRes = queryClause.queryResults![0];
    expect(bellyRes.product.id).toBe('p-belly-fresh');
    // 5 in Display + 6 in Orange (Canada) = 11 on-site (must NOT include the 100 in offSiteEntries!)
    expect(bellyRes.totalQuantity).toBe(11);
    expect(bellyRes.locations).toHaveLength(2);
  });

  it('parses spoken number words and add commands', () => {
    const parsed = parseVoiceTranscript('add three ribeye to chest freezer', state);
    expect(parsed.clauses).toHaveLength(1);
    const clause = parsed.clauses[0];
    expect(clause.intent).toBe('add');
    expect(clause.quantity).toBe(3);
    expect(clause.selectedProductId).toBe('p-ribeye');
    expect(clause.selectedDestContainerId).toBe('f-chest_loose');
    expect(clause.isValid).toBe(true);

    const actions = buildVoiceDispatchActions(parsed.clauses, state);
    expect(actions).toEqual([
      {
        type: 'ADD_MEAT_CUT',
        payload: {
          productId: 'p-ribeye',
          quantity: 3,
          containerId: 'f-chest_loose',
        },
      },
    ]);
  });

  it('blocks execution when requested remove quantity exceeds available stock', () => {
    const parsed = parseVoiceTranscript('remove 20 chicken broth from display', state);
    const clause = parsed.clauses[0];
    expect(clause.isValid).toBe(false);
    expect(clause.errorMessage).toContain('Insufficient stock');
    expect(buildVoiceDispatchActions(parsed.clauses, state)).toEqual([]);
  });

  it('never matches archived products or off-site locations', () => {
    const archived = parseVoiceTranscript('how many legacy brats archived do we have', state);
    expect(archived.clauses[0].queryResults).toHaveLength(0);

    const offsiteLoc = parseVoiceTranscript('remove 1 belly from Display Offsite Warehouse', state);
    expect(offsiteLoc.clauses[0].sourceLocationCandidates).toHaveLength(0);
    expect(offsiteLoc.clauses[0].isValid).toBe(false);
  });

  it('handles natural query phrasings such as do I have, are on site, where are, and find me', () => {
    state.products.push({
      id: 'p-pork-liver',
      name: 'Pork Liver',
      primaryCategory: 'Pork',
      subCategory: 'Offal',
    });
    state.meatCuts.push(
      { id: 'mc-liver-1', productId: 'p-pork-liver', quantity: 4, containerId: 'f-display_loose' },
      { id: 'mc-liver-2', productId: 'p-pork-liver', quantity: 7, containerId: 'c-orange-canada' }
    );

    const queries = [
      'How many pork liver do I have?',
      'How many pork liver are on site?',
      'Where are pork liver',
      'Find me pork liver',
    ];

    for (const q of queries) {
      const parsed = parseVoiceTranscript(q, state);
      expect(parsed.hasQueries, q).toBe(true);
      expect(parsed.clauses, q).toHaveLength(1);
      expect(parsed.clauses[0].intent, q).toBe('query');
      expect(parsed.clauses[0].queryResults, q).toHaveLength(1);
      expect(parsed.clauses[0].queryResults![0].product.id, q).toBe('p-pork-liver');
      expect(parsed.clauses[0].queryResults![0].totalQuantity, q).toBe(11);
      expect(parsed.clauses[0].queryResults![0].locations, q).toHaveLength(2);
    }

    const scoped = parseVoiceTranscript('How many pork liver are in display?', state);
    expect(scoped.clauses[0].intent).toBe('query');
    expect(scoped.clauses[0].queryResults![0].totalQuantity).toBe(4);
    expect(scoped.clauses[0].queryResults![0].locations).toHaveLength(1);
  });

  it('parses multi-line colon-header lists with and without bullet points', () => {
    state.products.push(
      { id: 'p-belly-bacon', name: 'Belly Bacon', primaryCategory: 'Pork', subCategory: 'Bacon' },
      { id: 'p-crispy-ears', name: 'Crispy Ears', primaryCategory: 'Pork', subCategory: 'Snacks' },
      { id: 'p-goat-stew', name: 'Goat Stew', primaryCategory: 'Goat', subCategory: 'Stew' },
      { id: 'p-pork-liver', name: 'Pork Liver', primaryCategory: 'Pork', subCategory: 'Offal' }
    );
    state.meatCuts.push(
      { id: 'mc-disp-bacon', productId: 'p-belly-bacon', quantity: 5, containerId: 'f-display_loose' },
      { id: 'mc-disp-ears', productId: 'p-crispy-ears', quantity: 4, containerId: 'f-display_loose' },
      { id: 'mc-disp-stew', productId: 'p-goat-stew', quantity: 3, containerId: 'f-display_loose' },
      { id: 'mc-disp-liver', productId: 'p-pork-liver', quantity: 6, containerId: 'f-display_loose' }
    );

    const bulletedInput = [
      'Remove from display:',
      '- Three belly bacon',
      '- Two crispy ears',
      '- One goat stew',
      '- Two pork liver',
    ].join('\n');

    const plainMultilineInput = [
      'Remove from display:',
      'Three belly bacon',
      'Two crispy ears',
      'One goat stew',
      'Two pork liver',
    ].join('\n');

    for (const input of [bulletedInput, plainMultilineInput]) {
      const parsed = parseVoiceTranscript(input, state);
      expect(parsed.clauses).toHaveLength(4);
      expect(parsed.pendingSelectionCount).toBe(0);
      expect(parsed.readyMutationCount).toBe(4);
      expect(parsed.clauses.map(c => ({
        intent: c.intent,
        qty: c.quantity,
        prod: c.selectedProductId,
        src: c.selectedSourceContainerId,
        valid: c.isValid,
      }))).toEqual([
        { intent: 'remove', qty: 3, prod: 'p-belly-bacon', src: 'f-display_loose', valid: true },
        { intent: 'remove', qty: 2, prod: 'p-crispy-ears', src: 'f-display_loose', valid: true },
        { intent: 'remove', qty: 1, prod: 'p-goat-stew', src: 'f-display_loose', valid: true },
        { intent: 'remove', qty: 2, prod: 'p-pork-liver', src: 'f-display_loose', valid: true },
      ]);

      const actions = buildVoiceDispatchActions(parsed.clauses, state);
      expect(actions).toEqual([
        {
          type: 'BATCH_UPDATE_MEAT_QUANTITY',
          payload: {
            updates: {
              'mc-disp-bacon': 2,
              'mc-disp-ears': 2,
              'mc-disp-stew': 2,
              'mc-disp-liver': 4,
            },
          },
        },
      ]);
    }
  });

  it('parses same-line colon headers, location-first speech, and mixed blocks', () => {
    const sameLineColon = parseVoiceTranscript(
      'Remove from display: 2 brats, 1 belly, 3 ground pork',
      state
    );
    expect(sameLineColon.clauses).toHaveLength(3);
    expect(sameLineColon.readyMutationCount).toBe(3);

    const locationFirstSpoken = parseVoiceTranscript(
      'remove from display 2 brats and 1 chicken broth',
      state
    );
    expect(locationFirstSpoken.clauses).toHaveLength(2);
    expect(locationFirstSpoken.readyMutationCount).toBe(2);
    expect(locationFirstSpoken.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(locationFirstSpoken.clauses[1].selectedSourceContainerId).toBe('f-display_loose');

    const mixedBlock = parseVoiceTranscript(
      'Add to chest freezer:\n- 3 ribeye\n\nHow many ribeye do I have?',
      state
    );
    expect(mixedBlock.clauses).toHaveLength(2);
    expect(mixedBlock.clauses[0].intent).toBe('add');
    expect(mixedBlock.clauses[0].selectedProductId).toBe('p-ribeye');
    expect(mixedBlock.clauses[0].selectedDestContainerId).toBe('f-chest_loose');
    expect(mixedBlock.clauses[0].quantity).toBe(3);
    expect(mixedBlock.clauses[1].intent).toBe('query');
    expect(mixedBlock.clauses[1].queryResults![0].product.id).toBe('p-ribeye');
  });

  it('matches containers and products using w/, w/o, &, +, and common shorthand abbreviations', () => {
    state.containers.push(
      { id: 'c-tote-with-lid', name: 'Red Tote w/ Lid', freezerId: 'f-canada', icon: 'Box' },
      { id: 'c-tote-without-lid', name: 'Red Tote w/o Lid', freezerId: 'f-canada', icon: 'Box' },
      { id: 'c-blk-bin', name: 'Blk Bin w/ Ribs', freezerId: 'f-chest', icon: 'Box' }
    );
    state.products.push(
      { id: 'p-bnls-chkn', name: 'Bnls Chkn Brst', primaryCategory: 'Poultry', subCategory: 'Chicken' },
      { id: 'p-chops-bone', name: 'Pork Chops w/ Bone', primaryCategory: 'Pork', subCategory: 'Chops' }
    );
    state.meatCuts.push(
      { id: 'mc-red-lid-dogs', productId: 'p-hotdogs', quantity: 6, containerId: 'c-tote-with-lid' },
      { id: 'mc-red-nolid-dogs', productId: 'p-hotdogs', quantity: 5, containerId: 'c-tote-without-lid' },
      { id: 'mc-blk-chops', productId: 'p-chops-bone', quantity: 8, containerId: 'c-blk-bin' },
      { id: 'mc-disp-chkn', productId: 'p-bnls-chkn', quantity: 4, containerId: 'f-display_loose' }
    );

    // "red tote with lid" matches "Red Tote w/ Lid" cleanly without matching "Red Tote w/o Lid"
    const moveWithLid = parseVoiceTranscript(
      'Move 2 hotdogs from red tote with lid to display',
      state
    );
    expect(moveWithLid.clauses[0].selectedSourceContainerId).toBe('c-tote-with-lid');
    expect(moveWithLid.clauses[0].isValid).toBe(true);

    // "red tote without lid" matches "Red Tote w/o Lid"
    const moveWithoutLid = parseVoiceTranscript(
      'Move 2 hotdogs from red tote without lid to display',
      state
    );
    expect(moveWithoutLid.clauses[0].selectedSourceContainerId).toBe('c-tote-without-lid');
    expect(moveWithoutLid.clauses[0].isValid).toBe(true);

    // "black bin with ribs" matches "Blk Bin w/ Ribs", and "pork chops with bone" matches "Pork Chops w/ Bone"
    const abbrMove = parseVoiceTranscript(
      'Move 3 pork chops with bone from black bin with ribs to display',
      state
    );
    expect(abbrMove.clauses[0].selectedProductId).toBe('p-chops-bone');
    expect(abbrMove.clauses[0].selectedSourceContainerId).toBe('c-blk-bin');
    expect(abbrMove.clauses[0].isValid).toBe(true);

    // Spoken full words match abbreviated product "Bnls Chkn Brst", and "&" matches "Mac and Cheese"
    const prodAbbr = parseVoiceTranscript(
      'remove 1 boneless chicken breast and 1 mac & cheese from display',
      state
    );
    expect(prodAbbr.clauses).toHaveLength(2);
    expect(prodAbbr.clauses[0].selectedProductId).toBe('p-bnls-chkn');
    expect(prodAbbr.clauses[1].selectedProductId).toBe('p-mac-cheese');
  });

  it('resolves custom Voice Dictionary rules for products, containers, freezers, and phrases', () => {
    state.voiceDictionary = [
      {
        id: 'vd-1',
        spokenPhrase: 'rampler',
        targetType: 'product',
        targetId: 'p-ground-pork',
      },
      {
        id: 'vd-2',
        spokenPhrase: 'showroom',
        targetType: 'freezer',
        targetId: 'f-display',
      },
      {
        id: 'vd-3',
        spokenPhrase: 'north unit',
        targetType: 'freezer',
        targetId: 'f-canada',
      },
      {
        id: 'vd-4',
        spokenPhrase: 'big orange',
        targetType: 'container',
        targetId: 'c-orange-canada',
      },
      {
        id: 'vd-5',
        spokenPhrase: 'yeet',
        targetType: 'phrase',
        replacementText: 'remove',
      },
      {
        id: 'vd-6',
        spokenPhrase: 'front counter',
        targetType: 'phrase',
        replacementText: 'Display Case',
      },
      // Archived product mapped in dictionary must never match
      {
        id: 'vd-7',
        spokenPhrase: 'legacy sausage',
        targetType: 'product',
        targetId: 'p-archived',
      },
    ];

    // Product alias + freezer alias ("rampler" -> Ground Pork, "showroom" -> Display Case)
    const removeViaAliases = parseVoiceTranscript('remove 2 rampler from showroom', state);
    expect(removeViaAliases.clauses).toHaveLength(1);
    expect(removeViaAliases.clauses[0].selectedProductId).toBe('p-ground-pork');
    expect(removeViaAliases.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(removeViaAliases.clauses[0].quantity).toBe(2);
    expect(removeViaAliases.clauses[0].isValid).toBe(true);

    // Container alias + freezer alias inside hierarchical move + phrase rewrite ("front counter" -> "Display Case")
    const moveViaContainerAlias = parseVoiceTranscript(
      'move 3 hotdogs from big orange in north unit to front counter',
      state
    );
    expect(moveViaContainerAlias.clauses).toHaveLength(1);
    expect(moveViaContainerAlias.clauses[0].selectedProductId).toBe('p-hotdogs');
    expect(moveViaContainerAlias.clauses[0].selectedSourceContainerId).toBe('c-orange-canada');
    expect(moveViaContainerAlias.clauses[0].selectedDestContainerId).toBe('f-display_loose');
    expect(moveViaContainerAlias.clauses[0].isValid).toBe(true);

    // Custom action verb phrase rewrite ("yeet" -> "remove")
    const phraseVerb = parseVoiceTranscript('yeet 1 belly fresh from showroom', state);
    expect(phraseVerb.clauses).toHaveLength(1);
    expect(phraseVerb.clauses[0].intent).toBe('remove');
    expect(phraseVerb.clauses[0].selectedProductId).toBe('p-belly-fresh');
    expect(phraseVerb.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(phraseVerb.clauses[0].isValid).toBe(true);

    // Archived target exclusion
    const archivedAlias = parseVoiceTranscript('how many legacy sausage do I have', state);
    expect(archivedAlias.clauses[0].queryResults).toHaveLength(0);

    // Ambiguous custom alias shared across two stocked products requires selection
    state.voiceDictionary.push(
      { id: 'vd-dup-1', spokenPhrase: 'promo pack', targetType: 'product', targetId: 'p-belly-fresh' },
      { id: 'vd-dup-2', spokenPhrase: 'promo pack', targetType: 'product', targetId: 'p-chicken-broth' }
    );
    const ambiguousCustom = parseVoiceTranscript('remove 1 promo pack from showroom', state);
    expect(ambiguousCustom.clauses[0].requiresProductSelection).toBe(true);
    expect(ambiguousCustom.clauses[0].productCandidates).toHaveLength(2);
    expect(ambiguousCustom.clauses[0].isValid).toBe(false);
  });

  it('supports strict-keyword new container creation, multi-item lists, templates, and preserves normal add disambiguation', () => {
    state.products.push({
      id: 'p-liverwurst',
      name: 'Liverwurst',
      primaryCategory: 'Pork',
      subCategory: 'Offal',
    });

    // 1. Primary example: "add container yellow bag in freezer canada with 4 liverwurst"
    const basicNew = parseVoiceTranscript(
      'add container yellow bag in freezer canada with 4 liverwurst',
      state
    );
    expect(basicNew.clauses).toHaveLength(1);
    expect(basicNew.readyMutationCount).toBe(1);
    expect(basicNew.clauses[0].intent).toBe('add');
    expect(basicNew.clauses[0].isValid).toBe(true);
    expect(basicNew.clauses[0].resolvedNewContainerName).toBe('Yellow Bag');
    expect(basicNew.clauses[0].selectedFreezerId).toBe('f-canada');
    expect(basicNew.clauses[0].selectedTemplateId).toBe('__custom__');
    expect(basicNew.clauses[0].selectedProductId).toBe('p-liverwurst');
    expect(basicNew.clauses[0].quantity).toBe(4);

    const basicActions = buildVoiceDispatchActions(basicNew.clauses, state);
    expect(basicActions).toHaveLength(2);
    if (basicActions[0].type !== 'ADD_CONTAINER') throw new Error('Expected ADD_CONTAINER');
    expect(basicActions[0].payload).toMatchObject({
      name: 'Yellow Bag',
      freezerId: 'f-canada',
      icon: 'box',
    });
    const createdId = basicActions[0].payload.id;
    expect(createdId).toBeTruthy();
    expect(basicActions[1]).toEqual({
      type: 'ADD_MEAT_CUT',
      payload: {
        productId: 'p-liverwurst',
        quantity: 4,
        containerId: createdId,
      },
    });

    // 2. Multi-item inline creates ONE container + TWO meat_cuts sharing containerId
    const multiInline = parseVoiceTranscript(
      'add container yellow bag in canada with 4 brats mild, 2 hotdogs',
      state
    );
    expect(multiInline.clauses).toHaveLength(2);
    expect(multiInline.readyMutationCount).toBe(2);
    const multiInlineActions = buildVoiceDispatchActions(multiInline.clauses, state);
    expect(multiInlineActions).toHaveLength(3);
    if (multiInlineActions[0].type !== 'ADD_CONTAINER') throw new Error('Expected ADD_CONTAINER');
    const multiId = multiInlineActions[0].payload.id;
    expect(multiInlineActions[1]).toMatchObject({
      type: 'ADD_MEAT_CUT',
      payload: { productId: 'p-brats-mild', quantity: 4, containerId: multiId },
    });
    expect(multiInlineActions[2]).toMatchObject({
      type: 'ADD_MEAT_CUT',
      payload: { productId: 'p-hotdogs', quantity: 2, containerId: multiId },
    });

    // 3. Multi-line colon header + bullet items
    const multiLine = parseVoiceTranscript(
      'Add container yellow bag in freezer canada:\n- 4 brats mild\n- 2 hotdogs',
      state
    );
    expect(multiLine.clauses).toHaveLength(2);
    expect(multiLine.readyMutationCount).toBe(2);
    expect(multiLine.clauses[0].newContainerGroupKey).toBe(multiLine.clauses[1].newContainerGroupKey);
    const multiLineActions = buildVoiceDispatchActions(multiLine.clauses, state);
    expect(multiLineActions).toHaveLength(3);
    if (multiLineActions[0].type !== 'ADD_CONTAINER') throw new Error('Expected ADD_CONTAINER');
    if (multiLineActions[1].type !== 'ADD_MEAT_CUT') throw new Error('Expected ADD_MEAT_CUT');
    if (multiLineActions[2].type !== 'ADD_MEAT_CUT') throw new Error('Expected ADD_MEAT_CUT');
    expect(multiLineActions[0].payload.name).toBe('Yellow Bag');
    expect(multiLineActions[0].payload.freezerId).toBe('f-canada');
    expect(multiLineActions[1].payload.containerId).toBe(multiLineActions[0].payload.id);
    expect(multiLineActions[2].payload.containerId).toBe(multiLineActions[0].payload.id);

    // 4. Trailing freezer after items
    const trailingFreezer = parseVoiceTranscript(
      'add container yellow bag with 4 ribeye in chest freezer',
      state
    );
    expect(trailingFreezer.clauses).toHaveLength(1);
    expect(trailingFreezer.clauses[0].isValid).toBe(true);
    expect(trailingFreezer.clauses[0].resolvedNewContainerName).toBe('Yellow Bag');
    expect(trailingFreezer.clauses[0].selectedFreezerId).toBe('f-chest');
    expect(trailingFreezer.clauses[0].selectedProductId).toBe('p-ribeye');
    expect(trailingFreezer.clauses[0].quantity).toBe(4);

    // 5. Preserve "w/" shorthand inside new container name when followed by item split
    const shorthandName = parseVoiceTranscript(
      'add container red tote w/ lid in canada with 2 ribeye',
      state
    );
    expect(shorthandName.clauses).toHaveLength(1);
    expect(shorthandName.clauses[0].isValid).toBe(true);
    expect(shorthandName.clauses[0].resolvedNewContainerName).toBe('Red Tote w/ Lid');
    expect(shorthandName.clauses[0].selectedFreezerId).toBe('f-canada');
    expect(shorthandName.clauses[0].selectedProductId).toBe('p-ribeye');

    // 6. Items-first variation
    const itemsFirst = parseVoiceTranscript(
      'inbound 3 ribeye into new container yellow bag in chest freezer',
      state
    );
    expect(itemsFirst.clauses).toHaveLength(1);
    expect(itemsFirst.clauses[0].isValid).toBe(true);
    expect(itemsFirst.clauses[0].resolvedNewContainerName).toBe('Yellow Bag');
    expect(itemsFirst.clauses[0].selectedFreezerId).toBe('f-chest');
    expect(itemsFirst.clauses[0].selectedProductId).toBe('p-ribeye');
    expect(itemsFirst.clauses[0].quantity).toBe(3);

    // 7. Empty containers (no items) MUST NOT be valid or created
    const emptyContainer = parseVoiceTranscript('add container yellow bag in canada', state);
    expect(emptyContainer.clauses).toHaveLength(1);
    expect(emptyContainer.clauses[0].intent).toBe('add_container');
    expect(emptyContainer.clauses[0].isValid).toBe(false);
    expect(emptyContainer.clauses[0].errorMessage).toContain('Empty containers cannot be created');
    expect(emptyContainer.readyMutationCount).toBe(0);
    const emptyActions = buildVoiceDispatchActions(emptyContainer.clauses, state);
    expect(emptyActions).toHaveLength(0);

    // Excluding all items from a new-container group must also produce 0 dispatch actions (no empty container left behind)
    const excludedAllItems = parseVoiceTranscript(
      'add container yellow bag in canada with 4 brats mild, 2 hotdogs',
      state,
      { 'clause-0-0': { excluded: true }, 'clause-0-1': { excluded: true } }
    );
    expect(buildVoiceDispatchActions(excludedAllItems.clauses, state)).toHaveLength(0);

    // 8. Omitted freezer defaults cleanly to Staging Area (freezerId: undefined)
    const stagingContainer = parseVoiceTranscript('add container yellow bag with 3 ribeye', state);
    expect(stagingContainer.clauses[0].isValid).toBe(true);
    expect(stagingContainer.clauses[0].selectedFreezerId).toBe('__staging__');
    const stagingActions = buildVoiceDispatchActions(stagingContainer.clauses, state);
    if (stagingActions[0].type !== 'ADD_CONTAINER') throw new Error('Expected ADD_CONTAINER');
    expect(stagingActions[0].payload.freezerId).toBeUndefined();

    // 9. Container Template integration & Container Form draft options (photo, save as template, spare container)
    state.containerTemplates = [
      {
        id: 'tpl-yellow-bag',
        name: 'Yellow Bag',
        icon: 'bin',
        imageUrl: '/uploads/yellow-bag.png',
      },
      {
        id: 'tpl-blue-tote',
        name: 'Blue Tote Pack',
        icon: 'Box',
      },
    ];

    const exactTpl = parseVoiceTranscript(
      'add container yellow bag in canada with 2 ribeye',
      state
    );
    expect(exactTpl.clauses[0].isValid).toBe(true);
    expect(exactTpl.clauses[0].selectedTemplateId).toBe('tpl-yellow-bag');
    const exactTplActions = buildVoiceDispatchActions(exactTpl.clauses, state);
    if (exactTplActions[0].type !== 'ADD_CONTAINER') throw new Error('Expected ADD_CONTAINER');
    expect(exactTplActions[0].payload).toMatchObject({
      name: 'Yellow Bag',
      freezerId: 'f-canada',
      templateId: 'tpl-yellow-bag',
      icon: 'bin',
      imageUrl: '/uploads/yellow-bag.png',
    });

    const partialTpl = parseVoiceTranscript('add container tote in canada with 2 ribeye', state);
    expect(partialTpl.clauses[0].requiresTemplateSelection).toBe(true);
    expect(partialTpl.clauses[0].isValid).toBe(false);
    const partialResolvedCustom = parseVoiceTranscript(
      'add container tote in canada with 2 ribeye',
      state,
      { 'clause-0-0': { templateId: '__custom__' } }
    );
    expect(partialResolvedCustom.clauses[0].isValid).toBe(true);
    expect(partialResolvedCustom.clauses[0].selectedTemplateId).toBe('__custom__');

    // Explicit "from template" with unmatched name flags error / selection
    const unmatchedExplicitTpl = parseVoiceTranscript(
      'add container from template green crate in canada with 2 ribeye',
      state
    );
    expect(unmatchedExplicitTpl.clauses[0].isValid).toBe(false);
    expect(unmatchedExplicitTpl.clauses[0].requiresTemplateSelection).toBe(true);

    // Container Form draft options: custom name + photo + saveAsTemplate creates template + container + meatCut atomically
    const draftSaveTpl = parseVoiceTranscript(
      'add container green bin in canada with 3 ribeye',
      state,
      {
        'clause-0-0': {
          customContainerName: 'Green Bin #1',
          templateId: '__custom__',
          freezerId: 'f-chest',
          saveAsTemplate: true,
          containerImageUrl: '/uploads/green-bin.jpg',
          containerIcon: 'bin',
        },
      }
    );
    expect(draftSaveTpl.clauses[0].isValid).toBe(true);
    expect(draftSaveTpl.clauses[0].resolvedNewContainerName).toBe('Green Bin #1');
    expect(draftSaveTpl.clauses[0].newContainerSaveAsTemplate).toBe(true);
    expect(draftSaveTpl.clauses[0].newContainerImageUrl).toBe('/uploads/green-bin.jpg');
    const draftTplActions = buildVoiceDispatchActions(draftSaveTpl.clauses, state);
    expect(draftTplActions).toHaveLength(3);
    expect(draftTplActions[0].type).toBe('ADD_CONTAINER_TEMPLATE');
    expect(draftTplActions[1].type).toBe('ADD_CONTAINER');
    expect(draftTplActions[2].type).toBe('ADD_MEAT_CUT');
    if (draftTplActions[0].type !== 'ADD_CONTAINER_TEMPLATE') throw new Error('Expected ADD_CONTAINER_TEMPLATE');
    if (draftTplActions[1].type !== 'ADD_CONTAINER') throw new Error('Expected ADD_CONTAINER');
    if (draftTplActions[2].type !== 'ADD_MEAT_CUT') throw new Error('Expected ADD_MEAT_CUT');
    expect(draftTplActions[0].payload).toMatchObject({
      name: 'Green Bin #1',
      imageUrl: '/uploads/green-bin.jpg',
      icon: 'bin',
    });
    expect(draftTplActions[1].payload).toMatchObject({
      name: 'Green Bin #1',
      freezerId: 'f-chest',
      templateId: draftTplActions[0].payload.id,
      imageUrl: '/uploads/green-bin.jpg',
      icon: 'bin',
    });
    expect(draftTplActions[2].payload.containerId).toBe(draftTplActions[1].payload.id);

    // Container Form spare placement reuses existing spare container via MOVE_CONTAINER + ADD_MEAT_CUT
    state.containers.push({
      id: 'c-spare-yellow',
      name: 'Yellow Spare Tote',
      freezerId: undefined,
      icon: 'Box',
    });
    const draftSpare = parseVoiceTranscript(
      'add container yellow spare in canada with 2 ribeye',
      state,
      {
        'clause-0-0': {
          existingSpareContainerId: 'c-spare-yellow',
          freezerId: 'f-canada',
        },
      }
    );
    expect(draftSpare.clauses[0].isValid).toBe(true);
    const draftSpareActions = buildVoiceDispatchActions(draftSpare.clauses, state);
    expect(draftSpareActions).toHaveLength(2);
    expect(draftSpareActions[0]).toEqual({
      type: 'MOVE_CONTAINER',
      payload: { containerId: 'c-spare-yellow', newFreezerId: 'f-canada' },
    });
    expect(draftSpareActions[1]).toEqual({
      type: 'ADD_MEAT_CUT',
      payload: { productId: 'p-ribeye', quantity: 2, containerId: 'c-spare-yellow' },
    });

    // 10. Non-blocking warning when active container with same name already exists in target freezer
    const dupWarning = parseVoiceTranscript(
      'add container orange in freezer canada with 2 ribeye',
      state
    );
    expect(dupWarning.clauses[0].isValid).toBe(true);
    expect(dupWarning.clauses[0].warningMessage).toContain('Orange');
    expect(dupWarning.clauses[0].warningMessage).toContain('Canada');

    // 11. Regression guard: normal "add <items> to <location>" NEVER triggers template or new container creation
    const normalAddNoContainers = parseVoiceTranscript('add 3 ribeye to magenta', state);
    expect(normalAddNoContainers.clauses[0].intent).toBe('add');
    expect(normalAddNoContainers.clauses[0].newContainerGroupKey).toBeUndefined();
    expect(normalAddNoContainers.clauses[0].destLocationCandidates).toHaveLength(0);
    expect(normalAddNoContainers.clauses[0].isValid).toBe(false);
  });

  it('supports Voice Dictionary command rules, multi-word command shortcuts, and composed phrase expansion', () => {
    state.voiceDictionary = [
      {
        id: 'vd-cmd-1',
        spokenPhrase: 'start new bag',
        targetType: 'command',
        replacementText: 'add container',
      },
      {
        id: 'vd-cmd-2',
        spokenPhrase: 'market pull',
        targetType: 'command',
        replacementText: 'remove from market shelf',
      },
      {
        id: 'vd-cmd-3',
        spokenPhrase: 'stock check',
        targetType: 'command',
        replacementText: 'how many',
      },
      {
        id: 'vd-phrase-shelf',
        spokenPhrase: 'market shelf',
        targetType: 'phrase',
        replacementText: 'Display Case',
      },
    ];

    // Command macro mapping spoken "start new bag" -> "add container"
    const cmdNewContainer = parseVoiceTranscript(
      'start new bag yellow bag in canada with 3 ribeye',
      state
    );
    expect(cmdNewContainer.clauses).toHaveLength(1);
    expect(cmdNewContainer.clauses[0].intent).toBe('add');
    expect(cmdNewContainer.clauses[0].resolvedNewContainerName).toBe('Yellow Bag');
    expect(cmdNewContainer.clauses[0].selectedFreezerId).toBe('f-canada');
    expect(cmdNewContainer.clauses[0].selectedProductId).toBe('p-ribeye');
    expect(cmdNewContainer.clauses[0].isValid).toBe(true);

    // Command shortcut + composed phrase expansion in multi-line bullet format:
    // "market pull" -> "remove from market shelf" -> "remove from Display Case"
    const composedMulti = parseVoiceTranscript(
      'market pull:\n- 2 brats mild\n- 1 belly fresh',
      state
    );
    expect(composedMulti.clauses).toHaveLength(2);
    expect(composedMulti.readyMutationCount).toBe(2);
    expect(composedMulti.clauses[0].intent).toBe('remove');
    expect(composedMulti.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(composedMulti.clauses[1].selectedSourceContainerId).toBe('f-display_loose');

    // Command shortcut for stock queries ("stock check" -> "how many")
    const cmdQuery = parseVoiceTranscript('stock check belly fresh', state);
    expect(cmdQuery.clauses).toHaveLength(1);
    expect(cmdQuery.clauses[0].intent).toBe('query');
    expect(cmdQuery.clauses[0].queryResults?.[0].product.id).toBe('p-belly-fresh');
  });

  it('supports flexible container-level empty_container commands and safe MOVE_MEAT_QUANTITY dispatch', () => {
    // 1. Default empty to Staging Area via polite conversational lead-in
    const parsed = parseVoiceTranscript('can you please empty out container orange in canada', state);
    expect(parsed.clauses).toHaveLength(1);
    const clause = parsed.clauses[0];
    expect(clause.intent).toBe('empty_container');
    expect(clause.selectedSourceContainerId).toBe('c-orange-canada');
    expect(clause.selectedDestContainerId).toBe('staging_loose');
    expect(clause.containerCutPreviews).toHaveLength(2);
    expect(clause.isValid).toBe(true);

    const actions = buildVoiceDispatchActions(parsed.clauses, state);
    expect(actions).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-hotdogs',
          productId: 'p-hotdogs',
          quantity: 12,
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'staging_loose',
        },
      },
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-belly',
          productId: 'p-belly-fresh',
          quantity: 6,
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'staging_loose',
        },
      },
    ]);

    // 2. Empty into an explicit destination container
    const toDisplay = parseVoiceTranscript('unload orange in canada to display', state);
    expect(toDisplay.clauses[0].intent).toBe('empty_container');
    expect(toDisplay.clauses[0].selectedSourceContainerId).toBe('c-orange-canada');
    expect(toDisplay.clauses[0].selectedDestContainerId).toBe('f-display_loose');
    expect(toDisplay.clauses[0].isValid).toBe(true);

    // 3. Ambiguous container without freezer prompts explicit disambiguation
    const ambiguous = parseVoiceTranscript('empty container orange', state);
    expect(ambiguous.clauses[0].intent).toBe('empty_container');
    expect(ambiguous.clauses[0].sourceLocationCandidates).toHaveLength(2);
    expect(ambiguous.clauses[0].isValid).toBe(false);

    // 4. Empty container already having 0 items fails safely
    const alreadyEmpty = parseVoiceTranscript('empty blue tote', state);
    expect(alreadyEmpty.clauses[0].intent).toBe('empty_container');
    expect(alreadyEmpty.clauses[0].isValid).toBe(false);
    expect(alreadyEmpty.clauses[0].errorMessage).toContain('already empty');
  });

  it('supports move_all commands and move_container with automatic move_all fallback when destination is a container', () => {
    // 1. Explicit move all of container Y to Z
    const moveAll = parseVoiceTranscript('move all of container orange in canada to blue tote', state);
    expect(moveAll.clauses).toHaveLength(1);
    expect(moveAll.clauses[0].intent).toBe('move_all');
    expect(moveAll.clauses[0].selectedSourceContainerId).toBe('c-orange-canada');
    expect(moveAll.clauses[0].selectedDestContainerId).toBe('c-blue-canada');
    expect(moveAll.clauses[0].isValid).toBe(true);

    const moveAllActions = buildVoiceDispatchActions(moveAll.clauses, state);
    expect(moveAllActions).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-hotdogs',
          productId: 'p-hotdogs',
          quantity: 12,
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'c-blue-canada',
        },
      },
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-belly',
          productId: 'p-belly-fresh',
          quantity: 6,
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'c-blue-canada',
        },
      },
    ]);

    // 2. Natural variation "move everything in X to Y"
    const moveEverything = parseVoiceTranscript('move everything in orange in chest to display', state);
    expect(moveEverything.clauses[0].intent).toBe('move_all');
    expect(moveEverything.clauses[0].selectedSourceContainerId).toBe('c-orange-chest');
    expect(moveEverything.clauses[0].selectedDestContainerId).toBe('f-display_loose');
    expect(moveEverything.clauses[0].isValid).toBe(true);

    // 3. Relocate whole non-loose container intact to another freezer or staging
    const moveCont = parseVoiceTranscript('move container blue tote to chest freezer', state);
    expect(moveCont.clauses[0].intent).toBe('move_container');
    expect(moveCont.clauses[0].selectedSourceContainerId).toBe('c-blue-canada');
    expect(moveCont.clauses[0].selectedFreezerId).toBe('f-chest');
    expect(moveCont.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(moveCont.clauses, state)).toEqual([
      {
        type: 'MOVE_CONTAINER',
        payload: { containerId: 'c-blue-canada', newFreezerId: 'f-chest' },
      },
    ]);

    const moveContStaging = parseVoiceTranscript('relocate orange in canada to staging', state);
    expect(moveContStaging.clauses[0].intent).toBe('move_container');
    expect(moveContStaging.clauses[0].selectedFreezerId).toBe('__staging__');
    expect(buildVoiceDispatchActions(moveContStaging.clauses, state)).toEqual([
      {
        type: 'MOVE_CONTAINER',
        payload: { containerId: 'c-orange-canada', newFreezerId: undefined },
      },
    ]);

    // 4. Same-freezer relocation is blocked as a no-op
    const sameFreezer = parseVoiceTranscript('move container orange in canada to canada', state);
    expect(sameFreezer.clauses[0].intent).toBe('move_container');
    expect(sameFreezer.clauses[0].isValid).toBe(false);
    expect(sameFreezer.clauses[0].errorMessage).toContain('already in Canada');

    // 5. "move container Y to Z" where Z is another named container auto-falls back to move_all
    const fallbackMoveAll = parseVoiceTranscript('move container orange in canada to blue tote', state);
    expect(fallbackMoveAll.clauses[0].intent).toBe('move_all');
    expect(fallbackMoveAll.clauses[0].selectedSourceContainerId).toBe('c-orange-canada');
    expect(fallbackMoveAll.clauses[0].selectedDestContainerId).toBe('c-blue-canada');
    expect(fallbackMoveAll.clauses[0].isValid).toBe(true);
  });

  it('supports combine_containers symmetrically, directionally, and with slot disambiguation', () => {
    state.meatCuts.push({
      id: 'mc-blue-brats',
      productId: 'p-brats-mild',
      quantity: 4,
      containerId: 'c-blue-canada',
    });

    // 1. Symmetric "combine containers X and Y" prompts user to pick the surviving container
    const symmetric = parseVoiceTranscript(
      'combine containers orange in canada and blue tote',
      state
    );
    expect(symmetric.clauses).toHaveLength(1);
    const symClause = symmetric.clauses[0];
    expect(symClause.intent).toBe('combine_containers');
    expect(symClause.combineExplicitTarget).toBe(false);
    expect(symClause.combineSlots).toHaveLength(2);
    expect(symClause.combineSlots?.[0].selectedContainerId).toBe('c-orange-canada');
    expect(symClause.combineSlots?.[1].selectedContainerId).toBe('c-blue-canada');
    expect(symClause.isValid).toBe(false);

    // Selecting surviving container dispatches MOVE_MEAT_QUANTITY from absorbed container(s) only
    const symmetricResolved = parseVoiceTranscript(
      'combine containers orange in canada and blue tote',
      state,
      { 'clause-0-0': { destContainerId: 'c-orange-canada' } }
    );
    expect(symmetricResolved.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(symmetricResolved.clauses, state)).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-blue-brats',
          productId: 'p-brats-mild',
          quantity: 4,
          sourceContainerId: 'c-blue-canada',
          newContainerId: 'c-orange-canada',
        },
      },
    ]);

    // 2. Directional "merge X into Y" auto-selects Y as surviving target
    const directional = parseVoiceTranscript(
      'merge orange in canada into blue tote',
      state
    );
    expect(directional.clauses[0].intent).toBe('combine_containers');
    expect(directional.clauses[0].combineExplicitTarget).toBe(true);
    expect(directional.clauses[0].selectedDestContainerId).toBe('c-blue-canada');
    expect(directional.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(directional.clauses, state)).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-hotdogs',
          productId: 'p-hotdogs',
          quantity: 12,
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'c-blue-canada',
        },
      },
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-belly',
          productId: 'p-belly-fresh',
          quantity: 6,
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'c-blue-canada',
        },
      },
    ]);

    // 3. Container names containing "and" stay intact inside combine commands
    state.containers.push({
      id: 'c-clear-dry',
      name: 'Clear and Dry',
      freezerId: 'f-canada',
      icon: 'Box',
    });
    const withAndInName = parseVoiceTranscript(
      'combine clear and dry into blue tote',
      state
    );
    expect(withAndInName.clauses).toHaveLength(1);
    expect(withAndInName.clauses[0].intent).toBe('combine_containers');
    expect(withAndInName.clauses[0].combineSlots?.[0].selectedContainerId).toBe('c-clear-dry');
    expect(withAndInName.clauses[0].selectedDestContainerId).toBe('c-blue-canada');

    // 4. Per-slot disambiguation with combineSlotSelections
    const ambiguousSlot = parseVoiceTranscript(
      'merge orange into blue tote',
      state,
      { 'clause-0-0': { combineSlotSelections: { 0: 'c-orange-chest' } } }
    );
    expect(ambiguousSlot.clauses[0].combineSlots?.[0].selectedContainerId).toBe('c-orange-chest');
    expect(ambiguousSlot.clauses[0].isValid).toBe(true);
  });

  it('supports all/remaining item quantities, zero-out shortcuts, container_query, and dictionary macros for new intents', () => {
    // 1. All/remaining remove & zero-out
    const removeAll = parseVoiceTranscript('remove all brats from display', state);
    expect(removeAll.clauses[0].intent).toBe('remove');
    expect(removeAll.clauses[0].isAllQuantity).toBe(true);
    expect(removeAll.clauses[0].quantity).toBe(8);
    expect(buildVoiceDispatchActions(removeAll.clauses, state)).toEqual([
      { type: 'BATCH_UPDATE_MEAT_QUANTITY', payload: { updates: { 'mc-disp-brats': 0 } } },
    ]);

    const zeroOut = parseVoiceTranscript('zero out ground pork from display', state);
    expect(zeroOut.clauses[0].intent).toBe('remove');
    expect(zeroOut.clauses[0].isAllQuantity).toBe(true);
    expect(zeroOut.clauses[0].quantity).toBe(10);
    expect(buildVoiceDispatchActions(zeroOut.clauses, state)).toEqual([
      { type: 'BATCH_UPDATE_MEAT_QUANTITY', payload: { updates: { 'mc-disp-ground': 0 } } },
    ]);

    // 2. All/remaining item move
    const moveAllItem = parseVoiceTranscript('move all hotdogs from orange in canada to display', state);
    expect(moveAllItem.clauses[0].intent).toBe('move');
    expect(moveAllItem.clauses[0].isAllQuantity).toBe(true);
    expect(moveAllItem.clauses[0].quantity).toBe(12);
    expect(buildVoiceDispatchActions(moveAllItem.clauses, state)).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-hotdogs',
          productId: 'p-hotdogs',
          quantity: 12,
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'f-display_loose',
        },
      },
    ]);

    // 3. Container content inspection query (strictly on-site, no mutations)
    const inspect = parseVoiceTranscript("what's in orange in canada", state);
    expect(inspect.clauses).toHaveLength(1);
    expect(inspect.clauses[0].intent).toBe('container_query');
    expect(inspect.clauses[0].isValid).toBe(true);
    expect(inspect.clauses[0].containerQueryResults).toHaveLength(1);
    expect(inspect.clauses[0].containerQueryResults?.[0].totalPieces).toBe(18);
    expect(inspect.clauses[0].containerQueryResults?.[0].items).toHaveLength(2);
    expect(buildVoiceDispatchActions(inspect.clauses, state)).toEqual([]);

    // 4. Dictionary command shortcut composing with empty_container
    state.voiceDictionary = [
      {
        id: 'vd-dump',
        spokenPhrase: 'dump bin',
        targetType: 'command',
        replacementText: 'empty container',
      },
    ];
    const customDump = parseVoiceTranscript('dump bin orange in canada', state);
    expect(customDump.clauses[0].intent).toBe('empty_container');
    expect(customDump.clauses[0].selectedSourceContainerId).toBe('c-orange-canada');
    expect(customDump.clauses[0].selectedDestContainerId).toBe('staging_loose');
    expect(customDump.clauses[0].isValid).toBe(true);
  });

  it('supports container location lookup (where is red bag) and freezer-scoped container count/list queries (how many green bags are in freezer 1)', () => {
    state.freezers.push({ id: 'f-1', name: 'Freezer 1' });
    state.containers.push(
      { id: 'f-1_loose', name: 'Loose', freezerId: 'f-1', icon: 'Layers' },
      { id: 'c-red-bag', name: 'Red Bag', freezerId: 'f-1', icon: 'Box' },
      { id: 'c-green-1', name: 'Green Bag', freezerId: 'f-1', icon: 'Box' },
      { id: 'c-green-2', name: 'Green Bag #2', freezerId: 'f-1', icon: 'Box' },
      { id: 'c-green-chest', name: 'Green Bag', freezerId: 'f-chest', icon: 'Box' },
      { id: 'c-green-tote-f1', name: 'Green Tote', freezerId: 'f-1', icon: 'Box' }
    );
    state.meatCuts.push({
      id: 'mc-red-ribeye',
      productId: 'p-ribeye',
      quantity: 5,
      containerId: 'c-red-bag',
    });

    // 1. "where is red bag" locates container + freezer + items inside (strictly read-only)
    const whereRed = parseVoiceTranscript('where is red bag', state);
    expect(whereRed.clauses).toHaveLength(1);
    expect(whereRed.clauses[0].intent).toBe('container_query');
    expect(whereRed.clauses[0].containerQueryMode).toBe('location');
    expect(whereRed.clauses[0].isValid).toBe(true);
    expect(whereRed.clauses[0].containerQueryResults).toHaveLength(1);
    expect(whereRed.clauses[0].containerQueryResults?.[0]).toMatchObject({
      containerId: 'c-red-bag',
      containerName: 'Red Bag',
      freezerName: 'Freezer 1',
      totalPieces: 5,
    });
    expect(buildVoiceDispatchActions(whereRed.clauses, state)).toEqual([]);

    // 2. Ambiguous container location shows all matching containers across freezers
    const whereOrange = parseVoiceTranscript('where are orange', state);
    expect(whereOrange.clauses[0].intent).toBe('container_query');
    expect(whereOrange.clauses[0].containerQueryMode).toBe('location');
    expect(whereOrange.clauses[0].containerQueryResults).toHaveLength(2);

    // 3. "how many green bags are in freezer 1" scopes strictly to Freezer 1 & distinguishes Bag vs Tote
    const countGreenF1 = parseVoiceTranscript('how many green bags are in freezer 1', state);
    expect(countGreenF1.clauses[0].intent).toBe('container_query');
    expect(countGreenF1.clauses[0].containerQueryMode).toBe('count');
    expect(countGreenF1.clauses[0].containerQueryTargetLabel).toBe('Freezer 1');
    expect(countGreenF1.clauses[0].containerQueryResults?.map(r => r.containerId).sort()).toEqual([
      'c-green-1',
      'c-green-2',
    ]);

    // Spoken number-word variant ("freezer one") resolves identically
    const countGreenSpoken = parseVoiceTranscript('how many green bags are in freezer one', state);
    expect(countGreenSpoken.clauses[0].intent).toBe('container_query');
    expect(countGreenSpoken.clauses[0].containerQueryTargetLabel).toBe('Freezer 1');
    expect(countGreenSpoken.clauses[0].containerQueryResults).toHaveLength(2);

    // 4. Scoped freezer count returning 0 still succeeds cleanly with 0 count instead of product fallback error
    const countZero = parseVoiceTranscript('how many red bags are in chest freezer', state);
    expect(countZero.clauses[0].intent).toBe('container_query');
    expect(countZero.clauses[0].containerQueryMode).toBe('count');
    expect(countZero.clauses[0].containerQueryTargetLabel).toBe('Chest Freezer');
    expect(countZero.clauses[0].containerQueryResults).toHaveLength(0);
    expect(countZero.clauses[0].isValid).toBe(true);

    // 5. General freezer container listing & counting
    const listF1 = parseVoiceTranscript('what containers are in freezer 1', state);
    expect(listF1.clauses[0].intent).toBe('container_query');
    expect(listF1.clauses[0].containerQueryMode).toBe('contents');
    expect(listF1.clauses[0].containerQueryTargetLabel).toBe('Freezer 1');
    expect(listF1.clauses[0].containerQueryResults).toHaveLength(4);

    const countAllF1 = parseVoiceTranscript('how many containers are in freezer 1', state);
    expect(countAllF1.clauses[0].intent).toBe('container_query');
    expect(countAllF1.clauses[0].containerQueryMode).toBe('count');
    expect(countAllF1.clauses[0].containerQueryResults).toHaveLength(4);

    // 6. Product "where are <product>" regression guard stays intent: 'query'
    const whereProduct = parseVoiceTranscript('where are brats mild', state);
    expect(whereProduct.clauses[0].intent).toBe('query');
    expect(whereProduct.clauses[0].queryResults?.[0].product.id).toBe('p-brats-mild');
  });
});





