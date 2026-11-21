import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryState } from '../types';
import {
  parseVoiceTranscript,
  buildVoiceDispatchActions,
  VOICE_PRIMARY_DISPLAY_CONFIG_KEY,
  getPrimaryVoiceDisplayFreezer,
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

  it('resolves singular "display" via Primary Display setting, literal name priority, and plural "all displays" / "special freezers" across multiple Special Freezers', () => {
    // Configure two Special Freezers: literal "Display" + differently named "Farmers Market"
    state.freezers = [
      { id: 'f-display', name: 'Display', isSpecial: true },
      { id: 'f-market', name: 'Farmers Market', isSpecial: true },
      { id: 'f-canada', name: 'Canada' },
    ];
    state.containers.push(
      { id: 'f-market_loose', name: 'Loose', freezerId: 'f-market', icon: 'Layers' },
      { id: 'c-disp-tray', name: 'Sample Tray', freezerId: 'f-display', icon: 'Box' },
      { id: 'c-market-cooler', name: 'Market Cooler', freezerId: 'f-market', icon: 'Box' }
    );
    state.meatCuts.push({
      id: 'mc-market-brats',
      productId: 'p-brats-mild',
      quantity: 12,
      containerId: 'f-market_loose',
    });

    // 1. Automatic mode (no Primary setting): literal "Display" beats differently named isSpecial "Farmers Market"
    const autoSingular = parseVoiceTranscript('remove 2 brats from display', state);
    expect(autoSingular.clauses[0].intent).toBe('remove');
    expect(autoSingular.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(autoSingular.clauses[0].requiresSourceLocationSelection).toBe(false);
    expect(autoSingular.clauses[0].isValid).toBe(true);

    const autoDisplayCase = parseVoiceTranscript('remove 2 brats from display case', state);
    expect(autoDisplayCase.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(autoDisplayCase.clauses[0].isValid).toBe(true);

    // 2. Direct targeting of secondary Special Freezer still resolves cleanly by name
    const directMarket = parseVoiceTranscript('remove 3 brats from farmers market', state);
    expect(directMarket.clauses[0].selectedSourceContainerId).toBe('f-market_loose');
    expect(directMarket.clauses[0].isValid).toBe(true);

    // 3. Explicit Primary Display override in appConfig routes "display" strictly to Farmers Market
    state.appConfig = [
      { key: VOICE_PRIMARY_DISPLAY_CONFIG_KEY, value: 'f-market' },
    ];
    expect(getPrimaryVoiceDisplayFreezer(state)?.id).toBe('f-market');

    const primaryOverride = parseVoiceTranscript('remove 2 brats from display', state);
    expect(primaryOverride.clauses[0].selectedSourceContainerId).toBe('f-market_loose');
    expect(primaryOverride.clauses[0].isValid).toBe(true);

    const primaryAddCont = parseVoiceTranscript('add container market bin in display with 4 ribeye', state);
    expect(primaryAddCont.clauses[0].selectedFreezerId).toBe('f-market');
    expect(primaryAddCont.clauses[0].isValid).toBe(true);

    // 4. Stale/deleted Primary Display setting falls back gracefully to Automatic literal priority
    state.appConfig = [
      { key: VOICE_PRIMARY_DISPLAY_CONFIG_KEY, value: 'f-deleted-missing' },
    ];
    expect(getPrimaryVoiceDisplayFreezer(state)).toBeUndefined();
    const deletedFallback = parseVoiceTranscript('remove 2 brats from display', state);
    expect(deletedFallback.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(deletedFallback.clauses[0].isValid).toBe(true);

    // 5. Plural "all displays" and "special freezers" span all Special Freezers together
    const stockAllDisplays = parseVoiceTranscript('how many brats are in all displays?', state);
    expect(stockAllDisplays.clauses[0].intent).toBe('query');
    expect(stockAllDisplays.clauses[0].isValid).toBe(true);
    expect(stockAllDisplays.clauses[0].queryResults?.[0].totalQuantity).toBe(20); // 8 in Display + 12 in Farmers Market
    expect(stockAllDisplays.clauses[0].queryResults?.[0].locations).toHaveLength(2);

    const listSpecialContainers = parseVoiceTranscript('what containers are in special freezers', state);
    expect(listSpecialContainers.clauses[0].intent).toBe('container_query');
    expect(listSpecialContainers.clauses[0].containerQueryTargetLabel).toBe('Display / Farmers Market');
    expect(listSpecialContainers.clauses[0].containerQueryResults?.map(r => r.containerId).sort()).toEqual([
      'c-disp-tray',
      'c-market-cooler',
    ]);

    const removeAllDisplaysAmbiguous = parseVoiceTranscript('remove 2 brats from all displays', state);
    expect(removeAllDisplaysAmbiguous.clauses[0].sourceLocationCandidates.map(c => c.containerId).sort()).toEqual([
      'f-display_loose',
      'f-market_loose',
    ]);
    expect(removeAllDisplaysAmbiguous.clauses[0].requiresSourceLocationSelection).toBe(true);
    expect(removeAllDisplaysAmbiguous.clauses[0].isValid).toBe(false);

    // 6. Tied literal "Display Front" / "Display Back" in Automatic mode prompts for selection
    state.appConfig = [];
    state.freezers = [
      { id: 'f-disp-front', name: 'Display Front', isSpecial: true },
      { id: 'f-disp-back', name: 'Display Back', isSpecial: true },
    ];
    state.containers.push(
      { id: 'f-disp-front_loose', name: 'Loose', freezerId: 'f-disp-front', icon: 'Layers' },
      { id: 'f-disp-back_loose', name: 'Loose', freezerId: 'f-disp-back', icon: 'Layers' }
    );
    state.meatCuts.push(
      { id: 'mc-front-brats', productId: 'p-brats-mild', quantity: 4, containerId: 'f-disp-front_loose' },
      { id: 'mc-back-brats', productId: 'p-brats-mild', quantity: 6, containerId: 'f-disp-back_loose' }
    );
    const tiedLiteral = parseVoiceTranscript('remove 2 brats from display', state);
    expect(tiedLiteral.clauses[0].sourceLocationCandidates.map(c => c.containerId).sort()).toEqual([
      'f-disp-back_loose',
      'f-disp-front_loose',
    ]);
    expect(tiedLiteral.clauses[0].requiresSourceLocationSelection).toBe(true);
    expect(tiedLiteral.clauses[0].isValid).toBe(false);

    // 7. Non-display-named multiple Special Freezers in Automatic mode also prompt cleanly
    state.freezers = [
      { id: 'f-stand', name: 'Farm Stand', isSpecial: true },
      { id: 'f-market', name: 'Farmers Market', isSpecial: true },
    ];
    state.containers.push(
      { id: 'f-stand_loose', name: 'Loose', freezerId: 'f-stand', icon: 'Layers' }
    );
    state.meatCuts.push(
      { id: 'mc-stand-brats', productId: 'p-brats-mild', quantity: 5, containerId: 'f-stand_loose' }
    );
    const nonLiteralSpecials = parseVoiceTranscript('remove 2 brats from display', state);
    expect(nonLiteralSpecials.clauses[0].sourceLocationCandidates.map(c => c.containerId).sort()).toEqual([
      'f-market_loose',
      'f-stand_loose',
    ]);
    expect(nonLiteralSpecials.clauses[0].requiresSourceLocationSelection).toBe(true);
    expect(nonLiteralSpecials.clauses[0].isValid).toBe(false);
  });

  it('splits unpunctuated microphone dictation multi-item lists without commas cleanly while preserving compound numbers and weight units', () => {
    // Seed exact user-reported scenario products in Display Case
    state.products.push(
      { id: 'p-pork-liver', name: 'Pork Liver', primaryCategory: 'Pork', subCategory: 'Offal' },
      { id: 'p-belly-bacon', name: 'Belly Bacon', primaryCategory: 'Pork', subCategory: 'Belly' },
      { id: 'p-ribeye-16oz', name: 'Ribeye Steak 16 oz', primaryCategory: 'Beef', subCategory: 'Steaks' }
    );
    state.meatCuts.push(
      { id: 'mc-disp-hotdog', productId: 'p-hotdogs', quantity: 5, containerId: 'f-display_loose' },
      { id: 'mc-disp-liver', productId: 'p-pork-liver', quantity: 4, containerId: 'f-display_loose' },
      { id: 'mc-disp-bacon', productId: 'p-belly-bacon', quantity: 6, containerId: 'f-display_loose' },
      { id: 'mc-disp-rib16', productId: 'p-ribeye-16oz', quantity: 5, containerId: 'f-display_loose' }
    );

    // 1. Exact comma-free dictated phrase from microphone: "remove one hotdog one liver and one belly bacon from display"
    const micRemove = parseVoiceTranscript(
      'remove one hotdog one liver and one belly bacon from display',
      state
    );
    expect(micRemove.clauses).toHaveLength(3);
    expect(micRemove.clauses.every(c => c.isValid)).toBe(true);
    expect(
      micRemove.clauses.map(c => ({ qty: c.quantity, prod: c.selectedProductId, src: c.selectedSourceContainerId }))
    ).toEqual([
      { qty: 1, prod: 'p-hotdogs', src: 'f-display_loose' },
      { qty: 1, prod: 'p-pork-liver', src: 'f-display_loose' },
      { qty: 1, prod: 'p-belly-bacon', src: 'f-display_loose' },
    ]);
    expect(buildVoiceDispatchActions(micRemove.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: {
          updates: {
            'mc-disp-hotdog': 4,
            'mc-disp-liver': 3,
            'mc-disp-bacon': 5,
          },
        },
      },
    ]);

    // 2. Numeric & mixed spoken numbers without commas across remove/move/add/new-container
    const micMixedAdd = parseVoiceTranscript(
      'add 2 hotdogs one liver and a couple of belly bacon to display',
      state
    );
    expect(micMixedAdd.clauses).toHaveLength(3);
    expect(
      micMixedAdd.clauses.map(c => ({ qty: c.quantity, prod: c.selectedProductId }))
    ).toEqual([
      { qty: 2, prod: 'p-hotdogs' },
      { qty: 1, prod: 'p-pork-liver' },
      { qty: 2, prod: 'p-belly-bacon' },
    ]);

    const micNewCont = parseVoiceTranscript(
      'add container yellow bag in freezer canada with two pork liver 3 belly bacon one chicken broth',
      state
    );
    expect(micNewCont.clauses).toHaveLength(3);
    expect(
      micNewCont.clauses.map(c => ({ qty: c.quantity, prod: c.selectedProductId }))
    ).toEqual([
      { qty: 2, prod: 'p-pork-liver' },
      { qty: 3, prod: 'p-belly-bacon' },
      { qty: 1, prod: 'p-chicken-broth' },
    ]);

    // 3. Compound number words ("twenty four") and unit weights ("16 oz") stay intact
    state.meatCuts.push({
      id: 'mc-canada-rib',
      productId: 'p-ribeye',
      quantity: 30,
      containerId: 'c-orange-canada',
    });
    const compoundMove = parseVoiceTranscript(
      'move twenty four ribeye 2 hotdogs from orange in canada to display',
      state
    );
    expect(compoundMove.clauses).toHaveLength(2);
    expect(
      compoundMove.clauses.map(c => ({ qty: c.quantity, prod: c.selectedProductId }))
    ).toEqual([
      { qty: 24, prod: 'p-ribeye' },
      { qty: 2, prod: 'p-hotdogs' },
    ]);

    const withWeightUnit = parseVoiceTranscript(
      'remove 2 ribeye steak 16 oz one liver from display',
      state
    );
    expect(withWeightUnit.clauses).toHaveLength(2);
    expect(
      withWeightUnit.clauses.map(c => ({ qty: c.quantity, prod: c.selectedProductId }))
    ).toEqual([
      { qty: 2, prod: 'p-ribeye-16oz' },
      { qty: 1, prod: 'p-pork-liver' },
    ]);
  });

  it('supports "move all <item> in display loose to <dest>" and natural "Where do I have..." queries', () => {
    state.freezers.push({ id: 'f-1', name: 'Freezer 1' });
    state.containers.push(
      { id: 'f-1_loose', name: 'Loose', freezerId: 'f-1', icon: 'Layers' },
      { id: 'c-disp-bin', name: 'Display Bin', freezerId: 'f-display', icon: 'Box' },
      { id: 'c-box-dogs-4', name: 'Box Dogs 4', freezerId: 'f-1', icon: 'Box' },
      { id: 'c-dogs-5', name: 'Dogs 5', freezerId: 'f-1', icon: 'Box' }
    );
    state.meatCuts.push({
      id: 'mc-disp-loose-hotdogs',
      productId: 'p-hotdogs',
      quantity: 9,
      containerId: 'f-display_loose',
    });

    // 1. User-reported phrase: "move all hotdogs in display loose to box dogs 4"
    const moveDisplayLoose = parseVoiceTranscript(
      'move all hotdogs in display loose to box dogs 4',
      state
    );
    expect(moveDisplayLoose.clauses).toHaveLength(1);
    const mvClause = moveDisplayLoose.clauses[0];
    expect(mvClause.intent).toBe('move');
    expect(mvClause.isAllQuantity).toBe(true);
    expect(mvClause.quantity).toBe(9);
    expect(mvClause.selectedProductId).toBe('p-hotdogs');
    expect(mvClause.selectedSourceContainerId).toBe('f-display_loose');
    expect(mvClause.selectedDestContainerId).toBe('c-box-dogs-4');
    expect(mvClause.isValid).toBe(true);
    expect(buildVoiceDispatchActions(moveDisplayLoose.clauses, state)).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-disp-loose-hotdogs',
          productId: 'p-hotdogs',
          quantity: 9,
          sourceContainerId: 'f-display_loose',
          newContainerId: 'c-box-dogs-4',
        },
      },
    ]);

    // Also handles spoken number word + optional container noun prefix ("box dogs five" -> "Dogs 5")
    const movePrefixFallback = parseVoiceTranscript(
      'move 3 hotdogs in display loose to box dogs five',
      state
    );
    expect(movePrefixFallback.clauses[0].intent).toBe('move');
    expect(movePrefixFallback.clauses[0].quantity).toBe(3);
    expect(movePrefixFallback.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(movePrefixFallback.clauses[0].selectedDestContainerId).toBe('c-dogs-5');
    expect(movePrefixFallback.clauses[0].isValid).toBe(true);

    // Also handles multi-level "in <container> in <freezer>" as move source:
    const moveInContInFreezer = parseVoiceTranscript(
      'move all hotdogs in orange in canada to box dogs 4',
      state
    );
    expect(moveInContInFreezer.clauses[0].intent).toBe('move');
    expect(moveInContInFreezer.clauses[0].quantity).toBe(12);
    expect(moveInContInFreezer.clauses[0].selectedSourceContainerId).toBe('c-orange-canada');
    expect(moveInContInFreezer.clauses[0].selectedDestContainerId).toBe('c-box-dogs-4');
    expect(moveInContInFreezer.clauses[0].isValid).toBe(true);

    // Also handles "move all of the hotdogs in display loose to box dogs 4" without misrouting as move_all
    const moveAllOfItem = parseVoiceTranscript(
      'move all of the hotdogs in display loose to box dogs 4',
      state
    );
    expect(moveAllOfItem.clauses[0].intent).toBe('move');
    expect(moveAllOfItem.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(moveAllOfItem.clauses[0].selectedDestContainerId).toBe('c-box-dogs-4');
    expect(moveAllOfItem.clauses[0].isValid).toBe(true);

    // 2. User-reported natural query: "Where do I have..."
    const whereDoIHaveHotdogs = parseVoiceTranscript('Where do I have hotdogs?', state);
    expect(whereDoIHaveHotdogs.clauses).toHaveLength(1);
    expect(whereDoIHaveHotdogs.clauses[0].intent).toBe('query');
    expect(whereDoIHaveHotdogs.clauses[0].isValid).toBe(true);
    expect(whereDoIHaveHotdogs.clauses[0].queryResults?.[0].product.id).toBe('p-hotdogs');
    expect(whereDoIHaveHotdogs.clauses[0].queryResults?.[0].totalQuantity).toBe(30); // 12 Canada + 9 Chest + 9 Display Loose
    expect(whereDoIHaveHotdogs.clauses[0].queryResults?.[0].locations).toHaveLength(3);
    expect(buildVoiceDispatchActions(whereDoIHaveHotdogs.clauses, state)).toEqual([]);

    // Works for container lookups ("Where do I have box dogs 4?"), location-scoped queries, & variants
    const whereContainer = parseVoiceTranscript('Where do I have box dogs 4?', state);
    expect(whereContainer.clauses[0].intent).toBe('container_query');
    expect(whereContainer.clauses[0].containerQueryMode).toBe('location');
    expect(whereContainer.clauses[0].containerQueryResults?.[0]).toMatchObject({
      containerId: 'c-box-dogs-4',
      freezerName: 'Freezer 1',
    });

    const whereInFreezer = parseVoiceTranscript('where in display do I have hotdogs', state);
    expect(whereInFreezer.clauses[0].intent).toBe('query');
    expect(whereInFreezer.clauses[0].queryResults?.[0].totalQuantity).toBe(9);

    const whereKeep = parseVoiceTranscript('where do we keep belly fresh in canada', state);
    expect(whereKeep.clauses[0].intent).toBe('query');
    expect(whereKeep.clauses[0].queryResults?.[0].product.id).toBe('p-belly-fresh');
    expect(whereKeep.clauses[0].queryResults?.[0].totalQuantity).toBe(6);

    // Chained with an action via "and"
    const chainedWhere = parseVoiceTranscript(
      'remove 2 brats from display and where do I have hotdogs',
      state
    );
    expect(chainedWhere.clauses).toHaveLength(2);
    expect(chainedWhere.clauses[0].intent).toBe('remove');
    expect(chainedWhere.clauses[1].intent).toBe('query');
    expect(chainedWhere.clauses[1].isValid).toBe(true);
  });

  it('supports bulk and direct inventory change commands (adjust/reduce/increase/change/set/update/reconcile to or by qty, zero targets, and multi-item lists)', () => {
    state.freezers.push({ id: 'f-1', name: 'Freezer 1' });
    state.containers.push({ id: 'c-box-green', name: 'Box Green', freezerId: 'f-1', icon: 'Box' });
    state.meatCuts.push({
      id: 'mc-green-hotdogs',
      productId: 'p-hotdogs',
      quantity: 10,
      containerId: 'c-box-green',
    });

    // 1. "Adjust quantity of brats in display to two." -> sets directly to 2
    const adjustBrats = parseVoiceTranscript('Adjust quantity of brats in display to two.', state);
    expect(adjustBrats.clauses).toHaveLength(1);
    expect(adjustBrats.clauses[0].intent).toBe('set_quantity');
    expect(adjustBrats.clauses[0].quantity).toBe(2);
    expect(adjustBrats.clauses[0].selectedProductId).toBe('p-brats-mild');
    expect(adjustBrats.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(adjustBrats.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(adjustBrats.clauses, state)).toEqual([
      { type: 'BATCH_UPDATE_MEAT_QUANTITY', payload: { updates: { 'mc-disp-brats': 2 } } },
    ]);

    // 2. "Reduce inventory of hot dogs in box green to three." -> sets directly to 3
    const reduceTo = parseVoiceTranscript(
      'Reduce inventory of hot dogs in box green to three.',
      state
    );
    expect(reduceTo.clauses).toHaveLength(1);
    expect(reduceTo.clauses[0].intent).toBe('set_quantity');
    expect(reduceTo.clauses[0].quantity).toBe(3);
    expect(reduceTo.clauses[0].selectedProductId).toBe('p-hotdogs');
    expect(reduceTo.clauses[0].selectedSourceContainerId).toBe('c-box-green');
    expect(reduceTo.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(reduceTo.clauses, state)).toEqual([
      { type: 'BATCH_UPDATE_MEAT_QUANTITY', payload: { updates: { 'mc-green-hotdogs': 3 } } },
    ]);

    // 3. Relative delta "Reduce inventory ... by three" and "Increase stock ... by 4"
    const reduceBy = parseVoiceTranscript(
      'Reduce inventory of hot dogs in box green by three.',
      state
    );
    expect(reduceBy.clauses[0].intent).toBe('remove');
    expect(reduceBy.clauses[0].quantity).toBe(3);
    expect(reduceBy.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(reduceBy.clauses, state)).toEqual([
      { type: 'BATCH_UPDATE_MEAT_QUANTITY', payload: { updates: { 'mc-green-hotdogs': 7 } } },
    ]);

    const increaseBy = parseVoiceTranscript('increase stock of brats in display by 4', state);
    expect(increaseBy.clauses[0].intent).toBe('add');
    expect(increaseBy.clauses[0].quantity).toBe(4);
    expect(increaseBy.clauses[0].selectedDestContainerId).toBe('f-display_loose');
    expect(increaseBy.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(increaseBy.clauses, state)).toEqual([
      {
        type: 'ADD_MEAT_CUT',
        payload: { productId: 'p-brats-mild', quantity: 4, containerId: 'f-display_loose' },
      },
    ]);

    // 4. Setting target to zero / 0 and trailing location variants
    const setZero = parseVoiceTranscript('set ground pork to zero in display', state);
    expect(setZero.clauses[0].intent).toBe('set_quantity');
    expect(setZero.clauses[0].quantity).toBe(0);
    expect(setZero.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(setZero.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(setZero.clauses, state)).toEqual([
      { type: 'BATCH_UPDATE_MEAT_QUANTITY', payload: { updates: { 'mc-disp-ground': 0 } } },
    ]);

    const equalsForm = parseVoiceTranscript('reconcile brats = 5 in display', state);
    expect(equalsForm.clauses[0].intent).toBe('set_quantity');
    expect(equalsForm.clauses[0].quantity).toBe(5);
    expect(equalsForm.clauses[0].isValid).toBe(true);

    // 5. Bulk multi-item inline, shared-location, multi-location, and multi-line lists
    const bulkSameLoc = parseVoiceTranscript(
      'adjust inventory of brats to 2 and ground pork to 0 in display',
      state
    );
    expect(bulkSameLoc.clauses).toHaveLength(2);
    expect(bulkSameLoc.clauses.every(c => c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(bulkSameLoc.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: { updates: { 'mc-disp-brats': 2, 'mc-disp-ground': 0 } },
      },
    ]);

    const bulkMultiLoc = parseVoiceTranscript(
      'reduce inventory of hot dogs in box green to 3, brats in display to 2',
      state
    );
    expect(bulkMultiLoc.clauses).toHaveLength(2);
    expect(bulkMultiLoc.clauses.every(c => c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(bulkMultiLoc.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: { updates: { 'mc-green-hotdogs': 3, 'mc-disp-brats': 2 } },
      },
    ]);

    const bulkColonShorthand = parseVoiceTranscript(
      'change inventory in display: 2 brats, 0 ground pork',
      state
    );
    expect(bulkColonShorthand.clauses).toHaveLength(2);
    expect(bulkColonShorthand.clauses.every(c => c.intent === 'set_quantity' && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(bulkColonShorthand.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: { updates: { 'mc-disp-brats': 2, 'mc-disp-ground': 0 } },
      },
    ]);

    const bulkMultiLine = parseVoiceTranscript(
      'Adjust inventory in display:\n- brats to 2\n- ground pork to zero',
      state
    );
    expect(bulkMultiLine.clauses).toHaveLength(2);
    expect(bulkMultiLine.clauses.every(c => c.intent === 'set_quantity' && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(bulkMultiLine.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: { updates: { 'mc-disp-brats': 2, 'mc-disp-ground': 0 } },
      },
    ]);

    // 6. Bare "change inventory", missing target qty stepper resolution, no-op check, and directional warning
    const bareChange = parseVoiceTranscript('change inventory', state);
    expect(bareChange.clauses).toHaveLength(1);
    expect(bareChange.clauses[0].intent).toBe('set_quantity');
    expect(bareChange.clauses[0].isValid).toBe(false);
    expect(bareChange.clauses[0].errorMessage).toContain('adjust quantity of brats in display to 2');

    const missingQty = parseVoiceTranscript('adjust quantity of brats in display', state);
    expect(missingQty.clauses[0].intent).toBe('set_quantity');
    expect(missingQty.clauses[0].missingTargetQuantity).toBe(true);
    expect(missingQty.clauses[0].quantity).toBe(8);
    expect(missingQty.clauses[0].isValid).toBe(false);

    const missingQtyResolved = parseVoiceTranscript('adjust quantity of brats in display', state, {
      'clause-0-0': { quantity: 4 },
    });
    expect(missingQtyResolved.clauses[0].missingTargetQuantity).toBe(false);
    expect(missingQtyResolved.clauses[0].quantity).toBe(4);
    expect(missingQtyResolved.clauses[0].isValid).toBe(true);

    const sameQtyNoop = parseVoiceTranscript('adjust quantity of brats in display to 8', state);
    expect(sameQtyNoop.clauses[0].isValid).toBe(false);
    expect(sameQtyNoop.clauses[0].errorMessage).toContain('already 8');

    const reduceAboveCurrent = parseVoiceTranscript(
      'reduce inventory of brats in display to 12',
      state
    );
    expect(reduceAboveCurrent.clauses[0].isValid).toBe(true);
    expect(reduceAboveCurrent.clauses[0].warningMessage).toContain('already below 12');
  });

  it('supports custom list mutations, thresholds, alert toggles, and list queries', () => {
    state.customLists = [
      {
        id: 'list-restock',
        name: 'Restock List',
        description: '',
        allowNotes: true,
        isInventoryControlled: true,
        items: [
          {
            productId: 'p-brats-mild',
            addedAt: new Date(1000).toISOString(),
            threshold: 3,
            notifyEnabled: true,
          },
        ],
      },
      {
        id: 'list-pack',
        name: 'Need to Pack',
        description: '',
        allowNotes: true,
        isInventoryControlled: false,
        items: [],
      },
    ];

    // 1. Add multiple items to a custom list with optional threshold
    const addMulti = parseVoiceTranscript(
      'add ribeye and chicken broth to restock list with threshold 4',
      state
    );
    expect(addMulti.clauses).toHaveLength(2);
    expect(addMulti.clauses.every(c => c.intent === 'manage_list' && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(addMulti.clauses, state)).toEqual([
      {
        type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST',
        payload: {
          updates: [
            { listId: 'list-restock', productId: 'p-ribeye', forceState: true, threshold: 4 },
            { listId: 'list-restock', productId: 'p-chicken-broth', forceState: true, threshold: 4 },
          ],
        },
      },
    ]);

    // 2. Remove item from list (plus warning if not currently on list)
    const removeOnList = parseVoiceTranscript('remove brats from restock list', state);
    expect(removeOnList.clauses[0].intent).toBe('manage_list');
    expect(removeOnList.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(removeOnList.clauses, state)).toEqual([
      {
        type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST',
        payload: {
          updates: [{ listId: 'list-restock', productId: 'p-brats-mild', forceState: false }],
        },
      },
    ]);

    const removeNotOnList = parseVoiceTranscript('remove ribeye from restock list', state);
    expect(removeNotOnList.clauses[0].warningMessage).toContain('not currently on');

    // 3. Set threshold on existing item vs item not yet on list
    const updateExistingThresh = parseVoiceTranscript(
      'set restock list threshold for brats to 5',
      state
    );
    expect(updateExistingThresh.clauses[0].intent).toBe('manage_list');
    expect(updateExistingThresh.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(updateExistingThresh.clauses, state)).toEqual([
      {
        type: 'UPDATE_LIST_ITEM_THRESHOLD',
        payload: { listId: 'list-restock', productId: 'p-brats-mild', threshold: 5 },
      },
    ]);

    const addMissingThresh = parseVoiceTranscript(
      'alert me when ribeye drops below 2 on restock list',
      state
    );
    expect(addMissingThresh.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(addMissingThresh.clauses, state)).toEqual([
      {
        type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST',
        payload: {
          updates: [{ listId: 'list-restock', productId: 'p-ribeye', forceState: true, threshold: 2 }],
        },
      },
    ]);

    // 4. Enable / disable notifications
    const muteAlert = parseVoiceTranscript('turn off alerts for brats on restock list', state);
    expect(muteAlert.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(muteAlert.clauses, state)).toEqual([
      {
        type: 'TOGGLE_LIST_ITEM_NOTIFICATION',
        payload: { listId: 'list-restock', productId: 'p-brats-mild', notifyEnabled: false },
      },
    ]);

    // 5. Read-only list queries
    const readList = parseVoiceTranscript("what's on my restock list?", state);
    expect(readList.hasQueries).toBe(true);
    expect(readList.hasMutations).toBe(false);
    expect(readList.clauses[0].intent).toBe('list_query');
    expect(readList.clauses[0].listQueryResults?.[0].items).toHaveLength(1);
    expect(readList.clauses[0].listQueryResults?.[0].items[0].product.id).toBe('p-brats-mild');

    const checkMember = parseVoiceTranscript('is ribeye on the restock list?', state);
    expect(checkMember.clauses[0].intent).toBe('list_query');
    expect(checkMember.clauses[0].listQueryResults?.[0].isProductOnList).toBe(false);

    const listAll = parseVoiceTranscript('list custom lists', state);
    expect(listAll.clauses[0].intent).toBe('list_query');
    expect(listAll.clauses[0].listQueryResults).toHaveLength(2);
  });

  it('supports guided display restock from backstock and out-of-stock / low-stock alert queries', () => {
    // 1. Guided pull from backstock to Display (Beef Hot Dogs: 0 in Display, 12 in Orange Canada, 9 in Orange Chest)
    const restockHotdogs = parseVoiceTranscript('restock display with 15 hotdogs', state);
    expect(restockHotdogs.clauses).toHaveLength(1);
    const rc = restockHotdogs.clauses[0];
    expect(rc.intent).toBe('restock_display');
    expect(rc.selectedDestContainerId).toBe('f-display_loose');
    expect(rc.isValid).toBe(true);
    expect(rc.restockAllocations).toHaveLength(2);
    expect(buildVoiceDispatchActions(restockHotdogs.clauses, state)).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-hotdogs',
          productId: 'p-hotdogs',
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'f-display_loose',
          quantity: 12,
        },
      },
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-chest-hotdogs',
          productId: 'p-hotdogs',
          sourceContainerId: 'c-orange-chest',
          newContainerId: 'f-display_loose',
          quantity: 3,
        },
      },
    ]);

    // 2. Pull phrasing ("pull 3 pork belly from backstock to display") only pulls from non-display backstock
    const pullBelly = parseVoiceTranscript('pull 3 pork belly fresh from backstock to display', state);
    expect(pullBelly.clauses[0].intent).toBe('restock_display');
    expect(pullBelly.clauses[0].isValid).toBe(true);
    expect(pullBelly.clauses[0].restockAllocations?.map(a => a.container.id)).toEqual([
      'c-orange-canada',
    ]);

    // 3. Insufficient backstock gives explicit validation error
    const tooMuch = parseVoiceTranscript('restock display with 25 hotdogs', state);
    expect(tooMuch.clauses[0].isValid).toBe(false);
    expect(tooMuch.clauses[0].errorMessage).toContain('Only 21 pack(s)');

    // 4. Display gaps & low-stock queries (must exclude offSiteEntries)
    const needsRestock = parseVoiceTranscript('what needs restocking?', state);
    expect(needsRestock.hasQueries).toBe(true);
    expect(needsRestock.clauses[0].intent).toBe('inventory_alert_query');
    const restockProdIds = needsRestock.clauses[0].alertQueryResults?.map(r => r.product.id) || [];
    expect(restockProdIds).toContain('p-hotdogs');
    expect(restockProdIds).toContain('p-brats-hot');
    expect(restockProdIds).not.toContain('p-brats-mild');

    const underLimit = parseVoiceTranscript("what's under 5 in display?", state);
    expect(underLimit.clauses[0].intent).toBe('inventory_alert_query');
    const underIds = underLimit.clauses[0].alertQueryResults?.map(r => r.product.id) || [];
    expect(underIds).toContain('p-hotdogs'); // 0 in display, 21 backstock

    const globalOos = parseVoiceTranscript('what are we completely out of?', state);
    expect(globalOos.clauses[0].intent).toBe('inventory_alert_query');
    expect(globalOos.clauses[0].alertQueryResults?.map(r => r.product.id)).toContain('p-ribeye');
  });

  it('supports category, tag, empty-container, and staging-area queries', () => {
    state.meatCuts[1].tagIds = ['t-vac']; // mc-disp-belly tagged Vacuum Sealed

    // Category stock total
    const porkTotal = parseVoiceTranscript('how much pork do I have?', state);
    expect(porkTotal.hasQueries).toBe(true);
    expect(porkTotal.clauses[0].intent).toBe('query');
    expect(porkTotal.clauses[0].categoryQueryResults?.[0].categoryName).toBe('Pork');
    // 8 brats-mild + 7 brats-hot + 5 belly-fresh(disp) + 6 belly-fresh(canada) + 10 ground pork = 36 (excludes 100 off-site!)
    expect(porkTotal.clauses[0].categoryQueryResults?.[0].totalQuantity).toBe(36);

    // Tag query
    const tagged = parseVoiceTranscript("what's tagged as vacuum sealed?", state);
    expect(tagged.hasQueries).toBe(true);
    expect(tagged.clauses[0].intent).toBe('query');
    expect(tagged.clauses[0].tagQueryResults?.[0].tag.id).toBe('t-vac');
    expect(tagged.clauses[0].tagQueryResults?.[0].totalQuantity).toBe(5);
    expect(tagged.clauses[0].tagQueryResults?.[0].items[0].meatCut.id).toBe('mc-disp-belly');

    // Empty containers query
    const emptyConts = parseVoiceTranscript('which containers are empty?', state);
    expect(emptyConts.clauses[0].intent).toBe('container_query');
    expect(emptyConts.clauses[0].containerQueryMode).toBe('empty');
    expect(emptyConts.clauses[0].containerQueryResults?.map(r => r.containerId)).toEqual([
      'c-blue-canada',
    ]);

    // Staging area query
    state.containers.push({ id: 'c-staged', name: 'Staged Cooler', freezerId: undefined, icon: 'Box' });
    const stagingQuery = parseVoiceTranscript("what's in staging?", state);
    expect(stagingQuery.clauses[0].intent).toBe('container_query');
    expect(stagingQuery.clauses[0].containerQueryMode).toBe('staging');
    expect(stagingQuery.clauses[0].containerQueryResults?.map(r => r.containerId)).toContain('c-staged');
  });

  it('supports container lifecycle commands (swap, rename, archive, delete, stage) and except exclusions', () => {
    // 1. Empty except exclusion
    const emptyExcept = parseVoiceTranscript(
      'empty container orange in canada except beef hot dogs',
      state
    );
    expect(emptyExcept.clauses[0].intent).toBe('empty_container');
    expect(emptyExcept.clauses[0].isValid).toBe(true);
    expect(emptyExcept.clauses[0].containerCutPreviews?.map(p => p.product.id)).toEqual([
      'p-belly-fresh',
    ]);
    expect(buildVoiceDispatchActions(emptyExcept.clauses, state)).toEqual([
      {
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: 'mc-canada-belly',
          productId: 'p-belly-fresh',
          sourceContainerId: 'c-orange-canada',
          newContainerId: 'staging_loose',
          quantity: 6,
        },
      },
    ]);

    // 2. Move all excluding product
    const moveAllExcept = parseVoiceTranscript(
      'move all of container orange in canada to blue tote excluding pork belly fresh',
      state
    );
    expect(moveAllExcept.clauses[0].intent).toBe('move_all');
    expect(moveAllExcept.clauses[0].isValid).toBe(true);
    expect(moveAllExcept.clauses[0].containerCutPreviews?.map(p => p.product.id)).toEqual([
      'p-hotdogs',
    ]);

    // 3. Swap two containers
    const swap = parseVoiceTranscript(
      'swap orange in canada and orange in chest freezer',
      state
    );
    expect(swap.clauses[0].intent).toBe('swap_containers');
    expect(swap.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(swap.clauses, state)).toEqual([
      {
        type: 'MOVE_CONTAINER',
        payload: { containerId: 'c-orange-canada', newFreezerId: 'f-chest' },
      },
      {
        type: 'MOVE_CONTAINER',
        payload: { containerId: 'c-orange-chest', newFreezerId: 'f-canada' },
      },
    ]);

    // 4. Rename container
    const rename = parseVoiceTranscript('rename blue tote to snack tote', state);
    expect(rename.clauses[0].intent).toBe('rename_container');
    expect(rename.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(rename.clauses, state)).toEqual([
      {
        type: 'EDIT_CONTAINER',
        payload: { containerId: 'c-blue-canada', updates: { name: 'snack tote' } },
      },
    ]);

    // 5. Archive & Restore container (with contents warning)
    const archiveCont = parseVoiceTranscript('archive orange in canada', state);
    expect(archiveCont.clauses[0].intent).toBe('archive_container');
    expect(archiveCont.clauses[0].isValid).toBe(true);
    expect(archiveCont.clauses[0].warningMessage).toContain('Sorting Table');
    expect(buildVoiceDispatchActions(archiveCont.clauses, state)).toEqual([
      {
        type: 'TOGGLE_CONTAINER_ARCHIVED',
        payload: { containerId: 'c-orange-canada', isArchived: true },
      },
    ]);

    state.containers.push({
      id: 'c-old-archived',
      name: 'Old Bin',
      freezerId: 'f-canada',
      icon: 'Box',
      isArchived: true,
    });
    const restoreCont = parseVoiceTranscript('restore old bin', state);
    expect(restoreCont.clauses[0].intent).toBe('archive_container');
    expect(restoreCont.clauses[0].archiveState).toBe(false);
    expect(restoreCont.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(restoreCont.clauses, state)).toEqual([
      {
        type: 'TOGGLE_CONTAINER_ARCHIVED',
        payload: { containerId: 'c-old-archived', isArchived: false },
      },
    ]);

    // 6. Delete container
    const deleteCont = parseVoiceTranscript('delete container blue tote', state);
    expect(deleteCont.clauses[0].intent).toBe('delete_container');
    expect(deleteCont.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(deleteCont.clauses, state)).toEqual([
      { type: 'DELETE_CONTAINER', payload: { containerId: 'c-blue-canada' } },
    ]);

    // 7. Unplace / stage container
    const stageCont = parseVoiceTranscript('stage blue tote', state);
    expect(stageCont.clauses[0].intent).toBe('move_container');
    expect(stageCont.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(stageCont.clauses, state)).toEqual([
      {
        type: 'MOVE_CONTAINER',
        payload: { containerId: 'c-blue-canada', newFreezerId: undefined },
      },
    ]);
  });

  it('supports item tag toggles (idempotent), wrong-label correction, and quick undo', () => {
    // 1. Add tag to untagged stack -> emits TOGGLE_MEAT_TAG
    const addTag = parseVoiceTranscript('tag pork belly in display as vacuum sealed', state);
    expect(addTag.clauses[0].intent).toBe('manage_tag');
    expect(addTag.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(addTag.clauses, state)).toEqual([
      {
        type: 'TOGGLE_MEAT_TAG',
        payload: { meatCutId: 'mc-disp-belly', tagId: 't-vac' },
      },
    ]);

    // Idempotency: adding an already-present tag warns and does NOT flip it off
    state.meatCuts[1].tagIds = ['t-vac'];
    const addTagAgain = parseVoiceTranscript('tag pork belly in display as vacuum sealed', state);
    expect(addTagAgain.clauses[0].warningMessage).toContain('already has');
    expect(buildVoiceDispatchActions(addTagAgain.clauses, state)).toEqual([]);

    // Removing an existing tag -> emits TOGGLE_MEAT_TAG
    const removeTag = parseVoiceTranscript('untag pork belly in display from vacuum sealed', state);
    expect(removeTag.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(removeTag.clauses, state)).toEqual([
      {
        type: 'TOGGLE_MEAT_TAG',
        payload: { meatCutId: 'mc-disp-belly', tagId: 't-vac' },
      },
    ]);

    // 2. Correct wrong label directly vs prompt picker
    const relabelDirect = parseVoiceTranscript(
      'correct label on ground pork in display to chicken broth',
      state
    );
    expect(relabelDirect.clauses[0].intent).toBe('correct_label');
    expect(relabelDirect.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(relabelDirect.clauses, state)).toEqual([
      {
        type: 'CORRECT_MEAT_LABEL',
        payload: { meatCutId: 'mc-disp-ground', correctProductId: 'p-chicken-broth' },
      },
    ]);

    const flagWrongLabel = parseVoiceTranscript('mark ground pork in display as wrong label', state);
    expect(flagWrongLabel.clauses[0].intent).toBe('correct_label');
    expect(flagWrongLabel.clauses[0].requiresReplacementProductSelection).toBe(true);
    expect(flagWrongLabel.clauses[0].isValid).toBe(false);

    const flagResolved = parseVoiceTranscript('mark ground pork in display as wrong label', state, {
      'clause-0-0': { replacementProductId: 'p-ribeye' },
    });
    expect(flagResolved.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(flagResolved.clauses, state)).toEqual([
      {
        type: 'CORRECT_MEAT_LABEL',
        payload: { meatCutId: 'mc-disp-ground', correctProductId: 'p-ribeye' },
      },
    ]);

    // 3. Quick Undo
    const emptyUndo = parseVoiceTranscript('undo last command', state);
    expect(emptyUndo.clauses[0].intent).toBe('undo_last');
    expect(emptyUndo.clauses[0].isValid).toBe(false);
    expect(emptyUndo.clauses[0].errorMessage).toContain('No recent history');

    state.history = [
      {
        id: 'h-1',
        timestamp: new Date().toISOString(),
        description: 'Removed 2x Bratwurst Mild',
        targetId: 'mc-disp-brats',
      },
    ];
    const readyUndo = parseVoiceTranscript('undo last command', state);
    expect(readyUndo.clauses[0].intent).toBe('undo_last');
    expect(readyUndo.clauses[0].isValid).toBe(true);
    expect(readyUndo.clauses[0].undoTargetDescription).toBe('Removed 2x Bratwurst Mild');
    expect(buildVoiceDispatchActions(readyUndo.clauses, state)).toEqual([{ type: 'UNDO' }]);
  });

  it('handles "Empty Broths from display" category & item removal without breaking empty_container', () => {
    // 1. Single stocked product under "Broth" subcategory in Display
    const emptyBroths = parseVoiceTranscript('Empty Broths from display', state);
    expect(emptyBroths.clauses).toHaveLength(1);
    expect(emptyBroths.clauses[0].intent).toBe('remove');
    expect(emptyBroths.clauses[0].isAllQuantity).toBe(true);
    expect(emptyBroths.clauses[0].selectedProductId).toBe('p-chicken-broth');
    expect(emptyBroths.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(emptyBroths.clauses[0].quantity).toBe(4);
    expect(emptyBroths.clauses[0].isValid).toBe(true);
    expect(buildVoiceDispatchActions(emptyBroths.clauses, state)).toEqual([
      { type: 'BATCH_UPDATE_MEAT_QUANTITY', payload: { updates: { 'mc-disp-broth': 0 } } },
    ]);

    // 2. Multiple stocked products under "Broth" subcategory in Display
    state.products.push({
      id: 'p-beef-broth',
      name: 'Beef Broth',
      primaryCategory: 'Beef',
      subCategory: 'Broth',
    });
    state.meatCuts.push(
      { id: 'mc-disp-beef-broth', productId: 'p-beef-broth', quantity: 2, containerId: 'f-display_loose' },
      // Bone Broth in chest freezer must NOT be touched because location is "display"
      { id: 'mc-chest-beef-broth', productId: 'p-beef-broth', quantity: 5, containerId: 'f-chest_loose' }
    );
    const multiBroths = parseVoiceTranscript('Empty Broths from display', state);
    expect(multiBroths.clauses).toHaveLength(2);
    expect(multiBroths.clauses.every(c => c.intent === 'remove' && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(multiBroths.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: {
          updates: {
            'mc-disp-broth': 0,
            'mc-disp-beef-broth': 0,
          },
        },
      },
    ]);

    // 3. Variants ("clear chicken broth out of display", "wipe out ground pork in display")
    const clearChicken = parseVoiceTranscript('clear chicken broth out of display', state);
    expect(clearChicken.clauses[0].intent).toBe('remove');
    expect(clearChicken.clauses[0].selectedProductId).toBe('p-chicken-broth');
    expect(clearChicken.clauses[0].quantity).toBe(4);
    expect(clearChicken.clauses[0].isValid).toBe(true);

    const wipeGround = parseVoiceTranscript('wipe out ground pork in display', state);
    expect(wipeGround.clauses[0].intent).toBe('remove');
    expect(wipeGround.clauses[0].selectedProductId).toBe('p-ground-pork');
    expect(wipeGround.clauses[0].quantity).toBe(10);
    expect(wipeGround.clauses[0].isValid).toBe(true);

    // 4. Regression guard: container emptiness stays empty_container
    const emptyContainer = parseVoiceTranscript('empty orange in canada', state);
    expect(emptyContainer.clauses[0].intent).toBe('empty_container');
    expect(emptyContainer.clauses[0].isValid).toBe(true);
  });

  it('handles "What do I need to restock? Check a list" and "What\'s low stock in display?"', () => {
    state.customLists = [
      {
        id: 'list-restock',
        name: 'Restock List',
        description: 'Restock checklist',
        allowNotes: true,
        isInventoryControlled: true,
        items: [
          { productId: 'p-brats-mild', threshold: 4 }, // qty 8 (OK)
          { productId: 'p-chicken-broth', threshold: 5 }, // qty 4 (below min -> sorted first!)
        ],
      },
    ];

    // 1. Compound prompt: "What do I need to restock? Check a list"
    const restockAndList = parseVoiceTranscript('What do I need to restock? Check a list', state);
    expect(restockAndList.hasQueries).toBe(true);
    expect(restockAndList.hasMutations).toBe(false);
    expect(restockAndList.clauses).toHaveLength(2);

    const alertClause = restockAndList.clauses[0];
    expect(alertClause.intent).toBe('inventory_alert_query');
    expect(alertClause.alertQueryMode).toBe('needs_restock');
    expect(alertClause.isValid).toBe(true);
    expect(alertClause.alertQueryResults?.map(r => r.product.id)).toContain('p-hotdogs');

    const listClause = restockAndList.clauses[1];
    expect(listClause.intent).toBe('list_query');
    expect(listClause.isValid).toBe(true);
    expect(listClause.listQueryResults).toHaveLength(1);
    expect(listClause.listQueryResults?.[0].items.map(i => i.product.id)).toEqual([
      'p-chicken-broth',
      'p-brats-mild',
    ]);

    // 2. "What's low stock in display?" including a low-stock Display item with 0 backstock (Mac & Cheese = 3 in display, 0 backstock)
    const lowStockDisplay = parseVoiceTranscript("What's low stock in display?", state);
    expect(lowStockDisplay.hasQueries).toBe(true);
    expect(lowStockDisplay.clauses).toHaveLength(1);
    expect(lowStockDisplay.clauses[0].intent).toBe('inventory_alert_query');
    expect(lowStockDisplay.clauses[0].alertQueryMode).toBe('display_low_stock');
    expect(lowStockDisplay.clauses[0].isValid).toBe(true);
    const lowDisplayIds = lowStockDisplay.clauses[0].alertQueryResults?.map(r => r.product.id) || [];
    expect(lowDisplayIds).toContain('p-mac-cheese');
    expect(lowDisplayIds).toContain('p-hotdogs'); // 0 in display, 21 in backstock
    expect(lowDisplayIds).not.toContain('p-ground-pork'); // 10 in display (> 3)

    // 3. Natural phrasing alternatives for alerts & lists
    for (const q of [
      'is anything low in display?',
      'show low stock in display',
      'low stock in display',
      'what are we running low on in display?',
      'what items are fewer than 4 in display?',
    ]) {
      const res = parseVoiceTranscript(q, state);
      expect(res.clauses[0].intent).toBe('inventory_alert_query');
      expect(res.clauses[0].alertQueryMode).toBe('display_low_stock');
      expect(res.clauses[0].isValid).toBe(true);
    }

    const globalLow = parseVoiceTranscript('what are we running low on?', state);
    expect(globalLow.clauses[0].intent).toBe('inventory_alert_query');
    expect(globalLow.clauses[0].alertQueryMode).toBe('global_low_stock');

    const checkListDoesHave = parseVoiceTranscript('does the restock list have ribeye?', state);
    expect(checkListDoesHave.clauses[0].intent).toBe('list_query');
    expect(checkListDoesHave.clauses[0].listQueryResults?.[0].isProductOnList).toBe(false);

    const checkWhatLists = parseVoiceTranscript('what lists do we have?', state);
    expect(checkWhatLists.clauses[0].intent).toBe('list_query');
    expect(checkWhatLists.clauses[0].listQueryResults).toHaveLength(1);
  });

  it('supports expanded natural phrasing variations across all voice intents without touching off-site', () => {
    state.history = [
      { id: 'h-1', timestamp: new Date().toISOString(), description: 'Last edit', targetId: 'mc-disp-brats' },
    ];
    state.customLists = [
      {
        id: 'list-restock',
        name: 'Restock List',
        description: 'Restock checklist',
        allowNotes: true,
        isInventoryControlled: true,
        items: [{ productId: 'p-brats-mild', threshold: 3 }],
      },
    ];

    // Polite conversational openers + natural removals
    const grabbedClean = parseVoiceTranscript('hey could you please grab two brats from display', state);
    expect(grabbedClean.clauses[0].intent).toBe('remove');
    expect(grabbedClean.clauses[0].quantity).toBe(2);
    expect(grabbedClean.clauses[0].selectedProductId).toBe('p-brats-mild');
    expect(grabbedClean.clauses[0].isValid).toBe(true);

    const soldOut = parseVoiceTranscript('sold out of chicken broth in display', state);
    expect(soldOut.clauses[0].intent).toBe('remove');
    expect(soldOut.clauses[0].isAllQuantity).toBe(true);
    expect(soldOut.clauses[0].quantity).toBe(4);
    expect(soldOut.clauses[0].isValid).toBe(true);

    const finishedBrats = parseVoiceTranscript('finished the brats in display', state);
    expect(finishedBrats.clauses[0].intent).toBe('remove');
    expect(finishedBrats.clauses[0].isAllQuantity).toBe(true);
    expect(finishedBrats.clauses[0].quantity).toBe(8);

    // Move synonyms ("bring", "grab ... from ... to ...")
    const bringMove = parseVoiceTranscript('bring 4 hotdogs out of orange in canada to display', state);
    expect(bringMove.clauses[0].intent).toBe('move');
    expect(bringMove.clauses[0].selectedSourceContainerId).toBe('c-orange-canada');
    expect(bringMove.clauses[0].selectedDestContainerId).toBe('f-display_loose');
    expect(bringMove.clauses[0].quantity).toBe(4);
    expect(bringMove.clauses[0].isValid).toBe(true);

    const takeMove = parseVoiceTranscript('grab 4 hotdogs from orange in canada to display', state);
    expect(takeMove.clauses[0].intent).toBe('move');
    expect(takeMove.clauses[0].isValid).toBe(true);

    // Restock display phrasing ("top off", "grab ... from backstock")
    const topOff = parseVoiceTranscript('top off display with 4 hotdogs', state);
    expect(topOff.clauses[0].intent).toBe('restock_display');
    expect(topOff.clauses[0].isValid).toBe(true);

    const grabBackstock = parseVoiceTranscript('grab 3 pork belly fresh from backstock to display', state);
    expect(grabBackstock.clauses[0].intent).toBe('restock_display');
    expect(grabBackstock.clauses[0].isValid).toBe(true);

    // Physical count statements (set_quantity)
    const countLeft = parseVoiceTranscript('there are 4 brats left in display', state);
    expect(countLeft.clauses[0].intent).toBe('set_quantity');
    expect(countLeft.clauses[0].selectedProductId).toBe('p-brats-mild');
    expect(countLeft.clauses[0].selectedSourceContainerId).toBe('f-display_loose');
    expect(countLeft.clauses[0].quantity).toBe(4);
    expect(countLeft.clauses[0].isValid).toBe(true);

    const noLeft = parseVoiceTranscript('we have no ground pork left in display', state);
    expect(noLeft.clauses[0].intent).toBe('set_quantity');
    expect(noLeft.clauses[0].quantity).toBe(0);
    expect(noLeft.clauses[0].isValid).toBe(true);

    // Add & new bag/tote creation
    const tossAdd = parseVoiceTranscript('toss 2 ribeye into chest freezer', state);
    expect(tossAdd.clauses[0].intent).toBe('add');
    expect(tossAdd.clauses[0].selectedDestContainerId).toBe('f-chest_loose');
    expect(tossAdd.clauses[0].isValid).toBe(true);

    const newBag = parseVoiceTranscript('create a new bag Red Bag in Canada with 4 ribeye', state);
    expect(newBag.clauses[0].intent).toBe('add');
    expect(newBag.clauses[0].newContainerNameQuery).toBe('Red Bag');
    expect(newBag.clauses[0].selectedFreezerId).toBe('f-canada');
    expect(newBag.clauses[0].isValid).toBe(true);

    // List & threshold phrasing variants
    const notifyList = parseVoiceTranscript('notify me when brats gets under 4 on restock list', state);
    expect(notifyList.clauses[0].intent).toBe('manage_list');
    expect(notifyList.clauses[0].listAction).toBe('set_threshold');
    expect(notifyList.clauses[0].listThreshold).toBe(4);
    expect(notifyList.clauses[0].isValid).toBe(true);

    const silenceList = parseVoiceTranscript('silence alerts for brats on restock list', state);
    expect(silenceList.clauses[0].intent).toBe('manage_list');
    expect(silenceList.clauses[0].listAction).toBe('disable_notify');
    expect(silenceList.clauses[0].isValid).toBe(true);

    // Tag & wrong-label variants
    const applyTag = parseVoiceTranscript('apply the vacuum sealed tag to pork belly fresh in display', state);
    expect(applyTag.clauses[0].intent).toBe('manage_tag');
    expect(applyTag.clauses[0].tagAction).toBe('add');
    expect(applyTag.clauses[0].isValid).toBe(true);

    const fixLabel = parseVoiceTranscript('fix the wrong label on ground pork in display to chicken broth', state);
    expect(fixLabel.clauses[0].intent).toBe('correct_label');
    expect(fixLabel.clauses[0].selectedReplacementProductId).toBe('p-chicken-broth');
    expect(fixLabel.clauses[0].isValid).toBe(true);

    const isMislabeled = parseVoiceTranscript('ground pork in display is mislabeled', state);
    expect(isMislabeled.clauses[0].intent).toBe('correct_label');
    expect(isMislabeled.clauses[0].requiresReplacementProductSelection).toBe(true);

    // Undo & container lifecycle variants
    const takeBack = parseVoiceTranscript('take that back', state);
    expect(takeBack.clauses[0].intent).toBe('undo_last');
    expect(takeBack.clauses[0].isValid).toBe(true);

    const exchangeCont = parseVoiceTranscript('exchange orange in canada with orange in chest freezer', state);
    expect(exchangeCont.clauses[0].intent).toBe('swap_containers');
    expect(exchangeCont.clauses[0].isValid).toBe(true);

    const changeName = parseVoiceTranscript('change container blue tote name to snack tote', state);
    expect(changeName.clauses[0].intent).toBe('rename_container');
    expect(changeName.clauses[0].newContainerNameInput).toBe('snack tote');
    expect(changeName.clauses[0].isValid).toBe(true);

    const putTogether = parseVoiceTranscript('put blue tote and orange in canada together', state);
    expect(putTogether.clauses[0].intent).toBe('combine_containers');
    expect(putTogether.clauses[0].combineSlots?.map(s => s.selectedContainerId)).toEqual([
      'c-blue-canada',
      'c-orange-canada',
    ]);
    const putTogetherInto = parseVoiceTranscript('put blue tote and orange in canada together into blue tote', state);
    expect(putTogetherInto.clauses[0].intent).toBe('combine_containers');
    expect(putTogetherInto.clauses[0].isValid).toBe(true);

    // Stock & container query variants (confirming offSiteEntries stay completely excluded!)
    const stillHave = parseVoiceTranscript('do we still have pork belly fresh?', state);
    expect(stillHave.clauses[0].intent).toBe('query');
    expect(stillHave.clauses[0].queryResults?.[0].totalQuantity).toBe(11); // 5 + 6, never 100 off-site

    const anyLeft = parseVoiceTranscript('any chicken broth left in display?', state);
    expect(anyLeft.clauses[0].intent).toBe('query');
    expect(anyLeft.clauses[0].queryResults?.[0].totalQuantity).toBe(4);

    const openCont = parseVoiceTranscript('open container orange in canada', state);
    expect(openCont.clauses[0].intent).toBe('container_query');
    expect(openCont.clauses[0].isValid).toBe(true);

    const sortingTable = parseVoiceTranscript("what's on the sorting table?", state);
    expect(sortingTable.clauses[0].intent).toBe('container_query');
    expect(sortingTable.clauses[0].containerQueryMode).toBe('staging');
  });

  it('enforces flag-based tag rules (excludeFromDisplayRestock & prioritizeItem) with zero hardcoded defaults', () => {
    state.tags = [
      { id: 't-vac', name: 'Vacuum Sealed' },
      // Even literal "Not For Sale" or "Use First" names without flags must NOT trigger automatic rules
      { id: 'not-for-sale', name: 'Not For Sale', excludeFromDisplayRestock: false },
      { id: 'use-first', name: 'Use First', prioritizeItem: false },
      // Arbitrary custom tags WITH explicit action flags drive all behavior
      { id: 't-hold', name: 'Farmer Reserve', excludeFromDisplayRestock: true },
      { id: 't-reserved', name: 'Private Reserve', excludeFromDisplayRestock: true },
      { id: 't-expiring', name: 'Expiring Soon', prioritizeItem: true },
    ];

    // Tag Chest Freezer's 9 hotdogs with custom "Farmer Reserve" (excludeFromDisplayRestock: true)
    // and add a smaller "Expiring Soon" (prioritizeItem: true) stack in Blue Tote
    state.meatCuts.find(m => m.id === 'mc-chest-hotdogs')!.tagIds = ['t-hold'];
    state.meatCuts.find(m => m.id === 'mc-chest-brats-hot')!.tagIds = ['t-reserved'];
    state.meatCuts.push({
      id: 'mc-blue-hotdogs-priority',
      productId: 'p-hotdogs',
      quantity: 3,
      containerId: 'c-blue-canada',
      tagIds: ['t-expiring'],
    });
    // Add a product (Ribeye) that only has excluded backstock in Chest Freezer
    state.meatCuts.push({
      id: 'mc-chest-ribeye-nfs',
      productId: 'p-ribeye',
      quantity: 4,
      containerId: 'f-chest_loose',
      tagIds: ['t-hold'],
    });

    // 1. restock_display prioritizes `prioritizeItem` ("Expiring Soon", 3 packs in Blue Tote) ahead of larger standard stack (12 in Orange Canada) and skips "Farmer Reserve" (9 in Orange Chest)
    const restockPriority = parseVoiceTranscript('restock 5 hotdogs to display', state);
    expect(restockPriority.clauses[0].intent).toBe('restock_display');
    expect(restockPriority.clauses[0].isValid).toBe(true);
    expect(restockPriority.clauses[0].restockAllocations?.map(a => ({
      cutId: a.meatCut.id,
      moveQty: a.moveQty,
    }))).toEqual([
      { cutId: 'mc-blue-hotdogs-priority', moveQty: 3 },
      { cutId: 'mc-canada-hotdogs', moveQty: 2 },
    ]);
    expect(restockPriority.clauses[0].restockAllocations?.[0].tags?.map(t => t.id)).toEqual(['t-expiring']);
    expect(restockPriority.clauses[0].restockRuleNote).toContain('Prioritized Expiring Soon stock');

    // 2. Imperative "restock hotdogs into display" also routes to restock_display rather than add
    const restockImperative = parseVoiceTranscript('restock hotdogs into display', state);
    expect(restockImperative.clauses[0].intent).toBe('restock_display');
    expect(restockImperative.clauses[0].isValid).toBe(true);

    // 3. Requesting more than eligible backstock blocks with excluded explanation (15 eligible = 3 + 12; 9 Farmer Reserve excluded)
    const overEligible = parseVoiceTranscript('restock display with 20 hotdogs', state);
    expect(overEligible.clauses[0].intent).toBe('restock_display');
    expect(overEligible.clauses[0].isValid).toBe(false);
    expect(overEligible.clauses[0].errorMessage).toContain('Only 15 pack(s)');
    expect(overEligible.clauses[0].errorMessage).toContain('9 pack(s) excluded by tag rule');
    expect(overEligible.clauses[0].errorMessage).toContain('Farmer Reserve');

    // 4. Product whose entire backstock carries excludeFromDisplayRestock cannot be restocked to Display
    const onlyExcluded = parseVoiceTranscript('restock display with 2 ribeye', state);
    expect(onlyExcluded.clauses[0].intent).toBe('restock_display');
    expect(onlyExcluded.clauses[0].isValid).toBe(false);
    expect(onlyExcluded.clauses[0].errorMessage).toContain('4 pack(s) excluded by tag rule');
    expect(onlyExcluded.clauses[0].errorMessage).toContain('Farmer Reserve');

    // 5. Restock alert query ignores items whose only backstock is excluded (Ribeye & Jalapeno Brats)
    //    and reports Hot Dogs with ONLY eligible backstock qty (15) and prioritized container ranked first
    const restockAlert = parseVoiceTranscript('What do I need to restock?', state);
    expect(restockAlert.clauses[0].intent).toBe('inventory_alert_query');
    const restockIds = restockAlert.clauses[0].alertQueryResults?.map(r => r.product.id) || [];
    expect(restockIds).toContain('p-hotdogs');
    expect(restockIds).not.toContain('p-ribeye');
    expect(restockIds).not.toContain('p-brats-hot');
    const hotdogAlert = restockAlert.clauses[0].alertQueryResults?.find(r => r.product.id === 'p-hotdogs');
    expect(hotdogAlert?.backstockQty).toBe(15);
    expect(hotdogAlert?.backstockLocations[0].containerId).toBe('c-blue-canada');
    expect(hotdogAlert?.backstockLocations[0].hasPrioritized).toBe(true);

    // 6. Global out-of-stock query STILL sees Ribeye as in stock on-site (4 packs Farmer Reserve)
    const globalOos = parseVoiceTranscript('what are we completely out of?', state);
    expect(globalOos.clauses[0].alertQueryResults?.map(r => r.product.id)).not.toContain('p-ribeye');

    // 7. Moving to Display excludes excluded bins from ambiguous picks, ranks prioritized first, and warns on explicit move
    const moveAutoPriority = parseVoiceTranscript('move 2 hotdogs to display', state);
    expect(moveAutoPriority.clauses[0].intent).toBe('move');
    expect(moveAutoPriority.clauses[0].sourceLocationCandidates.map(l => l.containerId)).toEqual([
      'c-blue-canada',
      'c-orange-canada',
    ]);
    expect(moveAutoPriority.clauses[0].sourceLocationCandidates[0].hasPrioritized).toBe(true);
    expect(moveAutoPriority.clauses[0].cutCandidates.map(c => c.meatCut.id)).toEqual([
      'mc-blue-hotdogs-priority',
      'mc-canada-hotdogs',
    ]);

    const moveExplicitExcluded = parseVoiceTranscript('move 2 hotdogs from orange in chest freezer to display', state);
    expect(moveExplicitExcluded.clauses[0].intent).toBe('move');
    expect(moveExplicitExcluded.clauses[0].isValid).toBe(true);
    expect(moveExplicitExcluded.clauses[0].warningMessage).toContain('excluded from Display Restock');
    expect(moveExplicitExcluded.clauses[0].warningMessage).toContain('Farmer Reserve');

    // 8. Moving/emptying a container with excluded items into Display warns the operator
    const emptyIntoDisplay = parseVoiceTranscript('empty orange in chest freezer into display', state);
    expect(emptyIntoDisplay.clauses[0].intent).toBe('empty_container');
    expect(emptyIntoDisplay.clauses[0].warningMessage).toContain('excluded from Display Restock');
    expect(emptyIntoDisplay.clauses[0].warningMessage).toContain('Farmer Reserve');

    // 9. Inventory removal (`remove`) pushes `prioritizeItem` items to the front and auto-picks a sufficient priority stack
    // 9a. Single-container multi-stack: add a priority Display Bratwurst stack alongside the standard Display stack
    state.meatCuts.push({
      id: 'mc-display-brats-priority',
      productId: 'p-brats-mild',
      quantity: 3,
      containerId: 'f-display_loose',
      tagIds: ['t-expiring'],
    });
    const removeDisplayBrats = parseVoiceTranscript('remove 2 brats from display', state);
    expect(removeDisplayBrats.clauses[0].intent).toBe('remove');
    expect(removeDisplayBrats.clauses[0].isValid).toBe(true);
    expect(removeDisplayBrats.clauses[0].selectedMeatCutId).toBe('mc-display-brats-priority');
    expect(removeDisplayBrats.clauses[0].requiresCutSelection).toBe(false);
    expect(removeDisplayBrats.clauses[0].restockRuleNote).toContain('Prioritized Expiring Soon stock for removal');

    // 9b. When requested removal qty exceeds the priority stack, require selection with prioritized stack ranked first
    const removeMoreBrats = parseVoiceTranscript('remove 4 brats from display', state);
    expect(removeMoreBrats.clauses[0].requiresCutSelection).toBe(true);
    expect(removeMoreBrats.clauses[0].cutCandidates.map(c => c.meatCut.id)).toEqual([
      'mc-display-brats-priority',
      'mc-disp-brats',
    ]);

    // 9c. Cross-container removal without naming source auto-targets the unique container holding a sufficient priority stack
    const removeHotdogsGlobal = parseVoiceTranscript('remove 2 hotdogs', state);
    expect(removeHotdogsGlobal.clauses[0].intent).toBe('remove');
    expect(removeHotdogsGlobal.clauses[0].isValid).toBe(true);
    expect(removeHotdogsGlobal.clauses[0].selectedSourceContainerId).toBe('c-blue-canada');
    expect(removeHotdogsGlobal.clauses[0].selectedMeatCutId).toBe('mc-blue-hotdogs-priority');
    expect(removeHotdogsGlobal.clauses[0].restockRuleNote).toContain('Prioritized Expiring Soon stock for removal');

    // 10. Unflagging excludeFromDisplayRestock on custom tag makes stock eligible again immediately
    state.tags = state.tags.map(t =>
      t.id === 't-hold' ? { ...t, excludeFromDisplayRestock: false } : t
    );
    const overAfterOverride = parseVoiceTranscript('restock display with 20 hotdogs', state);
    expect(overAfterOverride.clauses[0].isValid).toBe(true);
    expect(overAfterOverride.clauses[0].restockAllocations?.reduce((s, a) => s + a.moveQty, 0)).toBe(20);
  });

  it('supports 1-to-many Voice Dictionary Product Pack (bundle) expansion across voice commands without false positives', () => {
    // Seed Pork, Goat, Lamb, and Chicken Broth products + display loose & backstock inventory
    state.products.push(
      { id: 'p-pork-broth', name: 'Pork Broth', primaryCategory: 'Pork', subCategory: 'Broth' },
      { id: 'p-goat-broth', name: 'Goat Broth', primaryCategory: 'Goat', subCategory: 'Broth' },
      { id: 'p-lamb-broth', name: 'Lamb Broth', primaryCategory: 'Lamb', subCategory: 'Broth' }
    );
    state.meatCuts.push(
      { id: 'mc-disp-pork-broth', productId: 'p-pork-broth', quantity: 5, containerId: 'f-display_loose' },
      { id: 'mc-disp-goat-broth', productId: 'p-goat-broth', quantity: 2, containerId: 'f-display_loose' },
      { id: 'mc-disp-lamb-broth', productId: 'p-lamb-broth', quantity: 1, containerId: 'f-display_loose' },
      // Backstock in Orange Canada for restock / move tests
      { id: 'mc-can-pork-broth', productId: 'p-pork-broth', quantity: 5, containerId: 'c-orange-canada' },
      { id: 'mc-can-goat-broth', productId: 'p-goat-broth', quantity: 5, containerId: 'c-orange-canada' },
      { id: 'mc-can-lamb-broth', productId: 'p-lamb-broth', quantity: 5, containerId: 'c-orange-canada' },
      { id: 'mc-can-chicken-broth', productId: 'p-chicken-broth', quantity: 5, containerId: 'c-orange-canada' }
    );
    state.customLists = [
      {
        id: 'list-restock',
        name: 'Restock List',
        description: '',
        allowNotes: true,
        isInventoryControlled: true,
        items: [],
      },
    ];
    state.voiceDictionary = [
      {
        id: 'vd-broth-mix-pack',
        spokenPhrase: 'broth mix pack',
        targetType: 'bundle',
        bundleItems: [
          { productId: 'p-pork-broth', quantity: 1 },
          { productId: 'p-goat-broth', quantity: 1 },
          { productId: 'p-lamb-broth', quantity: 1 },
          { productId: 'p-chicken-broth', quantity: 1 },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'vd-special-soup-pack',
        spokenPhrase: 'special soup pack',
        targetType: 'bundle',
        bundleItems: [
          { productId: 'p-pork-broth', quantity: 2 },
          { productId: 'p-chicken-broth', quantity: 1 },
        ],
        createdAt: new Date().toISOString(),
      },
    ];

    // 1. Primary requested scenario: "remove 1 broth mix pack from display loose"
    const removeOnePack = parseVoiceTranscript('remove 1 broth mix pack from display loose', state);
    expect(removeOnePack.clauses).toHaveLength(4);
    expect(removeOnePack.clauses.every(c => c.intent === 'remove' && c.isValid)).toBe(true);
    expect(removeOnePack.clauses.every(c => c.bundlePhrase === 'broth mix pack')).toBe(true);
    expect(
      removeOnePack.clauses.map(c => ({
        prod: c.selectedProductId,
        qty: c.quantity,
        cont: c.selectedSourceContainerId,
      }))
    ).toEqual([
      { prod: 'p-pork-broth', qty: 1, cont: 'f-display_loose' },
      { prod: 'p-goat-broth', qty: 1, cont: 'f-display_loose' },
      { prod: 'p-lamb-broth', qty: 1, cont: 'f-display_loose' },
      { prod: 'p-chicken-broth', qty: 1, cont: 'f-display_loose' },
    ]);
    expect(buildVoiceDispatchActions(removeOnePack.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: {
          updates: {
            'mc-disp-pork-broth': 4,
            'mc-disp-goat-broth': 1,
            'mc-disp-lamb-broth': 0,
            'mc-disp-broth': 3,
          },
        },
      },
    ]);

    // 2. Plural + pack quantity multiplier + per-item multiplier (2 packs * [2x pork, 1x chicken] = 4 pork, 2 chicken)
    const removeTwoSpecial = parseVoiceTranscript(
      'remove 2 special soup packs from display loose',
      state
    );
    expect(removeTwoSpecial.clauses).toHaveLength(2);
    expect(removeTwoSpecial.clauses.every(c => c.isValid)).toBe(true);
    expect(removeTwoSpecial.clauses.map(c => ({ prod: c.selectedProductId, qty: c.quantity }))).toEqual([
      { prod: 'p-pork-broth', qty: 4 },
      { prod: 'p-chicken-broth', qty: 2 },
    ]);
    expect(buildVoiceDispatchActions(removeTwoSpecial.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: {
          updates: {
            'mc-disp-pork-broth': 1,
            'mc-disp-broth': 2,
          },
        },
      },
    ]);

    // 3. Partial stock failure isolates only the understocked constituent item (Lamb Broth has 1, requested 2)
    const removeTwoMix = parseVoiceTranscript('remove 2 broth mix packs from display loose', state);
    expect(removeTwoMix.clauses).toHaveLength(4);
    const lambClause = removeTwoMix.clauses.find(c => c.selectedProductId === 'p-lamb-broth')!;
    expect(lambClause.isValid).toBe(false);
    expect(lambClause.errorMessage).toContain('Insufficient stock (available: 1)');
    expect(
      removeTwoMix.clauses.filter(c => c.selectedProductId !== 'p-lamb-broth').every(c => c.isValid)
    ).toBe(true);

    // 4. Add pack -> adds each item to destination container
    const addPack = parseVoiceTranscript('add 1 broth mix pack to display loose', state);
    expect(addPack.clauses).toHaveLength(4);
    expect(addPack.clauses.every(c => c.intent === 'add' && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(addPack.clauses, state)).toEqual([
      { type: 'ADD_MEAT_CUT', payload: { productId: 'p-pork-broth', quantity: 1, containerId: 'f-display_loose' } },
      { type: 'ADD_MEAT_CUT', payload: { productId: 'p-goat-broth', quantity: 1, containerId: 'f-display_loose' } },
      { type: 'ADD_MEAT_CUT', payload: { productId: 'p-lamb-broth', quantity: 1, containerId: 'f-display_loose' } },
      { type: 'ADD_MEAT_CUT', payload: { productId: 'p-chicken-broth', quantity: 1, containerId: 'f-display_loose' } },
    ]);

    // 5. Move pack -> moves each item from source to dest
    const movePack = parseVoiceTranscript(
      'move 1 broth mix pack from orange in canada to display loose',
      state
    );
    expect(movePack.clauses).toHaveLength(4);
    expect(movePack.clauses.every(c => c.intent === 'move' && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(movePack.clauses, state)).toHaveLength(4);

    // 6. Add container with pack -> 4 add clauses sharing newContainerGroupKey -> 1 ADD_CONTAINER + 4 ADD_MEAT_CUTs
    const newContPack = parseVoiceTranscript(
      'add container Sample Cooler in Canada with 1 broth mix pack',
      state
    );
    expect(newContPack.clauses).toHaveLength(4);
    expect(newContPack.clauses.every(c => c.intent === 'add' && Boolean(c.newContainerGroupKey) && c.isValid)).toBe(true);
    const newContActions = buildVoiceDispatchActions(newContPack.clauses, state);
    expect(newContActions.filter(a => a.type === 'ADD_CONTAINER')).toHaveLength(1);
    expect(newContActions.filter(a => a.type === 'ADD_MEAT_CUT')).toHaveLength(4);

    // 7. Restock display with pack -> expands to restock_display allocations from backstock
    const restockPack = parseVoiceTranscript('restock display with 1 broth mix pack', state);
    expect(restockPack.clauses).toHaveLength(4);
    expect(restockPack.clauses.every(c => c.intent === 'restock_display' && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(restockPack.clauses, state)).toHaveLength(4);

    // 8. Custom list management with pack -> adds all 4 products to list
    const listPack = parseVoiceTranscript('add broth mix pack to restock list', state);
    expect(listPack.clauses).toHaveLength(4);
    expect(listPack.clauses.every(c => c.intent === 'manage_list' && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(listPack.clauses, state)).toEqual([
      {
        type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST',
        payload: {
          updates: [
            { listId: 'list-restock', productId: 'p-pork-broth', forceState: true, threshold: undefined },
            { listId: 'list-restock', productId: 'p-goat-broth', forceState: true, threshold: undefined },
            { listId: 'list-restock', productId: 'p-lamb-broth', forceState: true, threshold: undefined },
            { listId: 'list-restock', productId: 'p-chicken-broth', forceState: true, threshold: undefined },
          ],
        },
      },
    ]);

    // 9. Stock query for pack -> single query card showing all 4 constituent items scoped to location
    const queryPack = parseVoiceTranscript('how many broth mix packs are in display loose?', state);
    expect(queryPack.hasQueries).toBe(true);
    expect(queryPack.clauses).toHaveLength(1);
    expect(queryPack.clauses[0].intent).toBe('query');
    expect(queryPack.clauses[0].bundlePhrase).toBe('broth mix pack');
    expect(queryPack.clauses[0].queryResults?.map(r => ({ id: r.product.id, qty: r.totalQuantity }))).toEqual([
      { id: 'p-pork-broth', qty: 5 },
      { id: 'p-goat-broth', qty: 2 },
      { id: 'p-lamb-broth', qty: 1 },
      { id: 'p-chicken-broth', qty: 4 },
    ]);

    // 10. Wipe out / empty pack from display loose -> sets all 4 items in f-display_loose to 0
    const wipePack = parseVoiceTranscript('wipe out broth mix pack from display loose', state);
    expect(wipePack.clauses).toHaveLength(4);
    expect(wipePack.clauses.every(c => c.intent === 'remove' && c.isAllQuantity && c.isValid)).toBe(true);
    expect(buildVoiceDispatchActions(wipePack.clauses, state)).toEqual([
      {
        type: 'BATCH_UPDATE_MEAT_QUANTITY',
        payload: {
          updates: {
            'mc-disp-pork-broth': 0,
            'mc-disp-goat-broth': 0,
            'mc-disp-lamb-broth': 0,
            'mc-disp-broth': 0,
          },
        },
      },
    ]);

    // 11. Chained pack + regular item in same command
    const chainedPack = parseVoiceTranscript(
      'remove 1 broth mix pack and 2 brats from display loose',
      state
    );
    expect(chainedPack.clauses).toHaveLength(5);
    expect(chainedPack.clauses.every(c => c.intent === 'remove' && c.isValid)).toBe(true);

    // 12. Archived constituent item produces explicit pack error message
    state.voiceDictionary.push({
      id: 'vd-archived-pack',
      spokenPhrase: 'legacy pack',
      targetType: 'bundle',
      bundleItems: [
        { productId: 'p-chicken-broth', quantity: 1 },
        { productId: 'p-archived', quantity: 1 },
      ],
    });
    const archivedPack = parseVoiceTranscript('remove 1 legacy pack from display loose', state);
    expect(archivedPack.clauses).toHaveLength(2);
    const archivedItemClause = archivedPack.clauses.find(c => !c.isValid)!;
    expect(archivedItemClause.errorMessage).toContain('legacy pack');
    expect(archivedItemClause.errorMessage).toContain('archived');

    // 13. Non-collision guard: individual "chicken broth" or generic "broth" must NOT trigger "broth mix pack"
    const singleChickenBroth = parseVoiceTranscript('remove 1 chicken broth from display loose', state);
    expect(singleChickenBroth.clauses).toHaveLength(1);
    expect(singleChickenBroth.clauses[0].selectedProductId).toBe('p-chicken-broth');
    expect(singleChickenBroth.clauses[0].bundlePhrase).toBeUndefined();

    const genericBroth = parseVoiceTranscript('remove 1 broth from display loose', state);
    expect(genericBroth.clauses).toHaveLength(1);
    expect(genericBroth.clauses[0].bundlePhrase).toBeUndefined();
    expect(genericBroth.clauses[0].requiresProductSelection).toBe(true);
  });

  it('does not require package stack selection simultaneously while source container selection is pending', () => {
    state.products.push({
      id: 'p-liverwurst',
      name: 'Liverwurst',
      primaryCategory: 'Pork',
      subCategory: 'Offal',
    });
    state.containers.push(
      { id: 'c-box-best', name: 'Box best', freezerId: 'f-canada', icon: 'Box' },
      { id: 'c-flowers', name: 'white w/ Yellow Flowers', freezerId: 'f-chest', icon: 'Box' }
    );
    state.meatCuts.push(
      { id: 'mc-liver-box', productId: 'p-liverwurst', quantity: 60, containerId: 'c-box-best' },
      { id: 'mc-liver-disp', productId: 'p-liverwurst', quantity: 9, containerId: 'f-display_loose' },
      { id: 'mc-liver-flowers', productId: 'p-liverwurst', quantity: 7, containerId: 'c-flowers' },
      {
        id: 'mc-liver-flowers-promo',
        productId: 'p-liverwurst',
        quantity: 2,
        containerId: 'c-flowers',
        notes: 'Promo pack',
      }
    );

    // 1. Ambiguous source container across 3 locations -> only source container selection is required
    const pendingContainer = parseVoiceTranscript('remove 1 liver', state);
    expect(pendingContainer.clauses).toHaveLength(1);
    const clause = pendingContainer.clauses[0];
    expect(clause.selectedProductId).toBe('p-liverwurst');
    expect(clause.sourceLocationCandidates).toHaveLength(3);
    expect(clause.requiresSourceLocationSelection).toBe(true);
    expect(clause.requiresCutSelection).toBe(false);
    expect(clause.isValid).toBe(false);

    // 2. Selecting a container with 1 stack resolves immediately without stack prompt
    const pickedSingleStack = parseVoiceTranscript('remove 1 liver', state, {
      [clause.id]: { sourceContainerId: 'c-box-best' },
    });
    expect(pickedSingleStack.clauses[0].requiresSourceLocationSelection).toBe(false);
    expect(pickedSingleStack.clauses[0].requiresCutSelection).toBe(false);
    expect(pickedSingleStack.clauses[0].selectedMeatCutId).toBe('mc-liver-box');
    expect(pickedSingleStack.clauses[0].isValid).toBe(true);

    // 3. Selecting a container with 2+ stacks then prompts ONLY for package stacks in that container
    const pickedMultiStack = parseVoiceTranscript('remove 1 liver', state, {
      [clause.id]: { sourceContainerId: 'c-flowers' },
    });
    expect(pickedMultiStack.clauses[0].requiresSourceLocationSelection).toBe(false);
    expect(pickedMultiStack.clauses[0].requiresCutSelection).toBe(true);
    expect(pickedMultiStack.clauses[0].cutCandidates.map(c => c.meatCut.id).sort()).toEqual([
      'mc-liver-flowers',
      'mc-liver-flowers-promo',
    ]);
    expect(pickedMultiStack.clauses[0].isValid).toBe(false);

    // 4. Ambiguous container in manage_tag / correct_label also avoids simultaneous container + stack prompts
    const tagAmbiguousLoc = parseVoiceTranscript('tag hotdogs in orange as vacuum sealed', state);
    expect(tagAmbiguousLoc.clauses[0].requiresSourceLocationSelection).toBe(true);
    expect(tagAmbiguousLoc.clauses[0].requiresCutSelection).toBe(false);
    expect(tagAmbiguousLoc.clauses[0].isValid).toBe(false);

    const labelAmbiguousLoc = parseVoiceTranscript('mark hotdogs in orange as wrong label', state);
    expect(labelAmbiguousLoc.clauses[0].requiresSourceLocationSelection).toBe(true);
    expect(labelAmbiguousLoc.clauses[0].requiresCutSelection).toBe(false);
    expect(labelAmbiguousLoc.clauses[0].isValid).toBe(false);
  });

  it('expands natural container language (box, bag, bin, tote, crate, cooler, etc.) across creation, lifecycle, and queries', () => {
    state.freezers.push({ id: 'f-freezer-1', name: 'Freezer 1' });

    // 1. User's primary examples
    // 1a. With unambiguous product ("brats mild")
    const newBoxFreezer1 = parseVoiceTranscript(
      'create new box yellow in freezer 1 with 4 brats mild',
      state
    );
    expect(newBoxFreezer1.clauses).toHaveLength(1);
    expect(newBoxFreezer1.clauses[0].intent).toBe('add');
    expect(newBoxFreezer1.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(newBoxFreezer1.clauses[0].resolvedNewContainerName).toBe('Box Yellow');
    expect(newBoxFreezer1.clauses[0].selectedFreezerId).toBe('f-freezer-1');
    expect(newBoxFreezer1.clauses[0].quantity).toBe(4);
    expect(newBoxFreezer1.clauses[0].selectedProductId).toBe('p-brats-mild');
    expect(newBoxFreezer1.clauses[0].isValid).toBe(true);
    const boxActions = buildVoiceDispatchActions(newBoxFreezer1.clauses, state);
    expect(boxActions[0].type).toBe('ADD_CONTAINER');
    if (boxActions[0].type === 'ADD_CONTAINER') {
      expect(boxActions[0].payload.name).toBe('Box Yellow');
      expect(boxActions[0].payload.freezerId).toBe('f-freezer-1');
      expect(boxActions[0].payload.icon).toBe('box');
    }

    // 1b. Exact wording "create new box yellow in freezer 1 with 4 brats" resolves box & freezer immediately and disambiguates Bratwurst variants if multiple exist
    const exactBratsPrompt = parseVoiceTranscript(
      'create new box yellow in freezer 1 with 4 brats',
      state
    );
    expect(exactBratsPrompt.clauses[0].intent).toBe('add');
    expect(exactBratsPrompt.clauses[0].resolvedNewContainerName).toBe('Box Yellow');
    expect(exactBratsPrompt.clauses[0].selectedFreezerId).toBe('f-freezer-1');
    expect(exactBratsPrompt.clauses[0].quantity).toBe(4);
    expect(exactBratsPrompt.clauses[0].requiresProductSelection).toBe(true);
    const singleBratState: InventoryState = {
      ...state,
      products: state.products.filter(p => p.id !== 'p-brats-hot'),
    };
    const exactBratsSingleCatalog = parseVoiceTranscript(
      'create new box yellow in freezer 1 with 4 brats',
      singleBratState
    );
    expect(exactBratsSingleCatalog.clauses[0].resolvedNewContainerName).toBe('Box Yellow');
    expect(exactBratsSingleCatalog.clauses[0].selectedFreezerId).toBe('f-freezer-1');
    expect(exactBratsSingleCatalog.clauses[0].selectedProductId).toBe('p-brats-mild');
    expect(exactBratsSingleCatalog.clauses[0].isValid).toBe(true);

    const newBagStaging = parseVoiceTranscript('make new bag green with 6 hotdogs', state);
    expect(newBagStaging.clauses).toHaveLength(1);
    expect(newBagStaging.clauses[0].intent).toBe('add');
    expect(newBagStaging.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(newBagStaging.clauses[0].resolvedNewContainerName).toBe('Bag Green');
    expect(newBagStaging.clauses[0].selectedFreezerId).toBe('__staging__');
    expect(newBagStaging.clauses[0].quantity).toBe(6);
    expect(newBagStaging.clauses[0].selectedProductId).toBe('p-hotdogs');
    expect(newBagStaging.clauses[0].isValid).toBe(true);
    const bagActions = buildVoiceDispatchActions(newBagStaging.clauses, state);
    expect(bagActions[0].type).toBe('ADD_CONTAINER');
    if (bagActions[0].type === 'ADD_CONTAINER') {
      expect(bagActions[0].payload.name).toBe('Bag Green');
      expect(bagActions[0].payload.freezerId).toBeUndefined();
      expect(bagActions[0].payload.icon).toBe('pillowcase');
    }

    // 2. Without "new", modifier-before-noun, items-first, and named/called forms
    const withoutNew = parseVoiceTranscript('create box orange in chest freezer with 2 ribeye', state);
    expect(withoutNew.clauses[0].intent).toBe('add');
    expect(withoutNew.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(withoutNew.clauses[0].resolvedNewContainerName).toBe('Box Orange');
    expect(withoutNew.clauses[0].selectedFreezerId).toBe('f-chest');
    expect(withoutNew.clauses[0].isValid).toBe(true);

    const modBeforeNoun = parseVoiceTranscript('make a new green bag with 6 hotdogs', state);
    expect(modBeforeNoun.clauses[0].intent).toBe('add');
    expect(modBeforeNoun.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(modBeforeNoun.clauses[0].resolvedNewContainerName).toBe('Green Bag');
    expect(modBeforeNoun.clauses[0].newContainerIcon).toBe('pillowcase');
    expect(modBeforeNoun.clauses[0].isValid).toBe(true);

    const modWithoutNew = parseVoiceTranscript('create a yellow box in freezer 1 with 4 hotdogs', state);
    expect(modWithoutNew.clauses[0].intent).toBe('add');
    expect(modWithoutNew.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(modWithoutNew.clauses[0].resolvedNewContainerName).toBe('Yellow Box');
    expect(modWithoutNew.clauses[0].selectedFreezerId).toBe('f-freezer-1');
    expect(modWithoutNew.clauses[0].isValid).toBe(true);

    const itemsFirst = parseVoiceTranscript(
      'inbound 3 ribeye into new box yellow in chest freezer',
      state
    );
    expect(itemsFirst.clauses[0].intent).toBe('add');
    expect(itemsFirst.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(itemsFirst.clauses[0].resolvedNewContainerName).toBe('Box Yellow');
    expect(itemsFirst.clauses[0].selectedFreezerId).toBe('f-chest');
    expect(itemsFirst.clauses[0].quantity).toBe(3);
    expect(itemsFirst.clauses[0].isValid).toBe(true);

    const namedBox = parseVoiceTranscript(
      'create new box called holiday in freezer 1 with 4 hotdogs',
      state
    );
    expect(namedBox.clauses[0].intent).toBe('add');
    expect(namedBox.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(namedBox.clauses[0].resolvedNewContainerName).toBe('Holiday');
    expect(namedBox.clauses[0].selectedFreezerId).toBe('f-freezer-1');
    expect(namedBox.clauses[0].isValid).toBe(true);

    // 3. Expanded nouns & inferred icons
    const expandedCases: Array<{ phrase: string; expectedName: string; expectedIcon: string }> = [
      { phrase: 'create new bin alpha with 2 hotdogs', expectedName: 'Bin Alpha', expectedIcon: 'bin' },
      { phrase: 'make new tote blue with 2 hotdogs', expectedName: 'Tote Blue', expectedIcon: 'bin' },
      { phrase: 'build new cooler camp with 2 hotdogs', expectedName: 'Cooler Camp', expectedIcon: 'bin' },
      { phrase: 'open new crate oak with 2 hotdogs', expectedName: 'Crate Oak', expectedIcon: 'box' },
      { phrase: 'start new tray prep with 2 hotdogs', expectedName: 'Tray Prep', expectedIcon: 'tray' },
      { phrase: 'set up new pouch silver with 2 hotdogs', expectedName: 'Pouch Silver', expectedIcon: 'pouch' },
      { phrase: 'create new rack top with 2 hotdogs', expectedName: 'Rack Top', expectedIcon: 'grid' },
      { phrase: 'make new bag with 6 hotdogs', expectedName: 'Bag', expectedIcon: 'pillowcase' },
    ];
    for (const tc of expandedCases) {
      const parsed = parseVoiceTranscript(tc.phrase, state);
      expect(parsed.clauses[0].intent).toBe('add');
      expect(parsed.clauses[0].newContainerGroupKey).toBeTruthy();
      expect(parsed.clauses[0].resolvedNewContainerName).toBe(tc.expectedName);
      expect(parsed.clauses[0].newContainerIcon).toBe(tc.expectedIcon);
      expect(parsed.clauses[0].isValid).toBe(true);
    }

    // 4. Template matching preserves container type nouns ("box yellow" matches "Yellow Box" candidate only, NOT "Yellow Bag")
    state.containerTemplates = [
      { id: 'tpl-ybag', name: 'Yellow Bag', icon: 'pillowcase' },
      { id: 'tpl-ybox', name: 'Yellow Box', icon: 'box' },
    ];
    const boxExactTemplateMatch = parseVoiceTranscript(
      'create a yellow box in freezer 1 with 4 hotdogs',
      state
    );
    expect(boxExactTemplateMatch.clauses[0].selectedTemplateId).toBe('tpl-ybox');
    expect(boxExactTemplateMatch.clauses[0].resolvedNewContainerName).toBe('Yellow Box');

    const boxReorderedTemplateMatch = parseVoiceTranscript(
      'create new box yellow in freezer 1 with 4 hotdogs',
      state
    );
    const yboxCand = boxReorderedTemplateMatch.clauses[0].templateCandidates?.find(
      c => c.templateId === 'tpl-ybox'
    );
    const ybagCand = boxReorderedTemplateMatch.clauses[0].templateCandidates?.find(
      c => c.templateId === 'tpl-ybag'
    );
    expect((yboxCand?.score ?? 0) >= 65).toBe(true);
    expect((ybagCand?.score ?? 0) < 65).toBe(true);
    state.containerTemplates = [];

    // 5. Multi-line colon header & "and"-chaining
    const multilineBox = parseVoiceTranscript(
      'Create new box yellow in freezer 1:\n- 4 brats mild\n- 6 hotdogs',
      state
    );
    expect(multilineBox.clauses).toHaveLength(2);
    expect(multilineBox.clauses.every(c => c.intent === 'add' && Boolean(c.newContainerGroupKey) && c.isValid)).toBe(true);
    expect(multilineBox.clauses[0].resolvedNewContainerName).toBe('Box Yellow');

    const chainedCreate = parseVoiceTranscript(
      'remove 2 brats from display and make new bag green with 6 hotdogs',
      state
    );
    expect(chainedCreate.clauses).toHaveLength(2);
    expect(chainedCreate.clauses[0].intent).toBe('remove');
    expect(chainedCreate.clauses[1].intent).toBe('add');
    expect(chainedCreate.clauses[1].newContainerGroupKey).toBeTruthy();
    expect(chainedCreate.clauses[1].resolvedNewContainerName).toBe('Bag Green');
    expect(chainedCreate.clauses[1].isValid).toBe(true);

    // 6. Negative guards: food packaging phrases or target quantities must NOT trigger add_container
    const addBagOf = parseVoiceTranscript('add bag of hotdogs to display', state);
    expect(addBagOf.clauses[0].intent).toBe('add');
    expect(addBagOf.clauses[0].newContainerGroupKey).toBeUndefined();

    const addPanSausage = parseVoiceTranscript('add pan ground pork to display', state);
    expect(addPanSausage.clauses[0].intent).toBe('add');
    expect(addPanSausage.clauses[0].newContainerGroupKey).toBeUndefined();

    const makeTargetQty = parseVoiceTranscript('make brats in display to 2', state);
    expect(makeTargetQty.clauses[0].intent).toBe('set_quantity');
    expect(makeTargetQty.clauses[0].quantity).toBe(2);

    // 7. Expanded nouns in lifecycle & query commands
    state.containers.push(
      { id: 'c-box-yellow', name: 'Box Yellow', freezerId: 'f-freezer-1', icon: 'box' },
      { id: 'c-bag-green', name: 'Bag Green', freezerId: undefined, icon: 'pillowcase' },
      { id: 'c-empty-box', name: 'Box Empty', freezerId: 'f-freezer-1', icon: 'box' }
    );
    state.meatCuts.push(
      { id: 'mc-box-yellow-brats', productId: 'p-brats-mild', quantity: 4, containerId: 'c-box-yellow' },
      { id: 'mc-bag-green-dogs', productId: 'p-hotdogs', quantity: 6, containerId: 'c-bag-green' }
    );

    const moveBox = parseVoiceTranscript('move box yellow to chest freezer', state);
    expect(moveBox.clauses[0].intent).toBe('move_container');
    expect(moveBox.clauses[0].selectedSourceContainerId).toBe('c-box-yellow');
    expect(moveBox.clauses[0].selectedFreezerId).toBe('f-chest');
    expect(moveBox.clauses[0].isValid).toBe(true);

    const putBag = parseVoiceTranscript('put bag green in freezer 1', state);
    expect(putBag.clauses[0].intent).toBe('move_container');
    expect(putBag.clauses[0].selectedSourceContainerId).toBe('c-bag-green');
    expect(putBag.clauses[0].selectedFreezerId).toBe('f-freezer-1');
    expect(putBag.clauses[0].isValid).toBe(true);

    const swapBoxes = parseVoiceTranscript('swap box yellow and bag green', state);
    expect(swapBoxes.clauses[0].intent).toBe('swap_containers');
    expect(swapBoxes.clauses[0].isValid).toBe(true);

    const renameBox = parseVoiceTranscript('rename box yellow to cooler gold', state);
    expect(renameBox.clauses[0].intent).toBe('rename_container');
    expect(renameBox.clauses[0].selectedSourceContainerId).toBe('c-box-yellow');
    expect(renameBox.clauses[0].newContainerNameInput).toBe('cooler gold');
    expect(renameBox.clauses[0].isValid).toBe(true);

    const queryBoxes = parseVoiceTranscript('what boxes are in freezer 1', state);
    expect(queryBoxes.clauses[0].intent).toBe('container_query');
    expect(queryBoxes.clauses[0].isValid).toBe(true);

    const deleteEmptyBox = parseVoiceTranscript('remove the empty box empty', state);
    expect(deleteEmptyBox.clauses[0].intent).toBe('delete_container');
    expect(deleteEmptyBox.clauses[0].selectedSourceContainerId).toBe('c-empty-box');
    expect(deleteEmptyBox.clauses[0].isValid).toBe(true);
  });

  it('supports pillowcase container nouns, sequential pronoun placement, and duplicate-name warnings', () => {
    state.products = [
      { id: 'p-brats-mild', name: 'Bratwurst Mild', primaryCategory: 'Pork', subCategory: 'Sausage' },
      { id: 'p-hotdogs', name: 'Beef Hot Dogs', primaryCategory: 'Beef', subCategory: 'Sausage' },
      { id: 'p-ribeye', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks' },
      { id: 'p-chicken-broth', name: 'Chicken Broth', primaryCategory: 'Poultry', subCategory: 'Broth' },
    ];
    state.containerTemplates = [
      { id: 'tpl-red-bag', name: 'Red Bag', icon: 'pillowcase' },
      { id: 'tpl-polka', name: 'Polka Pillowcase', icon: 'pillowcase' },
    ];

    // 1. Pillowcase & "pillow case" natural nouns + icon inference
    const polka = parseVoiceTranscript(
      'create new pillowcase polka in canada with 3 ribeye',
      state
    );
    expect(polka.clauses).toHaveLength(1);
    expect(polka.clauses[0].intent).toBe('add');
    expect(polka.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(polka.clauses[0].newContainerIcon).toBe('pillowcase');
    expect(polka.clauses[0].selectedTemplateId).toBe('tpl-polka');
    expect(polka.clauses[0].selectedFreezerId).toBe('f-canada');
    expect(polka.clauses[0].isValid).toBe(true);

    const twoWordCase = parseVoiceTranscript(
      'make new pillow case floral with 2 hotdogs',
      state
    );
    expect(twoWordCase.clauses[0].intent).toBe('add');
    expect(twoWordCase.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(twoWordCase.clauses[0].newContainerIcon).toBe('pillowcase');
    expect(twoWordCase.clauses[0].isValid).toBe(true);

    // 2. Sequential pronoun placement on explicit new container
    const newAndPut = parseVoiceTranscript(
      'create new yellow bag with 4 brats and put it in canada',
      state
    );
    expect(newAndPut.clauses).toHaveLength(1);
    expect(newAndPut.clauses[0].intent).toBe('add');
    expect(newAndPut.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(newAndPut.clauses[0].resolvedNewContainerName).toBe('Yellow Bag');
    expect(newAndPut.clauses[0].selectedFreezerId).toBe('f-canada');
    expect(newAndPut.clauses[0].quantity).toBe(4);
    expect(newAndPut.clauses[0].selectedProductId).toBe('p-brats-mild');
    expect(newAndPut.clauses[0].isValid).toBe(true);

    // 3. Template-only without "new" ("add 4 broths to the red bag and put it in chest freezer")
    const templateAndPut = parseVoiceTranscript(
      'add 4 broths to the red bag and put it in chest freezer',
      state
    );
    expect(templateAndPut.clauses).toHaveLength(1);
    expect(templateAndPut.clauses[0].intent).toBe('add');
    expect(templateAndPut.clauses[0].newContainerGroupKey).toBeTruthy();
    expect(templateAndPut.clauses[0].selectedTemplateId).toBe('tpl-red-bag');
    expect(templateAndPut.clauses[0].resolvedNewContainerName).toBe('Red Bag');
    expect(templateAndPut.clauses[0].selectedFreezerId).toBe('f-chest');
    expect(templateAndPut.clauses[0].selectedProductId).toBe('p-chicken-broth');
    expect(templateAndPut.clauses[0].quantity).toBe(4);
    expect(templateAndPut.clauses[0].isValid).toBe(true);
    const tplActions = buildVoiceDispatchActions(templateAndPut.clauses, state);
    expect(tplActions).toHaveLength(2);
    expect(tplActions[0].type).toBe('ADD_CONTAINER');
    expect(tplActions[1].type).toBe('ADD_MEAT_CUT');

    // 4. Existing unambiguous container ("add 4 broths to blue tote and put it in chest freezer")
    const existingAndMove = parseVoiceTranscript(
      'add 4 broths to blue tote and put it in chest freezer',
      state
    );
    expect(existingAndMove.clauses).toHaveLength(2);
    expect(existingAndMove.clauses[0].intent).toBe('add');
    expect(existingAndMove.clauses[0].selectedDestContainerId).toBe('c-blue-canada');
    expect(existingAndMove.clauses[0].isValid).toBe(true);
    expect(existingAndMove.clauses[1].intent).toBe('move_container');
    expect(existingAndMove.clauses[1].selectedSourceContainerId).toBe('c-blue-canada');
    expect(existingAndMove.clauses[1].selectedFreezerId).toBe('f-chest');
    expect(existingAndMove.clauses[1].isValid).toBe(true);

    // 5. Unknown container + freezer ("add 4 broths to purple pillowcase and put it in chest freezer") -> zero dead end
    const unknownAndPut = parseVoiceTranscript(
      'add 4 broths to purple pillowcase and put it in chest freezer',
      state
    );
    expect(unknownAndPut.clauses[0].intent).toBe('add');
    expect(unknownAndPut.clauses[0].isValid).toBe(false);
    expect(unknownAndPut.clauses[0].suggestedFreezerId).toBe('f-chest');
    expect(unknownAndPut.clauses[0].suggestedTemplateCandidates?.length).toBeGreaterThan(0);
    expect(
      unknownAndPut.clauses[0].suggestedTemplateCandidates?.some(t => t.isCustom)
    ).toBe(true);
  });

  it('defaults to existing container with same product, supports 1-tap new container switch, and prevents dead ends across all intents', () => {
    state.containerTemplates = [
      { id: 'tpl-red-bag', name: 'Red Bag', icon: 'pillowcase' },
    ];
    state.containers.push(
      { id: 'c-red-canada', name: 'Red Bag', freezerId: 'f-canada', templateId: 'tpl-red-bag', icon: 'pillowcase' },
      { id: 'c-red-chest', name: 'Red Bag', freezerId: 'f-chest', templateId: 'tpl-red-bag', icon: 'pillowcase' }
    );
    // Move Chicken Broth stock so ONLY Red Bag (Canada) stocks Chicken Broth
    state.meatCuts = state.meatCuts.filter(mc => mc.productId !== 'p-chicken-broth');
    state.meatCuts.push({
      id: 'mc-red-canada-broth',
      productId: 'p-chicken-broth',
      quantity: 3,
      containerId: 'c-red-canada',
    });

    // 1. Multiple same-named containers -> defaults to Red Bag (Canada) because it already holds Chicken Broth
    const sameNameDefault = parseVoiceTranscript('add 4 broths to red bag', state);
    expect(sameNameDefault.clauses[0].intent).toBe('add');
    expect(sameNameDefault.clauses[0].selectedDestContainerId).toBe('c-red-canada');
    expect(sameNameDefault.clauses[0].requiresDestLocationSelection).toBe(false);
    expect(sameNameDefault.clauses[0].canSwitchToNewContainer).toBe(true);
    expect(sameNameDefault.clauses[0].destLocationCandidates[0].hasMatchingProduct).toBe(true);
    expect(sameNameDefault.clauses[0].destLocationCandidates[0].existingProductQty).toBe(3);
    expect(sameNameDefault.clauses[0].isValid).toBe(true);

    // 2. Omitted destination -> still defaults to Red Bag (Canada) holding Chicken Broth
    const omittedDest = parseVoiceTranscript('add 4 broths', state);
    expect(omittedDest.clauses[0].intent).toBe('add');
    expect(omittedDest.clauses[0].selectedDestContainerId).toBe('c-red-canada');
    expect(omittedDest.clauses[0].requiresDestLocationSelection).toBe(false);
    expect(omittedDest.clauses[0].isValid).toBe(true);

    // 3. 1-tap switch to New Container + Location with duplicate-name warning in Canada & clean placement in Chest
    const switchedPrompt = parseVoiceTranscript('add 4 broths to red bag', state, {
      'clause-0-0': { createNewContainer: true },
    });
    expect(switchedPrompt.clauses[0].newContainerGroupKey).toBe('switch-clause-0-0');
    expect(switchedPrompt.clauses[0].switchedFromExistingAdd).toBe(true);
    expect(switchedPrompt.clauses[0].requiresFreezerSelection).toBe(true);
    expect(switchedPrompt.clauses[0].selectedTemplateId).toBe('tpl-red-bag');
    expect(switchedPrompt.clauses[0].isValid).toBe(false);

    const switchedSameFreezer = parseVoiceTranscript('add 4 broths to red bag', state, {
      'clause-0-0': {
        createNewContainer: true,
        templateId: 'tpl-red-bag',
        freezerId: 'f-canada',
      },
    });
    expect(switchedSameFreezer.clauses[0].isValid).toBe(true);
    expect(switchedSameFreezer.clauses[0].warningMessage).toContain('Red Bag');
    expect(switchedSameFreezer.clauses[0].warningMessage).toContain('Canada');

    const switchedOtherFreezer = parseVoiceTranscript('add 4 broths to red bag', state, {
      'clause-0-0': {
        createNewContainer: true,
        templateId: 'tpl-red-bag',
        freezerId: 'f-display',
      },
    });
    expect(switchedOtherFreezer.clauses[0].isValid).toBe(true);
    expect(switchedOtherFreezer.clauses[0].warningMessage).toBeUndefined();
    const switchedActions = buildVoiceDispatchActions(switchedOtherFreezer.clauses, state);
    expect(switchedActions).toHaveLength(2);
    expect(switchedActions[0].type).toBe('ADD_CONTAINER');
    expect(switchedActions[1].type).toBe('ADD_MEAT_CUT');

    // 4. Zero dead ends on unknown destination ("add 3 ribeye to magenta" preserves guard + gives recovery suggestions)
    const magentaAdd = parseVoiceTranscript('add 3 ribeye to magenta', state);
    expect(magentaAdd.clauses[0].intent).toBe('add');
    expect(magentaAdd.clauses[0].newContainerGroupKey).toBeUndefined();
    expect(magentaAdd.clauses[0].destLocationCandidates).toHaveLength(0);
    expect(magentaAdd.clauses[0].isValid).toBe(false);
    expect(magentaAdd.clauses[0].suggestedTemplateCandidates?.some(t => t.isCustom)).toBe(true);
    expect((magentaAdd.clauses[0].suggestedFallbackLocations || []).length).toBeGreaterThan(0);

    const magentaRecovered = parseVoiceTranscript('add 3 ribeye to magenta', state, {
      'clause-0-0': {
        createNewContainer: true,
        templateId: '__custom__',
        customContainerName: 'Magenta',
        freezerId: 'f-canada',
      },
    });
    expect(magentaRecovered.clauses[0].isValid).toBe(true);
    expect(magentaRecovered.clauses[0].resolvedNewContainerName).toBe('Magenta');
    expect(buildVoiceDispatchActions(magentaRecovered.clauses, state).map(a => a.type)).toEqual([
      'ADD_CONTAINER',
      'ADD_MEAT_CUT',
    ]);

    // 5. Zero dead ends on zero stock in spoken source ("remove 2 hotdogs from display")
    const noStockDisplay = parseVoiceTranscript('remove 2 hotdogs from display', state);
    expect(noStockDisplay.clauses[0].isValid).toBe(false);
    expect(
      noStockDisplay.clauses[0].suggestedFallbackLocations?.some(
        l => l.containerId === 'c-orange-canada'
      )
    ).toBe(true);
    const noStockRecovered = parseVoiceTranscript('remove 2 hotdogs from display', state, {
      'clause-0-0': { sourceContainerId: 'c-orange-canada' },
    });
    expect(noStockRecovered.clauses[0].isValid).toBe(true);
    expect(noStockRecovered.clauses[0].selectedMeatCutId).toBe('mc-canada-hotdogs');

    // 6. Zero dead ends on misspelled product in add & query
    const misspelledAdd = parseVoiceTranscript('add 2 chiken soup to blue tote', state);
    expect(misspelledAdd.clauses[0].isValid).toBe(false);
    expect(
      misspelledAdd.clauses[0].suggestedFallbackProducts?.some(
        p => p.product.id === 'p-chicken-broth'
      )
    ).toBe(true);
    const misspelledAddFixed = parseVoiceTranscript('add 2 chiken soup to blue tote', state, {
      'clause-0-0': { productId: 'p-chicken-broth' },
    });
    expect(misspelledAddFixed.clauses[0].isValid).toBe(true);
    expect(misspelledAddFixed.clauses[0].selectedDestContainerId).toBe('c-blue-canada');

    const misspelledQuery = parseVoiceTranscript('how many riby cow', state);
    expect(misspelledQuery.clauses[0].intent).toBe('query');
    expect(misspelledQuery.clauses[0].isValid).toBe(false);
    expect(
      misspelledQuery.clauses[0].suggestedFallbackProducts?.some(
        p => p.product.id === 'p-ribeye'
      )
    ).toBe(true);
    const misspelledQueryFixed = parseVoiceTranscript('how many riby cow', state, {
      'clause-0-0': { productId: 'p-ribeye' },
    });
    expect(misspelledQueryFixed.clauses[0].isValid).toBe(true);
    expect(misspelledQueryFixed.clauses[0].queryResults?.[0].product.id).toBe('p-ribeye');

    // 7. Partial / unknown fragment recovery via fallbackIntent without retyping
    const partialFragment = parseVoiceTranscript('4 broths', state);
    expect(partialFragment.clauses[0].intent).toBe('unknown');
    expect(partialFragment.clauses[0].quantity).toBe(4);
    expect(
      partialFragment.clauses[0].suggestedFallbackProducts?.some(
        p => p.product.id === 'p-chicken-broth'
      )
    ).toBe(true);

    const partialAsAdd = parseVoiceTranscript('4 broths', state, {
      'clause-0-0': {
        fallbackIntent: 'add',
        productId: 'p-chicken-broth',
      },
    });
    expect(partialAsAdd.clauses[0].intent).toBe('add');
    expect(partialAsAdd.clauses[0].quantity).toBe(4);
    expect(partialAsAdd.clauses[0].selectedDestContainerId).toBe('c-red-canada');
    expect(partialAsAdd.clauses[0].isValid).toBe(true);

    const partialAsQuery = parseVoiceTranscript('4 broths', state, {
      'clause-0-0': {
        fallbackIntent: 'query',
        productId: 'p-chicken-broth',
      },
    });
    expect(partialAsQuery.clauses[0].intent).toBe('query');
    expect(partialAsQuery.clauses[0].isValid).toBe(true);
  });
});








