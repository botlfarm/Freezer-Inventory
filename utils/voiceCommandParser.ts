import { Action, Category, Container, CustomList, Freezer, InventoryState, MeatCut, Product, Tag, VoiceDictionaryEntry } from '../types';
import {
  compareBackstockForDisplayRestock,
  compareCutsForRemoval,
  getCutExcludedRestockTags,
  getCutPrioritizedTags,
  getExcludedFromDisplayRestockTagIds,
  getPrioritizeItemTagIds,
  isCutExcludedFromDisplayRestock,
  isCutPrioritized,
} from './tagRestockRules';

export type VoiceIntentType =
  | 'remove'
  | 'move'
  | 'add'
  | 'set_quantity'
  | 'add_container'
  | 'empty_container'
  | 'move_all'
  | 'move_container'
  | 'combine_containers'
  | 'swap_containers'
  | 'rename_container'
  | 'archive_container'
  | 'delete_container'
  | 'restock_display'
  | 'manage_list'
  | 'manage_tag'
  | 'correct_label'
  | 'undo_last'
  | 'container_query'
  | 'list_query'
  | 'inventory_alert_query'
  | 'query'
  | 'unknown';

export type MatchReason = 'exact' | 'prefix' | 'tokens' | 'substring' | 'fuzzy';

export interface VoiceProductMatch {
  product: Product;
  score: number;
  matchReason: MatchReason;
  isExact: boolean;
  totalOnSiteQty: number;
  locationStockQty: number;
}

export interface VoiceLocationCandidate {
  containerId: string;
  containerName: string;
  freezerId?: string;
  freezerName: string;
  isDisplay: boolean;
  isLoose: boolean;
  isStaging: boolean;
  score: number;
  matchReason: MatchReason;
  isExact: boolean;
  label: string;
  hasPrioritized?: boolean;
  hasMatchingProduct?: boolean;
  existingProductQty?: number;
}

export interface VoiceFreezerCandidate {
  freezerId: string; // '__staging__' for unassigned / Staging Area
  freezerName: string;
  isDisplay: boolean;
  isStaging: boolean;
  score: number;
  matchReason: MatchReason;
  isExact: boolean;
}

export interface VoiceContainerTemplateCandidate {
  templateId: string; // '__custom__' for new custom container without template
  name: string;
  icon: string;
  imageUrl?: string;
  isCustom: boolean;
  score: number;
  matchReason: MatchReason;
  isExact: boolean;
}

export interface VoiceCutCandidate {
  meatCut: MeatCut;
  product: Product;
  container: Container;
  freezer?: Freezer;
  locationLabel: string;
  tags: Tag[];
}

export interface VoiceContainerCutSummary {
  meatCut: MeatCut;
  product: Product;
  quantity: number;
  containerId: string;
  containerLabel: string;
  tags: Tag[];
}

export interface VoiceCombineSlot {
  slotIndex: number;
  query: string;
  candidates: VoiceLocationCandidate[];
  selectedContainerId: string | null;
  requiresSelection: boolean;
}

export interface VoiceContainerQueryResult {
  containerId: string;
  containerName: string;
  freezerId?: string;
  freezerName: string;
  isDisplay: boolean;
  isLoose: boolean;
  isStaging: boolean;
  label: string;
  totalPieces: number;
  items: VoiceContainerCutSummary[];
}

export interface VoiceQueryLocationBreakdown {
  containerId: string;
  containerName: string;
  freezerId?: string;
  freezerName: string;
  isDisplay: boolean;
  isStaging: boolean;
  quantity: number;
  notes?: string;
  tags: Tag[];
}

export interface VoiceQueryProductResult {
  product: Product;
  score: number;
  matchReason: MatchReason;
  totalQuantity: number;
  locations: VoiceQueryLocationBreakdown[];
}

export interface VoiceCustomListCandidate {
  list: CustomList;
  score: number;
  matchReason: MatchReason;
  isExact: boolean;
}

export interface VoiceListQueryItemSummary {
  product: Product;
  currentOnSiteQty: number;
  threshold?: number;
  controlSource?: string;
  notifyEnabled?: boolean;
  notes?: string;
}

export interface VoiceListQueryResult {
  list: CustomList;
  items: VoiceListQueryItemSummary[];
  checkedProduct?: Product;
  isProductOnList?: boolean;
}

export interface VoiceRestockAllocation {
  meatCut: MeatCut;
  product: Product;
  container: Container;
  freezer?: Freezer;
  locationLabel: string;
  moveQty: number;
  availableQty: number;
  tags?: Tag[];
}

export interface VoiceAlertQueryItem {
  product: Product;
  targetLocationQty: number;
  totalOnSiteQty: number;
  backstockQty: number;
  backstockLocations: Array<{ containerId: string; label: string; quantity: number; hasPrioritized?: boolean }>;
}

export interface VoiceTagCandidate {
  tag: Tag;
  score: number;
  matchReason: MatchReason;
  isExact: boolean;
}

export interface VoiceCategoryQueryResult {
  categoryName: string;
  categoryType: 'primary' | 'sub';
  totalQuantity: number;
  items: VoiceQueryProductResult[];
}

export interface VoiceTagQueryResult {
  tag: Tag;
  totalQuantity: number;
  items: VoiceContainerCutSummary[];
}

export interface VoiceSelectionOverrides {
  productId?: string | null;
  replacementProductId?: string | null;
  sourceContainerId?: string | null;
  destContainerId?: string | null;
  meatCutId?: string | null;
  freezerId?: string | null;
  templateId?: string | null;
  listId?: string | null;
  tagId?: string | null;
  customContainerName?: string;
  saveAsTemplate?: boolean;
  containerImageUrl?: string;
  containerIcon?: string;
  existingSpareContainerId?: string;
  combineSlotSelections?: Record<number, string>;
  quantity?: number;
  excluded?: boolean;
  createNewContainer?: boolean;
  fallbackIntent?: 'add' | 'remove' | 'move' | 'query' | 'move_container';
}

export interface ParsedVoiceClause {
  id: string;
  rawText: string;
  intent: VoiceIntentType;
  quantity: number;
  isAllQuantity?: boolean;
  adjustDirection?: 'up' | 'down' | 'neutral';
  missingTargetQuantity?: boolean;
  productQuery: string;
  sourceLocationQuery?: string;
  destLocationQuery?: string;

  productCandidates: VoiceProductMatch[];
  selectedProductId: string | null;
  requiresProductSelection: boolean;

  sourceLocationCandidates: VoiceLocationCandidate[];
  selectedSourceContainerId: string | null;
  requiresSourceLocationSelection: boolean;

  destLocationCandidates: VoiceLocationCandidate[];
  selectedDestContainerId: string | null;
  requiresDestLocationSelection: boolean;

  cutCandidates: VoiceCutCandidate[];
  selectedMeatCutId: string | null;
  requiresCutSelection: boolean;

  // Flexible container-level operations (empty / move_all / move_container / combine_containers / swap / rename / archive / delete / container_query)
  containerCutPreviews?: VoiceContainerCutSummary[];
  combineSlots?: VoiceCombineSlot[];
  combineExplicitTarget?: boolean;
  combineTargetQuery?: string;
  containerQueryResults?: VoiceContainerQueryResult[];
  containerQueryMode?: 'contents' | 'location' | 'count' | 'empty' | 'staging';
  containerQueryTargetLabel?: string;
  newContainerNameInput?: string;
  archiveState?: boolean;
  exceptProductQueries?: string[];
  excludedProductIds?: string[];

  // Custom list operations & queries
  listAction?: 'add' | 'remove' | 'set_threshold' | 'enable_notify' | 'disable_notify';
  listQueryText?: string;
  listCandidates?: VoiceCustomListCandidate[];
  selectedListId?: string | null;
  requiresListSelection?: boolean;
  listThreshold?: number;
  listQueryResults?: VoiceListQueryResult[];

  // Guided display restock & low/out-of-stock alert queries
  restockAllocations?: VoiceRestockAllocation[];
  restockRuleNote?: string;
  alertQueryMode?:
    | 'display_out_of_stock'
    | 'display_low_stock'
    | 'needs_restock'
    | 'global_out_of_stock'
    | 'global_low_stock';
  alertThreshold?: number;
  alertQueryResults?: VoiceAlertQueryItem[];

  // Tag management, wrong-label correction & category/tag queries
  tagAction?: 'add' | 'remove';
  tagQueryText?: string;
  tagCandidates?: VoiceTagCandidate[];
  selectedTagId?: string | null;
  requiresTagSelection?: boolean;
  replacementProductQuery?: string;
  replacementProductCandidates?: VoiceProductMatch[];
  selectedReplacementProductId?: string | null;
  requiresReplacementProductSelection?: boolean;
  categoryQueryResults?: VoiceCategoryQueryResult[];
  tagQueryResults?: VoiceTagQueryResult[];

  // Quick undo confirmation context
  undoTargetDescription?: string;
  undoTargetTimestamp?: string;

  // Strict-keyword new container creation fields
  newContainerGroupKey?: string;
  newContainerNameQuery?: string;
  newContainerFreezerQuery?: string;
  explicitTemplateRequested?: boolean;
  switchedFromExistingAdd?: boolean;
  canSwitchToNewContainer?: boolean;
  freezerCandidates?: VoiceFreezerCandidate[];
  selectedFreezerId?: string | null;
  requiresFreezerSelection?: boolean;
  templateCandidates?: VoiceContainerTemplateCandidate[];
  selectedTemplateId?: string | null;
  requiresTemplateSelection?: boolean;
  resolvedNewContainerName?: string;
  newContainerSaveAsTemplate?: boolean;
  newContainerImageUrl?: string;
  newContainerIcon?: string;
  selectedExistingSpareContainerId?: string;

  // Non-dead-end fallback & template suggestions when primary match is missing/partial
  suggestedTemplateCandidates?: VoiceContainerTemplateCandidate[];
  suggestedFreezerId?: string | null;
  suggestedFallbackProducts?: VoiceProductMatch[];
  suggestedFallbackLocations?: VoiceLocationCandidate[];
  suggestedFallbackFreezers?: VoiceFreezerCandidate[];
  inferredFallbackProductQuery?: string;
  inferredFallbackLocationQuery?: string;
  inferredFallbackFreezerQuery?: string;

  queryResults?: VoiceQueryProductResult[];
  queryLocationFilter?: string;

  // Optional 1-to-many Voice Dictionary product pack / bundle provenance
  pinnedProductId?: string;
  bundlePhrase?: string;

  isValid: boolean;
  excluded: boolean;
  errorMessage?: string;
  warningMessage?: string;
}

export interface ParsedVoiceResult {
  rawTranscript: string;
  clauses: ParsedVoiceClause[];
  hasMutations: boolean;
  hasQueries: boolean;
  readyMutationCount: number;
  pendingSelectionCount: number;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  too: 2,
  three: 3,
  four: 4,
  for: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ate: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  couple: 2,
};

const TENS_WORDS = new Set(['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']);
const ONES_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']);

const UNIT_FILLER_WORDS = new Set([
  'pack', 'packs', 'package', 'packages', 'pkg', 'pkgs',
  'bag', 'bags', 'box', 'boxes', 'case', 'cases',
  'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces',
  'piece', 'pieces', 'pc', 'pcs', 'unit', 'units',
  'of', 'the', 'some', 'please', 'item', 'items',
]);

const SPECIFIC_CONTAINER_NOUNS = [
  'bin',
  'box',
  'bag',
  'pillowcase',
  'tote',
  'bucket',
  'crate',
  'tray',
  'tub',
  'cooler',
  'basket',
  'carton',
  'pouch',
  'sack',
  'canister',
  'jar',
  'pan',
  'sleeve',
  'holder',
  'organizer',
  'rack',
  'shelf',
  'drawer',
] as const;

const SPECIFIC_CONTAINER_NOUN_PATTERN = SPECIFIC_CONTAINER_NOUNS.join('|');
const ALL_CONTAINER_NOUN_PATTERN = `(?:container|${SPECIFIC_CONTAINER_NOUN_PATTERN})`;
const ALL_CONTAINER_NOUN_PLURAL_PATTERN =
  '(?:containers?|bins?|box(?:es)?|bags?|pillowcases?|totes?|buckets?|crates?|trays?|tubs?|coolers?|baskets?|cartons?|pouch(?:es)?|sacks?|canisters?|jars?|pans?|sleeves?|holders?|organizers?|racks?|shel(?:f|ves)|drawers?)';
const PLURAL_CONTAINER_GROUP_PREFIX_PATTERN =
  '(?:containers?|bins|boxes|bags|pillowcases|totes|buckets|crates|trays|tubs|coolers|baskets|cartons|pouches|sacks|canisters|jars|pans|sleeves|holders|organizers|racks|shelves|drawers)';
const NEW_CONTAINER_CREATE_VERBS = 'create|make|start|open|build|set\\s*up|setup';

const ACTION_VERBS = [
  'remove', 'take', 'took', 'deduct', 'subtract', 'minus', 'sell', 'sold', 'pull', 'pulled', 'grab', 'grabbed',
  'checkout', 'use', 'used', 'zero\\s+out', 'wipe\\s+out', 'clean\\s+out', 'consume', 'consumed', 'discard', 'write\\s+off',
  'sold\\s+out\\s+of', 'ran\\s+out\\s+of',
  'move', 'transfer', 'relocate', 'shift', 'bring', 'carry', 'transport', 'haul',
  'empty', 'clear', 'unload', 'unpack', 'dump',
  'combine', 'merge', 'consolidate', 'swap', 'trade', 'switch', 'exchange',
  'rename', 'archive', 'unarchive', 'restore', 'delete', 'retire', 'unplace', 'stage',
  'tag', 'untag', 'relabel', 're-label', 'replenish', 'fill(?:\\s+up)?', 'top\\s+(?:off|up)', 'refill',
  'undo', 'roll\\s*back', 'revert',
  'adjust', 'reduce', 'decrease', 'increase', 'raise', 'bump', 'boost',
  'change', 'update', 'edit', 'modify', 'reconcile', 'reset', 'correct', 'recount',
  'bring\\s+down', 'knock\\s+down', 'bring\\s+up',
  'set(?=\\s+(?:(?:the|my|our|all)\\s+)?(?:quantity|quantities|qty|inventory|stock|count|counts|amount|amounts|level|levels|.+?threshold)\\b|\\s+.+?\\s+(?:by|(?:down\\s+|up\\s+)?to|=)\\s*)',
  'lower(?=\\s+(?:(?:the|my|our|all)\\s+)?(?:quantity|quantities|qty|inventory|stock|count|counts|amount|amounts|level|levels)\\b|\\s+.+?\\s+(?:by|(?:down\\s+|up\\s+)?to|=)\\s*)',
  'drop(?=\\s+(?:(?:the|my|our|all)\\s+)?(?:quantity|quantities|qty|inventory|stock|count|counts|amount|amounts|level|levels)\\b|\\s+.+?\\s+(?:by|(?:down\\s+|up\\s+)?to|=)\\s*|\\s+.+?\\s+(?:in|into|to|from|off)\\s+)',
  'add', 'put', 'restock', 'plus', 'pack', 'packed', 'receive', 'received', 'inbound', 'inbounded', 'toss', 'stash', 'insert', 'enter', 'log',
  `(?:${NEW_CONTAINER_CREATE_VERBS})\\s+(?:a\\s+)?(?:new\\s+)?(?:(?:[a-z0-9#-]+\\s+){0,3})?${ALL_CONTAINER_NOUN_PATTERN}`,
  `new\\s+(?:(?:[a-z0-9#-]+\\s+){0,3})?${ALL_CONTAINER_NOUN_PATTERN}`,
  'alert\\s+(?:me|us)', 'notify\\s+(?:me|us)', 'warn\\s+(?:me|us)',
  'turn\\s+(?:on|off)', 'mute', 'unmute', 'silence', 'enable', 'disable',
];

const QUERY_TRIGGERS = [
  'how many', 'how much', 'how\\s+(?:is|are|\'s)', 'do we have', 'do i have', 'do we still have', 'do i still have',
  'have we got', 'got any', 'any\\s+.+?\\s+left', 'are there', 'is there',
  'what(?:\'|\\s)?s\\s+(?:in|inside|on|tagged|out\\s+of|running\\s+low|getting\\s+low|low|empty|missing|the\\s+(?:count|stock|inventory))',
  'what\\s+is\\s+(?:in|inside|on|tagged|out\\s+of|running\\s+low|getting\\s+low|low|empty|missing)',
  'what\\s+are\\s+(?:in|on|we\\s+(?:out\\s+of|running\\s+low|low)|the\\s+(?:lists?|empty))',
  `what\\s+(?:${ALL_CONTAINER_NOUN_PLURAL_PATTERN}|items?|lists?|needs?\\s+(?:to\\s+be\\s+)?restock|did\\s+(?:we|i)|(?:do|should|can)\\s+(?:we|i)\\s+(?:need\\s+to\\s+)?restock)`,
  `which\\s+(?:${ALL_CONTAINER_NOUN_PLURAL_PATTERN}|items?|lists?)`, 'does\\s+anything', 'anything\\s+(?:low|out|need|in)',
  'check\\s+stock', 'check\\s+count', 'check\\s+(?:a\\s+|the\\s+|my\\s+|our\\s+|all\\s+|custom\\s+)?lists?', 'check', 'count', 'total', 'list', 'inspect', 'read', 'open', 'view',
  'where do (?:i|we|you) (?:have|keep|store)', 'where have (?:i|we) got', 'where did (?:i|we) (?:put|store|keep)',
  'where is', 'where are', "where's", 'wheres', 'where can (?:i|we) (?:find|get)', 'where (?:in|inside|at)',
  'find me', 'find', 'locate', 'show me', 'show', 'search for', 'look up', 'are we out of',
];

const SHORTHAND_CANONICAL_MAP: Record<string, string> = {
  wo: 'without',
  wout: 'without',
  sm: 'small',
  sml: 'small',
  med: 'medium',
  md: 'medium',
  lg: 'large',
  lrg: 'large',
  cntr: 'container',
  cont: 'container',
  bkt: 'bucket',
  bx: 'box',
  cab: 'cabinet',
  shlf: 'shelf',
  drwr: 'drawer',
  frzr: 'freezer',
  disp: 'display',
  blk: 'black',
  blu: 'blue',
  grn: 'green',
  ylw: 'yellow',
  prp: 'purple',
  purp: 'purple',
  wht: 'white',
  brn: 'brown',
  brwn: 'brown',
  gry: 'gray',
  grey: 'gray',
  uppr: 'upper',
  lwr: 'lower',
  btm: 'bottom',
  ctr: 'center',
  frt: 'front',
  lft: 'left',
  rgt: 'right',
  misc: 'miscellaneous',
  asstd: 'assorted',
  assrt: 'assorted',
  reg: 'regular',
  std: 'standard',
  orig: 'original',
  bnls: 'boneless',
  bnlss: 'boneless',
  sknls: 'skinless',
  sknlss: 'skinless',
  grnd: 'ground',
  smkd: 'smoked',
  frzn: 'frozen',
  chkn: 'chicken',
  chk: 'chicken',
  trky: 'turkey',
  bf: 'beef',
  prk: 'pork',
  jlp: 'jalapeno',
  jal: 'jalapeno',
  brkfst: 'breakfast',
  bkfst: 'breakfast',
  ital: 'italian',
  saus: 'sausage',
  saug: 'sausage',
  shldr: 'shoulder',
  tndr: 'tenderloin',
  tndrl: 'tenderloin',
  brst: 'breast',
  chz: 'cheese',
  bbq: 'barbecue',
  seasd: 'seasoned',
  qty: 'quantity',
  num: 'number',
  nbr: 'number',
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
};

const SHORTHAND_AMBIGUOUS_ALIASES: Record<string, string[]> = {
  w: ['with'],
  n: ['and'],
  org: ['orange', 'organic'],
  frz: ['freezer', 'frozen'],
  pt: ['part', 'pint'],
  no: ['number'],
  bk: ['back', 'black'],
  rt: ['right'],
  lt: ['left', 'light'],
  ch: ['chicken', 'cheese', 'chuck'],
  mar: ['marinated'],
  smk: ['smoked', 'smoke'],
  stk: ['steak'],
  rst: ['roast'],
  rm: ['room'],
};

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[’']/g, '')
    // Expand slash and symbol shorthand before punctuation removal ("w/" -> "with", "w/o" -> "without", etc.)
    .replace(/(^|[\s,(])w\s*\/\s*(?:out|o)(?=$|[\s,.)a-z0-9])/gi, '$1 without ')
    .replace(/(^|[\s,(])w\s*\/(?=$|[\s,.)a-z0-9])/gi, '$1 with ')
    .replace(/(^|[\s,(])b\s*\/\s*i(?=$|[\s,.)a-z0-9])/gi, '$1 bone in ')
    .replace(/(^|[\s,(])b\s*\/\s*l(?=$|[\s,.)a-z0-9])/gi, '$1 boneless ')
    .replace(/(^|[\s,(])c\s*\/\s*o(?=$|[\s,.)a-z0-9])/gi, '$1 care of ')
    .replace(/\bxl\b/gi, 'extra large')
    .replace(/&/g, ' and ')
    .replace(/([a-z0-9])\s*\+\s*([a-z0-9])/gi, '$1 and $2')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str: string): string[] {
  return normalizeText(str)
    .split(/\s+/)
    .filter(Boolean);
}

function stripUnitFillers(str: string): string {
  const tokens = tokenize(str);
  const filtered = tokens.filter((t, idx) => {
    if (UNIT_FILLER_WORDS.has(t)) {
      // Keep "of" if it's in the middle of something meaningful unless preceded by a unit word
      if (t === 'of' && idx > 0 && !UNIT_FILLER_WORDS.has(tokens[idx - 1])) {
        return true;
      }
      return false;
    }
    return true;
  });
  return filtered.join(' ').trim();
}

/**
 * Simple Levenshtein edit distance for local typo/speech-transcription tolerance.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && !word.endsWith('ses') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function canonicalizeToken(word: string): string {
  const s = singularize(word);
  return SHORTHAND_CANONICAL_MAP[word] || SHORTHAND_CANONICAL_MAP[s] || s;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordBoundaryChar(ch: string | undefined): boolean {
  if (!ch) return true;
  return !/[a-z0-9]/i.test(ch);
}

function runSingleRewritePass(
  text: string,
  regex: RegExp,
  replacementLookup: Map<string, string>
): string {
  regex.lastIndex = 0;
  let result = '';
  let lastCursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const prevChar = start > 0 ? text[start - 1] : undefined;
    const nextChar = end < text.length ? text[end] : undefined;

    if (isWordBoundaryChar(prevChar) && isWordBoundaryChar(nextChar)) {
      const normalizedKey = match[0].replace(/\s+/g, ' ').trim().toLowerCase();
      const replacement = replacementLookup.get(normalizedKey);
      if (replacement !== undefined) {
        result += text.slice(lastCursor, start) + replacement;
        lastCursor = end;
        continue;
      }
    }
    // Not at a clean word boundary: advance minimally and keep original char
    result += text.slice(lastCursor, start + 1);
    lastCursor = start + 1;
    regex.lastIndex = start + 1;
  }

  result += text.slice(lastCursor);
  return result;
}

/**
 * Deterministically rewrites spoken custom command & phrase rules before parsing
 * (longest match first, bounded up to 2 passes so command shortcuts compose cleanly with phrase aliases).
 */
export function applyCustomPhraseDictionary(transcript: string, state: InventoryState): string {
  if (!transcript) return transcript;
  const entries = (state.voiceDictionary || []).filter(
    e =>
      (e.targetType === 'command' || e.targetType === 'phrase') &&
      e.spokenPhrase?.trim() &&
      e.replacementText?.trim()
  );
  if (entries.length === 0) return transcript;

  const sorted = [...entries].sort(
    (a, b) => b.spokenPhrase.trim().length - a.spokenPhrase.trim().length
  );

  const replacementLookup = new Map<string, string>();
  const patterns: string[] = [];
  for (const entry of sorted) {
    const phrase = entry.spokenPhrase.trim();
    const key = phrase.toLowerCase();
    if (!replacementLookup.has(key)) {
      replacementLookup.set(key, entry.replacementText!.trim());
      patterns.push(escapeRegExp(phrase).replace(/\s+/g, '\\s+'));
    }
  }
  if (patterns.length === 0) return transcript;

  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
  const firstPass = runSingleRewritePass(transcript, regex, replacementLookup);
  if (firstPass === transcript) return firstPass;

  const secondPass = runSingleRewritePass(firstPass, regex, replacementLookup);
  return secondPass === transcript ? firstPass : secondPass;
}

function scoreNameWithAliases(
  queryRaw: string,
  canonicalName: string,
  aliases: string[] = [],
  options?: { keepUnitTokens?: boolean }
): { score: number; reason: MatchReason; isExact: boolean } | null {
  let best = scoreNameMatch(queryRaw, canonicalName, options);
  for (const alias of aliases) {
    const m = scoreNameMatch(queryRaw, alias, options);
    if (m && (!best || m.score > best.score || (m.isExact && !best.isExact))) {
      best = m;
    }
  }
  return best;
}

function scoreNameMatch(
  queryRaw: string,
  targetRaw: string,
  options?: { keepUnitTokens?: boolean }
): { score: number; reason: MatchReason; isExact: boolean } | null {
  const query = normalizeText(queryRaw);
  const target = normalizeText(targetRaw);
  if (!query || !target) return null;

  if (query === target) {
    return { score: 100, reason: 'exact', isExact: true };
  }

  const querySingular = tokenize(query).map(singularize).join(' ');
  const targetSingular = tokenize(target).map(singularize).join(' ');
  if (querySingular && querySingular === targetSingular) {
    return { score: 98, reason: 'exact', isExact: true };
  }

  const queryCanon = tokenize(query).map(canonicalizeToken).join(' ');
  const targetCanon = tokenize(target).map(canonicalizeToken).join(' ');
  if (queryCanon && queryCanon === targetCanon) {
    return { score: 97, reason: 'exact', isExact: true };
  }

  if (target.startsWith(query) || targetCanon.startsWith(queryCanon)) {
    return { score: 88, reason: 'prefix', isExact: false };
  }

  if (target.includes(query) || targetCanon.includes(queryCanon)) {
    return { score: 82, reason: 'substring', isExact: false };
  }

  // Token-level matching
  const rawQTokens = tokenize(query);
  const filteredQTokens = options?.keepUnitTokens
    ? rawQTokens.filter(t => t !== 'the' && t !== 'a' && t !== 'an')
    : rawQTokens.filter(t => !UNIT_FILLER_WORDS.has(t));
  const qTokens = filteredQTokens.length > 0 ? filteredQTokens : rawQTokens;
  const tTokens = tokenize(target);
  if (qTokens.length === 0 || tTokens.length === 0) return null;

  let matchedTokenScore = 0;
  let allTokensMatched = true;

  for (const qt of qTokens) {
    const qSing = singularize(qt);
    const qCanon = canonicalizeToken(qt);
    const qAliases = SHORTHAND_AMBIGUOUS_ALIASES[qt] || [];
    let bestToken = 0;
    for (const tt of tTokens) {
      const tSing = singularize(tt);
      const tCanon = canonicalizeToken(tt);
      const tAliases = SHORTHAND_AMBIGUOUS_ALIASES[tt] || [];

      if (qt === tt || qSing === tSing || qCanon === tCanon) {
        bestToken = Math.max(bestToken, 1.0);
      } else if (
        qAliases.includes(tt) ||
        qAliases.includes(tSing) ||
        qAliases.includes(tCanon) ||
        tAliases.includes(qt) ||
        tAliases.includes(qSing) ||
        tAliases.includes(qCanon)
      ) {
        bestToken = Math.max(bestToken, 0.92);
      } else if (
        tCanon.startsWith(qCanon) ||
        (qCanon.length >= 3 && tCanon.includes(qCanon)) ||
        (qSing.length >= 3 && tSing.includes(qSing))
      ) {
        bestToken = Math.max(bestToken, 0.85);
      } else if (qCanon.length >= 4 && tCanon.length >= 4) {
        const qTokDigits = (qCanon.match(/\d+/g) || []).join(',');
        const tTokDigits = (tCanon.match(/\d+/g) || []).join(',');
        const dist = editDistance(qCanon, tCanon);
        const maxLen = Math.max(qCanon.length, tCanon.length);
        if (qTokDigits === tTokDigits && (dist <= 1 || (maxLen >= 6 && dist <= 2))) {
          bestToken = Math.max(bestToken, 0.65);
        }
      }
    }
    if (bestToken === 0) {
      allTokensMatched = false;
      break;
    }
    matchedTokenScore += bestToken;
  }

  if (allTokensMatched) {
    const avg = matchedTokenScore / qTokens.length;
    const coverageBonus = Math.min(10, Math.round((qTokens.length / tTokens.length) * 10));
    const reason: MatchReason = avg >= 0.9 ? 'tokens' : 'fuzzy';
    return {
      score: Math.round(avg * 70) + coverageBonus,
      reason,
      isExact: false,
    };
  }

  // Whole-phrase condensed fuzzy match (handles "hot dogs" vs "hotdogs")
  const compactQuery = qTokens.map(canonicalizeToken).join('');
  const compactTarget = tTokens.map(canonicalizeToken).join('');
  if (compactQuery.length >= 4) {
    if (compactTarget === compactQuery) {
      return { score: 96, reason: 'exact', isExact: true };
    }
    if (compactTarget.includes(compactQuery)) {
      return { score: 78, reason: 'substring', isExact: false };
    }
    const qDigits = (compactQuery.match(/\d+/g) || []).join(',');
    const tDigits = (compactTarget.match(/\d+/g) || []).join(',');
    const dist = editDistance(compactQuery, compactTarget);
    if (qDigits === tDigits && dist <= 2 && compactQuery.length >= 5) {
      return { score: 62, reason: 'fuzzy', isExact: false };
    }
  }

  return null;
}

/**
 * Parse a leading quantity from a phrase, supporting digits and English number words.
 * Examples:
 * - "2 brats" -> { quantity: 2, rest: "brats" }
 * - "twenty four hotdogs" -> { quantity: 24, rest: "hotdogs" }
 * - "a dozen eggs" -> { quantity: 12, rest: "eggs" }
 * - "to brats" (when allowToAsTwo=true) -> { quantity: 2, rest: "brats" }
 */
function stripPoliteLeadIn(str: string): string {
  let prev = '';
  let cur = str.trim();
  while (cur !== prev) {
    prev = cur;
    cur = cur
      .replace(
        /^(?:hey|hi|hello|ok(?:ay)?|alright|well|so|please|pls|can\s+(?:you|we)|could\s+(?:you|we)|would\s+you|will\s+you|do\s+you\s+know|can\s+you\s+tell\s+me|could\s+you\s+tell\s+me|tell\s+me|go\s+ahead\s+and|help\s+me|let'?s|let\s+me|i\s+need\s+(?:you\s+)?to|we\s+need\s+to|i\s+want\s+to|we\s+want\s+to|i'?d\s+like\s+(?:you\s+)?to|i\s+would\s+like\s+(?:you\s+)?to|make\s+sure\s+(?:to|you)|just|quickly)\s+/i,
        ''
      )
      .trim();
  }
  return cur;
}

function cleanLocationFragment(raw: string): string {
  return raw
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLeadingQuantity(
  phrase: string,
  options?: { allowToAsTwo?: boolean; defaultQty?: number }
): { quantity: number; hasExplicitQuantity: boolean; isAllQuantity?: boolean; rest: string } {
  const trimmed = phrase.trim();
  if (!trimmed) {
    return { quantity: options?.defaultQty ?? 1, hasExplicitQuantity: false, rest: '' };
  }

  // 0. Flexible "all / the rest of / remaining" quantity phrases
  const allMatch = trimmed.match(
    /^(?:all\s+(?:of\s+)?(?:the\s+)?(?:remaining\s+)?|all\s+remaining\s+|the\s+rest\s+of\s+(?:the\s+)?|rest\s+of\s+(?:the\s+)?|remaining\s+|every\s+)(.+)$/i
  );
  if (allMatch && allMatch[1].trim()) {
    return {
      quantity: 1,
      hasExplicitQuantity: true,
      isAllQuantity: true,
      rest: allMatch[1].trim(),
    };
  }

  // 1. Numeric digit prefix (e.g. "2 brats", "12x ribeye", "3.5" -> round/int)
  const digitMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:x\b)?\s*(.*)$/i);
  if (digitMatch) {
    const num = Math.max(1, Math.round(parseFloat(digitMatch[1])));
    return { quantity: num, hasExplicitQuantity: true, rest: digitMatch[2].trim() };
  }

  // 2. Word numbers
  const words = trimmed.split(/\s+/);
  const w0 = words[0].toLowerCase().replace(/[^a-z-]/g, '');
  const w1 = words[1]?.toLowerCase().replace(/[^a-z-]/g, '') || '';

  // "a dozen ..."
  if ((w0 === 'a' || w0 === 'one') && w1 === 'dozen') {
    return { quantity: 12, hasExplicitQuantity: true, rest: words.slice(2).join(' ').trim() };
  }
  // "half dozen ..."
  if (w0 === 'half' && w1 === 'dozen') {
    return { quantity: 6, hasExplicitQuantity: true, rest: words.slice(2).join(' ').trim() };
  }
  // "a couple [of] ..."
  if (w0 === 'a' && w1 === 'couple') {
    const w2 = words[2]?.toLowerCase().replace(/[^a-z-]/g, '') || '';
    const skipOf = w2 === 'of' ? 3 : 2;
    return { quantity: 2, hasExplicitQuantity: true, rest: words.slice(skipOf).join(' ').trim() };
  }
  // "couple of ..."
  if (w0 === 'couple') {
    const skipOf = w1 === 'of' ? 2 : 1;
    return { quantity: 2, hasExplicitQuantity: true, rest: words.slice(skipOf).join(' ').trim() };
  }
  // Hyphenated "twenty-one"
  if (w0.includes('-')) {
    const [p1, p2] = w0.split('-');
    if (TENS_WORDS.has(p1) && ONES_WORDS.has(p2)) {
      return {
        quantity: NUMBER_WORDS[p1] + NUMBER_WORDS[p2],
        hasExplicitQuantity: true,
        rest: words.slice(1).join(' ').trim(),
      };
    }
  }
  // Compound "twenty one"
  if (TENS_WORDS.has(w0) && ONES_WORDS.has(w1)) {
    return {
      quantity: NUMBER_WORDS[w0] + NUMBER_WORDS[w1],
      hasExplicitQuantity: true,
      rest: words.slice(2).join(' ').trim(),
    };
  }
  // Single number word
  if (w0 === 'to') {
    if (options?.allowToAsTwo && words.length > 1) {
      return { quantity: 2, hasExplicitQuantity: true, rest: words.slice(1).join(' ').trim() };
    }
  } else if (w0 in NUMBER_WORDS && words.length > 1) {
    // Avoid swallowing "a" if the next word is not an item or if it's "for" before a location
    if (w0 === 'for') {
      // Only treat "for" as 4 if followed by something that looks like an item and preceded by an action verb
      if (options?.allowToAsTwo) {
        return { quantity: 4, hasExplicitQuantity: true, rest: words.slice(1).join(' ').trim() };
      }
    } else {
      return { quantity: NUMBER_WORDS[w0], hasExplicitQuantity: true, rest: words.slice(1).join(' ').trim() };
    }
  }

  return { quantity: options?.defaultQty ?? 1, hasExplicitQuantity: false, rest: trimmed };
}

function startsWithNumberToken(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^\d+/.test(trimmed)) return true;
  const first = trimmed.split(/\s+/)[0].toLowerCase().replace(/[^a-z-]/g, '');
  if (!first) return false;
  if (first === 'to' || first === 'for') return false;
  if (first in NUMBER_WORDS) return true;
  if (first.includes('-')) {
    const [p1, p2] = first.split('-');
    if (TENS_WORDS.has(p1) && ONES_WORDS.has(p2)) return true;
  }
  return false;
}

const SPLIT_NUMBER_WORDS = new Set(
  Object.keys(NUMBER_WORDS).filter(k => k !== 'a' && k !== 'an' && k !== 'to' && k !== 'for' && k !== 'zero')
);

const MEASUREMENT_ONLY_WORDS = new Set([
  ...UNIT_FILLER_WORDS,
  'g', 'kg', 'gram', 'grams', 'in', 'inch', 'inches', 'percent', 'ct', 'count',
  'and', 'or', '&',
]);

const LOCATION_PREP_WORDS = new Set(['from', 'to', 'into', 'in', 'at', 'with', 'containing', 'having']);

function cleanSplitToken(tok: string | undefined): string {
  return (tok || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Returns how many tokens form an unambiguous quantity expression at `tokens[idx]`,
 * or 0 if `tokens[idx]` does not start a clear quantity expression.
 */
function getQuantityTokenSpan(tokens: string[], idx: number, allowBareArticles = false): number {
  if (idx >= tokens.length) return 0;
  const w0 = cleanSplitToken(tokens[idx]);
  const w1 = cleanSplitToken(tokens[idx + 1]);
  const w2 = cleanSplitToken(tokens[idx + 2]);
  if (!w0) return 0;

  if (/^\d+(?:\.\d+)?x?$/i.test(w0)) {
    const val = parseFloat(w0);
    return !isNaN(val) && (allowBareArticles || val > 0) ? 1 : 0;
  }

  if ((w0 === 'a' || w0 === 'one') && w1 === 'dozen') return 2;
  if (w0 === 'half' && w1 === 'dozen') return 2;
  if (w0 === 'a' && w1 === 'couple') return w2 === 'of' ? 3 : 2;
  if (w0 === 'couple') return w1 === 'of' ? 2 : 1;

  if (w0.includes('-')) {
    const [p1, p2] = w0.split('-');
    if (TENS_WORDS.has(p1) && ONES_WORDS.has(p2)) return 1;
  }

  if (TENS_WORDS.has(w0) && ONES_WORDS.has(w1)) return 2;

  if (SPLIT_NUMBER_WORDS.has(w0)) return 1;

  if (allowBareArticles && (w0 === 'a' || w0 === 'an')) return 1;

  return 0;
}

function hasTrailingProductContentBeforeNextItem(tokens: string[], afterQtyIdx: number): boolean {
  if (afterQtyIdx >= tokens.length) return false;
  const immediate = cleanSplitToken(tokens[afterQtyIdx]);
  if (!immediate || LOCATION_PREP_WORDS.has(immediate)) return false;

  for (let j = afterQtyIdx; j < tokens.length; j++) {
    const clean = cleanSplitToken(tokens[j]);
    if (!clean) continue;
    if ((clean === 'and' || clean === '&') && j > afterQtyIdx && getQuantityTokenSpan(tokens, j + 1, true) > 0) {
      break;
    }
    if (j > afterQtyIdx && getQuantityTokenSpan(tokens, j, false) > 0) {
      break;
    }
    if (!MEASUREMENT_ONLY_WORDS.has(clean)) {
      return true;
    }
  }
  return false;
}

/**
 * Split multi-item lists like "2 brats, 1 belly, 3 ground pork and 1 chicken broth"
 * as well as unpunctuated microphone dictation like "one hotdog one liver and one belly bacon"
 * without splitting product names containing "and" (e.g. "2 mac and cheese and 1 broth")
 * or trailing measurements (e.g. "2 ribeye 16 oz").
 */
function splitItemClauses(body: string): string[] {
  const commaParts = body
    .split(/\s*,\s*/)
    .map(p => p.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const part of commaParts) {
    const tokens = part.split(/\s+/).filter(Boolean);
    let current: string[] = [];
    let currentHasQty = false;
    let currentHasItemWord = false;

    for (let i = 0; i < tokens.length; i++) {
      const tokClean = cleanSplitToken(tokens[i]);

      // 1. At the start of an item chunk, consume any single/multi-token leading quantity intact
      if (current.length === 0) {
        const startQtySpan = getQuantityTokenSpan(tokens, i, true);
        if (startQtySpan > 0 && i + startQtySpan < tokens.length) {
          current.push(...tokens.slice(i, i + startQtySpan));
          currentHasQty = true;
          currentHasItemWord = false;
          i += startQtySpan - 1;
          continue;
        }
        if (
          tokClean === 'all' ||
          tokClean === 'every' ||
          tokClean === 'remaining' ||
          tokClean === 'to' ||
          (tokClean === 'the' && cleanSplitToken(tokens[i + 1]) === 'rest') ||
          (tokClean === 'rest' && cleanSplitToken(tokens[i + 1]) === 'of')
        ) {
          currentHasQty = true;
        }
        current.push(tokens[i]);
        if (tokClean && !MEASUREMENT_ONLY_WORDS.has(tokClean) && !currentHasQty) {
          currentHasItemWord = true;
        }
        continue;
      }

      // 2. Explicit separator "and" / "&" followed by a quantity expression -> split item
      if ((tokClean === 'and' || tokClean === '&') && i + 1 < tokens.length) {
        const remaining = tokens.slice(i + 1).join(' ');
        const nextQtySpan = getQuantityTokenSpan(tokens, i + 1, true);
        if ((nextQtySpan > 0 || startsWithNumberToken(remaining)) && current.length > 0) {
          result.push(current.join(' ').trim());
          current = [];
          currentHasQty = false;
          currentHasItemWord = false;
          continue;
        }
      }

      // 3. Comma-less speech boundary: current item has qty + >= 1 product word, and next token starts a new qty + product words
      if (currentHasQty && currentHasItemWord) {
        const nextQtySpan = getQuantityTokenSpan(tokens, i, false);
        if (nextQtySpan > 0 && hasTrailingProductContentBeforeNextItem(tokens, i + nextQtySpan)) {
          result.push(current.join(' ').trim());
          current = tokens.slice(i, i + nextQtySpan);
          currentHasQty = true;
          currentHasItemWord = false;
          i += nextQtySpan - 1;
          continue;
        }
      }

      current.push(tokens[i]);
      if (tokClean && !MEASUREMENT_ONLY_WORDS.has(tokClean)) {
        currentHasItemWord = true;
      }
    }

    if (current.length > 0) {
      result.push(current.join(' ').trim());
    }
  }
  return result.filter(Boolean);
}

const HEADER_INVENTORY_CHANGE_VERBS =
  'adjust|reduce|decrease|lower|drop|increase|raise|bump|boost|change|update|edit|modify|reconcile|reset|correct|recount|set';

const HEADER_VERB_PATTERN =
  `(?:move|transfer|relocate|shift|bring|carry|transport|haul|remove|take|took|deduct|subtract|minus|sell|sold|pull|pulled|grab|grabbed|check\\s*out|checkout|use|used|consume|consumed|cook|cooked|discard|write\\s+off|add|put|restock|plus|pack|packed|receive|received|inbound|inbounded|stock|toss|place|load|store|stash|enter|log|${HEADER_INVENTORY_CHANGE_VERBS}|(?:${NEW_CONTAINER_CREATE_VERBS})(?=\\s+(?:a\\s+)?(?:new\\s+)?(?:(?:[a-z0-9#-]+\\s+){0,3})?${ALL_CONTAINER_NOUN_PATTERN}\\b)|new(?=\\s+(?:(?:[a-z0-9#-]+\\s+){0,3})?${ALL_CONTAINER_NOUN_PATTERN}\\b))`;

interface ParsedLineHeader {
  verbPrefix: string;
  locSuffix: string;
  intentType: 'remove' | 'move' | 'add' | 'add_container' | 'set_quantity';
  foldItemsIntoSingleCommand?: boolean;
}

interface ParsedNewContainerStatement {
  spokenNoun: string;
  containerNameQuery: string;
  freezerQuery?: string;
  itemsPart?: string;
  explicitTemplateRequested: boolean;
  inferredIcon: string;
}

function normalizeContainerNounPluralRegex(noun: string): RegExp {
  const lower = noun.toLowerCase();
  if (lower === 'shelf') return /\bshel(?:f|ves)\b/i;
  if (lower === 'box' || lower === 'pouch') return new RegExp(`\\b${lower}(?:es)?\\b`, 'i');
  return new RegExp(`\\b${lower}s?\\b`, 'i');
}

function buildSpokenNewContainerName(spokenNoun: string, rawNameBody: string): string {
  const cleanedTail = rawNameBody.replace(/\s+/g, ' ').trim();
  const explicitNamedMatch = cleanedTail.match(/^(?:named|called)\s+(.+)$/i);
  if (explicitNamedMatch) {
    return explicitNamedMatch[1].trim();
  }

  const lowerNoun = spokenNoun.toLowerCase();
  if (!lowerNoun || lowerNoun === 'container') {
    return cleanedTail || 'New Container';
  }
  if (!cleanedTail) {
    return spokenNoun;
  }
  if (normalizeContainerNounPluralRegex(lowerNoun).test(cleanedTail)) {
    return cleanedTail;
  }
  return `${spokenNoun} ${cleanedTail}`;
}

function inferContainerIconFromNoun(noun?: string): string {
  const lower = (noun || '').toLowerCase();
  if (!lower || lower === 'container' || lower === 'box' || lower === 'crate' || lower === 'carton') {
    return 'box';
  }
  if (lower === 'bag' || lower === 'sack' || lower === 'pillowcase') return 'pillowcase';
  if (lower === 'pouch') return 'pouch';
  if (
    lower === 'bin' ||
    lower === 'tote' ||
    lower === 'tub' ||
    lower === 'bucket' ||
    lower === 'cooler' ||
    lower === 'basket'
  ) {
    return 'bin';
  }
  if (lower === 'tray' || lower === 'pan') return 'tray';
  if (lower === 'rack' || lower === 'shelf' || lower === 'drawer') return 'grid';
  return 'box';
}

function inferContainerIconFromName(rawName?: string): string {
  if (!rawName) return 'box';
  const match = rawName.match(new RegExp(`\\b(${ALL_CONTAINER_NOUN_PATTERN})\\b`, 'i'));
  return inferContainerIconFromNoun(match?.[1]);
}

function singularizeSpecificContainerNoun(pluralNoun: string): string {
  const lower = pluralNoun.toLowerCase().trim();
  if (lower === 'shelves' || lower === 'shelf') return 'shelf';
  if (lower === 'boxes' || lower === 'box') return 'box';
  if (lower === 'pouches' || lower === 'pouch') return 'pouch';
  if (lower.endsWith('s') && lower.length > 3) return lower.slice(0, -1);
  return lower;
}

function splitContainerWithItems(body: string): { left: string; itemsPart?: string } {
  const keywordRegex = /\b(?:with|containing|having)\s+|(?:^|\s)w\s*\/\s*/gi;
  let match: RegExpExecArray | null;
  while ((match = keywordRegex.exec(body)) !== null) {
    const splitEnd = match.index + match[0].length;
    const after = body.slice(splitEnd).trim();
    if (after && startsWithNumberToken(after)) {
      return {
        left: body.slice(0, match.index).trim(),
        itemsPart: after,
      };
    }
  }
  return { left: body.trim() };
}

function extractFreezerAndNameFromLeft(
  containerAndFreezer: string,
  itemsPart: string | undefined,
  state?: InventoryState
): { namePart: string; freezerQuery?: string; itemsPart?: string } {
  let namePart = containerAndFreezer.trim();
  let freezerQuery: string | undefined;
  let finalItemsPart = itemsPart;

  const freezerInContainerMatch = namePart.match(/^(.+?)\s+\b(?:in|into|to|inside|at)\s+(.+)$/i);
  if (freezerInContainerMatch) {
    namePart = freezerInContainerMatch[1].trim();
    freezerQuery = freezerInContainerMatch[2].trim();
  } else if (finalItemsPart && state) {
    // Allow trailing "in <freezer>" after items when none was placed after container name,
    // e.g. "add container yellow bag with 4 liverwurst in freezer canada"
    const trailingFreezerMatch = finalItemsPart.match(/^(.+?)\s+\b(?:in|into|to|inside|at)\s+(.+)$/i);
    if (trailingFreezerMatch) {
      const candFreezer = trailingFreezerMatch[2].trim();
      if (resolveOnSiteFreezerCandidates(candFreezer, state).length > 0) {
        finalItemsPart = trailingFreezerMatch[1].trim();
        freezerQuery = candFreezer;
      }
    }
  }

  return { namePart, freezerQuery, itemsPart: finalItemsPart };
}

function parseContainerFirstTarget(
  input: string,
  state?: InventoryState,
  options?: { isHeaderLine?: boolean; itemsAlreadyExtracted?: string }
): ParsedNewContainerStatement | null {
  const cleaned = input.replace(/^(?:please\s+)?/i, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  // 1. Type-noun-first: "create new box yellow in freezer 1 with 4 brats", "make new bag green with 6 hotdogs", "add container yellow bag ..."
  const nounFirstRegex = new RegExp(
    `^(?:(add|${NEW_CONTAINER_CREATE_VERBS})\\s+(?:a\\s+)?(new\\s+)?(${ALL_CONTAINER_NOUN_PATTERN})|(new)\\s+(${ALL_CONTAINER_NOUN_PATTERN}))(?:\\s+(from\\s+template|template))?(?:\\s+(.*))?$`,
    'i'
  );
  const nounFirstMatch = cleaned.match(nounFirstRegex);
  if (nounFirstMatch) {
    const verb = (nounFirstMatch[1] || nounFirstMatch[4] || '').toLowerCase().replace(/\s+/g, ' ');
    const hasNew = Boolean(nounFirstMatch[2] || nounFirstMatch[4]);
    const spokenNoun = (nounFirstMatch[3] || nounFirstMatch[5] || 'container').toLowerCase();
    const explicitTemplateRequested = Boolean(nounFirstMatch[6]);
    const rawRest = (nounFirstMatch[7] || '').trim();

    if (/^of\b/i.test(rawRest)) {
      return null;
    }

    const split =
      options?.itemsAlreadyExtracted !== undefined
        ? { left: rawRest, itemsPart: options.itemsAlreadyExtracted }
        : splitContainerWithItems(rawRest);

    if (verb === 'add' && !hasNew && !explicitTemplateRequested && spokenNoun !== 'container') {
      const hasItemsWithClause = Boolean(split.itemsPart);
      const isPlainItemHeader = Boolean(options?.isHeaderLine) && /\b(?:to|into)\s+/i.test(rawRest);
      if (!hasItemsWithClause && !(options?.isHeaderLine && !isPlainItemHeader)) {
        return null;
      }
    }

    if (verb === 'make' && !hasNew && !explicitTemplateRequested && hasTargetQtyExpression(split.left)) {
      return null;
    }

    if (!split.left && !split.itemsPart && !explicitTemplateRequested) {
      return null;
    }

    const { namePart, freezerQuery, itemsPart } = extractFreezerAndNameFromLeft(
      split.left,
      split.itemsPart,
      state
    );
    const containerNameQuery = buildSpokenNewContainerName(spokenNoun, namePart);
    return {
      spokenNoun,
      containerNameQuery,
      freezerQuery,
      itemsPart,
      explicitTemplateRequested,
      inferredIcon: inferContainerIconFromNoun(spokenNoun),
    };
  }

  // 2. Modifier-before-noun: "create a yellow box in freezer 1 with 4 brats", "make a new green bag with 6 hotdogs", "new red tote w/ lid in canada with 2 ribeye"
  const modBeforeNounRegex = new RegExp(
    `^(?:(${NEW_CONTAINER_CREATE_VERBS})\\s+(?:a\\s+)?(new\\s+)?|(add)\\s+(?:a\\s+)?(new\\s+)?|(new)\\s+)(?:(from\\s+template|template)\\s+)?(.+)$`,
    'i'
  );
  const modMatch = cleaned.match(modBeforeNounRegex);
  if (modMatch) {
    const verb = (modMatch[1] || modMatch[3] || modMatch[5] || '').toLowerCase().replace(/\s+/g, ' ');
    const hasNew = Boolean(modMatch[2] || modMatch[4] || modMatch[5]);
    const explicitTemplateRequested = Boolean(modMatch[6]);
    const rawRest = (modMatch[7] || '').trim();
    if (!rawRest) return null;

    const split =
      options?.itemsAlreadyExtracted !== undefined
        ? { left: rawRest, itemsPart: options.itemsAlreadyExtracted }
        : splitContainerWithItems(rawRest);

    if (verb === 'add' && !hasNew && !explicitTemplateRequested && !split.itemsPart) {
      return null;
    }

    if (hasTargetQtyExpression(split.left)) {
      return null;
    }

    const { namePart, freezerQuery, itemsPart } = extractFreezerAndNameFromLeft(
      split.left,
      split.itemsPart,
      state
    );
    if (!namePart) return null;

    const nounSplitMatch = namePart.match(
      new RegExp(`^(.+?)\\s+\\b(${ALL_CONTAINER_NOUN_PATTERN})\\b(?:\\s+(.*))?$`, 'i')
    );
    if (!nounSplitMatch) return null;

    const beforeNoun = nounSplitMatch[1].trim();
    const spokenNoun = nounSplitMatch[2].toLowerCase();
    const afterNoun = (nounSplitMatch[3] || '').trim();
    const beforeWords = beforeNoun.split(/\s+/).filter(Boolean);

    if (beforeWords.length === 0 || beforeWords.length > 4) return null;
    if (startsWithNumberToken(beforeNoun)) return null;
    if (/\b(?:from|with|by|of|all|every|existing)\b/i.test(beforeNoun)) return null;
    if (/^of\b/i.test(afterNoun)) return null;

    return {
      spokenNoun,
      containerNameQuery: namePart,
      freezerQuery,
      itemsPart,
      explicitTemplateRequested,
      inferredIcon: inferContainerIconFromNoun(spokenNoun),
    };
  }

  return null;
}

function parseNewContainerStatement(
  segment: string,
  state?: InventoryState,
  options?: { isHeaderLine?: boolean }
): ParsedNewContainerStatement | null {
  const firstResult = parseContainerFirstTarget(segment, state, options);
  if (firstResult) return firstResult;

  if (options?.isHeaderLine) return null;

  // 3. Items-first: "inbound 3 ribeye into new box yellow in chest freezer", "put 6 hotdogs in a new green bag"
  const itemsFirstMatch = segment.match(
    /^(?:please\s+)?(?:add|put|restock|plus|pack|packed|receive|received|inbound|inbounded|stock|toss|place|load|store|stash|enter|log)\s+(.+?)\s+\b(?:to|into|in)\s+(?:a\s+)?(new\s+.+)$/i
  );
  if (itemsFirstMatch) {
    const itemsPart = itemsFirstMatch[1].trim();
    const newTargetPhrase = itemsFirstMatch[2].trim();
    return parseContainerFirstTarget(newTargetPhrase, state, {
      itemsAlreadyExtracted: itemsPart,
    });
  }

  return null;
}

function parseHeaderPhrase(rawHeader: string): ParsedLineHeader | null {
  const cleaned = rawHeader
    .replace(/^(?:please\s+)?/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  // Strict new-container header (e.g. "Add container yellow bag in freezer canada:" or "Create new box yellow in freezer 1:")
  const parsedNewHeader = parseContainerFirstTarget(cleaned, undefined, { isHeaderLine: true });
  if (parsedNewHeader && !parsedNewHeader.itemsPart) {
    return {
      verbPrefix: cleaned,
      locSuffix: '',
      intentType: 'add_container',
      foldItemsIntoSingleCommand: true,
    };
  }
  if (parsedNewHeader) {
    return null;
  }

  const verbMatch = cleaned.match(new RegExp(`^(${HEADER_VERB_PATTERN})(?:\\s+(.*))?$`, 'i'));
  if (!verbMatch) {
    const prepFirst = cleaned.match(
      /^(?:from|in|at)\s+(.+?)[,\s]+(remove|take|took|deduct|subtract|minus|sell|sold|pull|pulled|grab|grabbed|check\s*out|checkout|use|used)$/i
    );
    if (prepFirst) {
      return {
        verbPrefix: prepFirst[2].trim(),
        locSuffix: `from ${prepFirst[1].trim()}`,
        intentType: 'remove',
      };
    }
    return null;
  }

  const verb = verbMatch[1].trim();
  const rest = (verbMatch[2] || '').trim();
  const lowerVerb = verb.toLowerCase().replace(/\s+/g, '');

  const isInvChange = [
    'adjust', 'reduce', 'decrease', 'lower', 'drop', 'increase', 'raise', 'bump', 'boost',
    'change', 'update', 'edit', 'modify', 'reconcile', 'reset', 'correct', 'recount', 'set',
  ].includes(lowerVerb);
  const isMove = ['move', 'transfer', 'relocate', 'shift', 'bring', 'carry', 'transport', 'haul'].includes(lowerVerb);
  const isAdd = [
    'add', 'put', 'restock', 'plus', 'pack', 'packed', 'receive', 'received',
    'inbound', 'inbounded', 'stock', 'toss', 'place', 'load', 'store', 'stash', 'enter', 'log',
  ].includes(lowerVerb);

  if (isInvChange) {
    // Support headers like "Adjust inventory:", "Adjust inventory in display:", "Set stock in box green:", "Update in display:"
    const nounStrip = rest.match(
      /^(?:(?:the|my|our|all)\s+)?(?:quantity|quantities|qty|inventory|stock(?:\s+levels?)?|count|counts|amount|amounts|level|levels)(?:\s+(?:of|for|on))?(?:\s+(.*))?$/i
    );
    const effectiveVerbPrefix = nounStrip ? `${verb} inventory` : verb;
    const afterNoun = (nounStrip ? nounStrip[1] || '' : rest).trim();
    if (!afterNoun) {
      return { verbPrefix: effectiveVerbPrefix, locSuffix: '', intentType: 'set_quantity' };
    }
    if (/^(?:in|inside|at|from|of)\s+.+$/i.test(afterNoun)) {
      const normalizedLocSuffix = afterNoun.replace(/^of\s+/i, 'in ').trim();
      return {
        verbPrefix: effectiveVerbPrefix,
        locSuffix: normalizedLocSuffix,
        intentType: 'set_quantity',
      };
    }
    return null;
  }

  const intentType: 'remove' | 'move' | 'add' = isMove ? 'move' : isAdd ? 'add' : 'remove';

  if (!rest) {
    return { verbPrefix: verb, locSuffix: '', intentType };
  }

  if (intentType === 'remove' && /^(?:from|in|at)\s+.+$/i.test(rest)) {
    return { verbPrefix: verb, locSuffix: rest, intentType };
  }
  if (intentType === 'add' && /^(?:to|into|in|at)\s+.+$/i.test(rest)) {
    return { verbPrefix: verb, locSuffix: rest, intentType };
  }
  if (intentType === 'move' && /^(?:from|to|into)\s+.+$/i.test(rest)) {
    return { verbPrefix: verb, locSuffix: rest, intentType };
  }

  return null;
}

function stripBulletPrefix(line: string): string {
  // Strip markdown/note bullets ("- ", "* ", "• ", "· ") and numbered list prefixes when followed by a quantity word/digit
  return line
    .replace(/^[-*•·]+\s+/, '')
    .replace(
      /^\d+[.)]\s+(?=(?:\d|zero|one|two|too|three|four|five|six|seven|eight|ate|nine|ten|eleven|twelve|dozen|half|couple|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b)/i,
      ''
    )
    .trim();
}

function startsWithCommandOrQuery(line: string): boolean {
  const cleaned = stripPoliteLeadIn(line);
  if (parseContainerFirstTarget(cleaned, undefined, { isHeaderLine: true })) return true;
  const actionRegex = new RegExp(
    `^(?:${HEADER_VERB_PATTERN}|empty|clear|wipe|clean|unload|unpack|dump|combine|merge|consolidate|swap|trade|switch|exchange|rename|archive|unarchive|restore|delete|retire|unplace|stage|tag|untag|relabel|re-label|replenish|fill|top\\s+(?:off|up)|refill|undo|roll\\s*back|revert|zero\\s+out|sold\\s+out\\s+of|ran\\s+out\\s+of)\\b`,
    'i'
  );
  if (actionRegex.test(cleaned)) return true;
  const queryStartRegex = new RegExp(
    `^(?:how\\s+many|how\\s+much|how(?:'s|\\s+is|\\s+are)|what(?:'s|s|\\s+is|\\s+are)?\\s+(?:(?:the\\s+)?(?:count|stock|inventory)|inside|in|on|tagged|out\\s+of|running\\s+low|getting\\s+low|low|empty|missing|do\\s+(?:we|i)|items|lists?)\\b|what\\s+(?:do|should|can)\\s+(?:we|i)\\s+(?:need\\s+to\\s+)?restock|what\\s+did\\s+(?:we|i)|(?:what|which)\\s+(?:${ALL_CONTAINER_NOUN_PLURAL_PATTERN}|items?|lists?)\\b|anything\\s+(?:low|out|need|in)|does\\s+anything|count\\b|check\\b|total\\b|list\\b|inspect\\b|read\\b|open\\b|view\\b|is\\s+.+?\\s+on\\s+|do\\s+(?:we|i|you)\\s+(?:still\\s+)?have\\b|have\\s+(?:we|i)\\s+got\\b|got\\s+any\\b|are\\s+(?:there|we\\s+out\\s+of)\\b|is\\s+there\\b|where(?:'s|s|\\s+is|\\s+are|\\s+do\\s+(?:i|we|you)\\s+(?:have|keep|store)|\\s+have\\s+(?:i|we)\\s+got|\\s+did\\s+(?:i|we)\\s+(?:put|store|keep)|\\s+can\\s+(?:i|we)\\s+(?:find|get)|\\s+(?:in|inside|at)\\s+\\S+)\\b|find\\b|locate\\b|show\\s+(?:me|us)\\b|search\\s+for\\b|look\\s+up\\b)`,
    'i'
  );
  return queryStartRegex.test(cleaned);
}

/**
 * Extract leading location when user puts preposition + location BEFORE the items,
 * e.g. "remove from display 2 brats, 1 belly" or "add to chest freezer 3 ribeye".
 */
function tryExtractLeadingLocation(
  body: string,
  prepositions: string[],
  state: InventoryState,
  mode: 'source' | 'dest',
  options?: { allowProductAfterLoc?: boolean }
): { locQuery: string; remainingBody: string } | null {
  const prepPattern = prepositions.join('|');
  const match = body.match(new RegExp(`^(?:${prepPattern})\\s+(.+)$`, 'i'));
  if (!match) return null;

  const rest = match[1].trim();
  const words = rest.split(/\s+/);
  if (words.length < 2) return null;

  let best: { locQuery: string; remainingBody: string; score: number; wordCount: number } | null = null;

  for (let i = 1; i < words.length; i++) {
    const candidateLoc = words.slice(0, i).join(' ').replace(/[,:;]+$/, '').trim();
    const remaining = words.slice(i).join(' ').trim();
    if (!candidateLoc || !remaining) continue;
    const startsNum = startsWithNumberToken(remaining);
    const looksLikeBulkTail =
      options?.allowProductAfterLoc &&
      (startsNum ||
        /\s+(?:by|(?:down\s+|up\s+)?to)\s+/i.test(remaining) ||
        /=/.test(remaining) ||
        /,/.test(remaining));
    if (!startsNum && !looksLikeBulkTail) continue;

    const locMatches = resolveOnSiteLocationCandidates(candidateLoc, state, mode);
    if (locMatches.length > 0) {
      const topScore = locMatches[0].score;
      if (options?.allowProductAfterLoc && !startsNum && topScore < 85) continue;
      if (!best || topScore > best.score || (topScore === best.score && i > best.wordCount)) {
        best = { locQuery: candidateLoc, remainingBody: remaining, score: topScore, wordCount: i };
      }
    }
  }

  return best ? { locQuery: best.locQuery, remainingBody: best.remainingBody } : null;
}

/**
 * Split a full spoken/typed transcript into independent command segments
 * when multiple verbs, sentence boundaries, or multi-line header lists appear.
 */
function splitTopLevelCommands(transcript: string, state: InventoryState): string[] {
  const lines = transcript.split(/\r?\n/);
  const expandedLines: string[] = [];

  let activeHeader: ParsedLineHeader | null = null;
  let activeHeaderRaw = '';
  let activeHeaderConsumedItem = false;
  let activeFoldedItems: string[] = [];

  const flushActiveHeader = () => {
    if (!activeHeader) return;
    if (activeHeader.foldItemsIntoSingleCommand) {
      if (activeFoldedItems.length > 0) {
        expandedLines.push(`${activeHeader.verbPrefix} with ${activeFoldedItems.join(', ')}`);
      } else if (activeHeaderRaw) {
        expandedLines.push(activeHeaderRaw);
      }
    } else if (!activeHeaderConsumedItem && activeHeaderRaw) {
      expandedLines.push(activeHeaderRaw);
    }
    activeHeader = null;
    activeHeaderRaw = '';
    activeHeaderConsumedItem = false;
    activeFoldedItems = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx].trim();

    if (!rawLine) {
      // Blank line ends an already-consumed multi-line list block
      if (activeHeader && activeHeaderConsumedItem) {
        flushActiveHeader();
      }
      continue;
    }

    const strippedBullet = stripBulletPrefix(rawLine);

    // 1. Check for colon-delimited header (e.g. "Remove from display:" or "Add container yellow bag in canada: 4 liverwurst")
    const colonIdx = strippedBullet.indexOf(':');
    if (colonIdx !== -1) {
      const left = strippedBullet.slice(0, colonIdx).trim();
      const right = strippedBullet.slice(colonIdx + 1).trim();
      const header = parseHeaderPhrase(left);
      if (header) {
        flushActiveHeader();

        if (!right) {
          activeHeader = header;
          activeHeaderRaw = left;
          activeHeaderConsumedItem = false;
          activeFoldedItems = [];
          continue;
        } else {
          const cleanRight = stripBulletPrefix(right).replace(/[,;.]+\s*$/, '').trim();
          if (header.foldItemsIntoSingleCommand) {
            expandedLines.push(`${header.verbPrefix} with ${cleanRight}`);
            continue;
          }
          const hasOwnLoc =
            (header.intentType === 'remove' && /\bfrom\s+\S+/i.test(cleanRight)) ||
            (header.intentType === 'add' && /\b(?:to|into)\s+\S+/i.test(cleanRight)) ||
            (header.intentType === 'move' && /\bfrom\s+\S+/i.test(cleanRight) && /\b(?:to|into)\s+\S+/i.test(cleanRight)) ||
            (header.intentType === 'set_quantity' && /\b(?:in|inside|at|from)\s+\S+/i.test(cleanRight));
          if (header.intentType === 'set_quantity' && header.locSuffix && !hasOwnLoc) {
            expandedLines.push(`${header.verbPrefix} ${header.locSuffix}: ${cleanRight}`);
          } else {
            expandedLines.push(
              `${header.verbPrefix} ${cleanRight}${header.locSuffix && !hasOwnLoc ? ' ' + header.locSuffix : ''}`
            );
          }
          continue;
        }
      }
    }

    // 2. Check for no-colon header-only line (e.g. "Remove from display" or "Add container yellow bag in canada" followed by bullet/quantity lines)
    const noColonHeader = parseHeaderPhrase(strippedBullet);
    if (noColonHeader) {
      const afterVerb = strippedBullet
        .replace(new RegExp(`^(?:please\\s+)?${HEADER_VERB_PATTERN}\\s*`, 'i'), '')
        .trim();
      const hasInlineItemsAfterLoc =
        noColonHeader.intentType !== 'add_container' &&
        Boolean(
          tryExtractLeadingLocation(
            afterVerb,
            noColonHeader.intentType === 'add' ? ['to', 'into', 'in', 'at'] : ['from', 'in', 'at'],
            state,
            noColonHeader.intentType === 'add' ? 'dest' : 'source',
            { allowProductAfterLoc: noColonHeader.intentType === 'set_quantity' }
          )
        );

      if (!hasInlineItemsAfterLoc) {
        let nextNonEmpty: string | null = null;
        for (let j = idx + 1; j < lines.length; j++) {
          const candidate = lines[j].trim();
          if (candidate) {
            nextNonEmpty = candidate;
            break;
          }
        }
        const nextCleaned = nextNonEmpty ? stripBulletPrefix(nextNonEmpty) : '';
        const nextIsFollowUpItem =
          Boolean(nextNonEmpty) &&
          !startsWithCommandOrQuery(nextCleaned) &&
          (/^[-*•·]+\s+/.test(nextNonEmpty!) ||
            startsWithNumberToken(nextCleaned) ||
            (noColonHeader.intentType === 'set_quantity' &&
              (/\s+(?:by|(?:down\s+|up\s+)?to)\s+/i.test(nextCleaned) || /=/.test(nextCleaned))));

        if (nextIsFollowUpItem) {
          flushActiveHeader();
          activeHeader = noColonHeader;
          activeHeaderRaw = strippedBullet;
          activeHeaderConsumedItem = false;
          activeFoldedItems = [];
          continue;
        }
      }
    }

    // 3. If an active multi-line header is open, decide whether this line ends it or belongs to it
    if (activeHeader) {
      if (startsWithCommandOrQuery(strippedBullet)) {
        flushActiveHeader();
        expandedLines.push(strippedBullet);
        continue;
      }

      const cleanItem = strippedBullet
        .replace(/^(?:and|&)\s+/i, '')
        .replace(/[,;.]+\s*$/, '')
        .trim();

      if (cleanItem) {
        if (activeHeader.foldItemsIntoSingleCommand) {
          activeFoldedItems.push(cleanItem);
          activeHeaderConsumedItem = true;
        } else {
          const hasOwnLoc =
            (activeHeader.intentType === 'remove' && /\bfrom\s+\S+/i.test(cleanItem)) ||
            (activeHeader.intentType === 'add' && /\b(?:to|into)\s+\S+/i.test(cleanItem)) ||
            (activeHeader.intentType === 'move' && /\bfrom\s+\S+/i.test(cleanItem) && /\b(?:to|into)\s+\S+/i.test(cleanItem)) ||
            (activeHeader.intentType === 'set_quantity' && /\b(?:in|inside|at|from)\s+\S+/i.test(cleanItem));

          expandedLines.push(
            `${activeHeader.verbPrefix} ${cleanItem}${activeHeader.locSuffix && !hasOwnLoc ? ' ' + activeHeader.locSuffix : ''}`
          );
          activeHeaderConsumedItem = true;
        }
      }
      continue;
    }

    expandedLines.push(strippedBullet);
  }

  flushActiveHeader();

  const normalized = expandedLines
    .join('; ')
    .replace(/[.?!]+\s+/g, '; ')
    .trim();
  if (!normalized) return [];

  // Split by ";" or "then" first, then split on "and <command>" ONLY when not joining container names inside combine/merge
  const primaryParts = normalized
    .split(/(?:;|\bthen\b)/i)
    .map(s => s.trim())
    .filter(Boolean);

  const verbPattern = ACTION_VERBS.join('|');
  const queryPattern = QUERY_TRIGGERS.join('|');
  const andCommandSplitRegex = new RegExp(
    `\\band\\s+(?=(?:${verbPattern}|${queryPattern})\\b)`,
    'i'
  );

  const finalSegments: string[] = [];
  for (const part of primaryParts) {
    const cleanedPart = stripPoliteLeadIn(part);
    if (/^(?:combine|merge|consolidate|swap|trade|switch|exchange)\b/i.test(cleanedPart)) {
      // Do not split "combine containers Orange and Clear Bin" or "swap red bag and clear bin" on "and Clear"
      finalSegments.push(part);
      continue;
    }
    const subParts = part
      .split(andCommandSplitRegex)
      .map(s => s.trim())
      .filter(Boolean);
    finalSegments.push(...subParts);
  }
  return coalesceSequentialPlacementSegments(
    finalSegments.map(s => s.replace(/\bpillow\s+(cases?)\b/gi, 'pillow$1')),
    state
  );
}

const PRONOUN_PLACEMENT_REGEX = new RegExp(
  `^(?:then\\s+)?(?:put|place|move|set|drop|store|stash|put\\s+away)\\s+(?:it|that(?:\\s+(?:container|one|${SPECIFIC_CONTAINER_NOUN_PATTERN}))?|them)\\s+(?:in|into|inside|to|at)\\s+(.+?)\\s*[?!.]*$`,
  'i'
);

function coalesceSequentialPlacementSegments(
  segments: string[],
  state: InventoryState
): string[] {
  if (segments.length <= 1) return segments;
  const out: string[] = [];

  for (const rawSeg of segments) {
    const seg = rawSeg.trim();
    const prev = out[out.length - 1];
    const placementMatch = prev ? seg.match(PRONOUN_PLACEMENT_REGEX) : null;

    if (prev && placementMatch) {
      const targetFreezerPhrase = placementMatch[1].trim();
      const prevStripped = stripPoliteLeadIn(prev);

      // 1. Previous segment explicitly creates a new container (with or without location)
      const parsedNew = parseNewContainerStatement(prevStripped, state);
      if (parsedNew) {
        if (!parsedNew.freezerQuery) {
          const withMatch = prev.match(/^(.+?)\s+\b(with|containing|having)\s+(.+)$/i);
          if (withMatch) {
            out[out.length - 1] = `${withMatch[1].trim()} in ${targetFreezerPhrase} ${withMatch[2]} ${withMatch[3].trim()}`;
          } else {
            out[out.length - 1] = `${prev.replace(/[?!.]+\s*$/, '').trim()} in ${targetFreezerPhrase}`;
          }
          continue;
        }
      }

      // 2. Previous segment is an "add/put/pack/inbound ... to/into/in/at <dest>" command
      const addDestMatch = prevStripped.match(
        /^(add|put|restock|plus|pack|packed|receive|received|inbound|inbounded|stock|toss|place|load|store|stash|enter|log)\s+(.+?)\s+\b(?:to|into|in|at)\s+(.+?)\s*[?!.]*$/i
      );
      if (addDestMatch) {
        const itemsPart = addDestMatch[2].trim();
        const rawDest = addDestMatch[3].trim();
        const cleanDest = rawDest.replace(/^(?:the|an?)\s+/i, '').trim();

        const activeContMatches = resolveOnSiteLocationCandidates(cleanDest, state, 'dest').filter(
          l => !l.isLoose
        );
        const tplResolution = resolveNewContainerTemplates(cleanDest, state, false);
        const hasMatchedTemplate = tplResolution.candidates.some(
          c => !c.isCustom && c.score >= 65
        );

        if (activeContMatches.length === 0 && hasMatchedTemplate) {
          // Zero active containers match (e.g. only exists as a pillowcase/template) -> pack directly into new container in target freezer
          out[out.length - 1] = `inbound ${itemsPart} into new container ${cleanDest} in ${targetFreezerPhrase}`;
          continue;
        }

        if (activeContMatches.length > 0) {
          // Existing container(s) found -> add to existing (same-product preferred) AND move container to target freezer
          out.push(`move container ${cleanDest} to ${targetFreezerPhrase}`);
          continue;
        }

        // Neither active container nor template matched -> preserve both container name & target freezer for 1-tap suggestions
        out[out.length - 1] = `${prev.replace(/[?!.]+\s*$/, '').trim()} in ${targetFreezerPhrase}`;
        continue;
      }
    }

    out.push(seg);
  }

  return out;
}

export const VOICE_PRIMARY_DISPLAY_CONFIG_KEY = 'voice_primary_display_freezer_id';

const SINGULAR_DISPLAY_PHRASES = new Set([
  'display',
  'display case',
  'display freezer',
  'front display',
  'store display',
  'the display',
]);

const PLURAL_SPECIAL_FREEZER_PHRASES = new Set([
  'all displays',
  'all display',
  'all display freezers',
  'all display cases',
  'display freezers',
  'special freezers',
  'all special freezers',
  'specialty freezers',
  'all specialty freezers',
  'special displays',
  'all special displays',
]);

/**
 * Return the configured Primary Voice Display Freezer from appConfig if it still exists on-site.
 */
export function getPrimaryVoiceDisplayFreezer(state: InventoryState): Freezer | undefined {
  const configuredId = (state.appConfig || [])
    .find(c => c.key === VOICE_PRIMARY_DISPLAY_CONFIG_KEY)
    ?.value?.trim();
  if (!configuredId) return undefined;
  return (state.freezers || []).find(
    f => f.id === configuredId && !f.isPallet && !f.id.startsWith('pallet-')
  );
}

/**
 * Resolve singular ("display", "display case") and plural ("all displays", "special freezers") queries:
 * - Plural: gathers all Special / display-named on-site freezers together.
 * - Singular: 1) Configured Primary Display Setting -> 2) Literal name match ("Display" before differently named isSpecial freezers) -> 3) isSpecial fallback.
 */
function resolveDisplayFreezersForQuery(
  rawQuery: string,
  state: InventoryState
): {
  matched: boolean;
  isAllSpecialQuery: boolean;
  matchedFreezers: Freezer[];
} {
  const fullNorm = normalizeText(rawQuery);
  const norm = fullNorm.replace(/^the\s+/i, '').trim();
  if (!norm) {
    return { matched: false, isAllSpecialQuery: false, matchedFreezers: [] };
  }

  const onSiteFreezers = (state.freezers || []).filter(
    f => !f.isPallet && !f.id.startsWith('pallet-')
  );

  if (PLURAL_SPECIAL_FREEZER_PHRASES.has(norm) || PLURAL_SPECIAL_FREEZER_PHRASES.has(fullNorm)) {
    const matchedFreezers = onSiteFreezers.filter(
      f => f.isSpecial || normalizeText(f.name).includes('display')
    );
    return { matched: true, isAllSpecialQuery: true, matchedFreezers };
  }

  if (SINGULAR_DISPLAY_PHRASES.has(norm) || SINGULAR_DISPLAY_PHRASES.has(fullNorm)) {
    const primary = getPrimaryVoiceDisplayFreezer(state);
    if (primary) {
      return { matched: true, isAllSpecialQuery: false, matchedFreezers: [primary] };
    }

    const exactNormMatches = onSiteFreezers.filter(f => normalizeText(f.name) === norm);
    if (exactNormMatches.length > 0) {
      return { matched: true, isAllSpecialQuery: false, matchedFreezers: exactNormMatches };
    }

    const exactDisplayMatches = onSiteFreezers.filter(f => normalizeText(f.name) === 'display');
    if (exactDisplayMatches.length > 0) {
      return { matched: true, isAllSpecialQuery: false, matchedFreezers: exactDisplayMatches };
    }

    const literalDisplaySubstringMatches = onSiteFreezers.filter(f =>
      normalizeText(f.name).includes('display')
    );
    if (literalDisplaySubstringMatches.length > 0) {
      return {
        matched: true,
        isAllSpecialQuery: false,
        matchedFreezers: literalDisplaySubstringMatches,
      };
    }

    const specialFallback = onSiteFreezers.filter(f => f.isSpecial);
    return { matched: true, isAllSpecialQuery: false, matchedFreezers: specialFallback };
  }

  return { matched: false, isAllSpecialQuery: false, matchedFreezers: [] };
}

/**
 * Resolve on-site location candidates strictly from state.freezers and non-archived state.containers.
 * Never touches off-site locations, pallets, boxes, or offSiteEntries.
 */
export function resolveOnSiteLocationCandidates(
  locationQuery: string | undefined,
  state: InventoryState,
  mode: 'source' | 'dest' | 'any' = 'any'
): VoiceLocationCandidate[] {
  if (!locationQuery || !locationQuery.trim()) return [];

  const rawNorm = normalizeText(locationQuery);
  if (!rawNorm) return [];

  // Strip optional conversational filler ("the container ...", "container ...", "the ...")
  const query = rawNorm
    .replace(/^(?:the\s+)?container\s+/i, '')
    .replace(/^the\s+/i, '')
    .trim() || rawNorm;

  const freezers = state.freezers || [];
  const freezerMap = new Map<string, Freezer>(freezers.map(f => [f.id, f]));
  const activeContainers = (state.containers || []).filter(c => !c.isArchived);

  // Build normalized container entries
  const allTargets: Array<{
    container: Container;
    freezer?: Freezer;
    freezerName: string;
    isDisplay: boolean;
    isLoose: boolean;
    isStaging: boolean;
  }> = activeContainers.map(c => {
    const freezer = c.freezerId ? freezerMap.get(c.freezerId) : undefined;
    const isStaging = !c.freezerId;
    const isDisplay = Boolean(freezer?.isSpecial);
    const isLoose = c.id === 'staging_loose' || c.id.endsWith('_loose');
    const freezerName = freezer ? freezer.name : 'Staging Area';
    return { container: c, freezer, freezerName, isDisplay, isLoose, isStaging };
  });

  const containerAliasesMap = new Map<string, string[]>();
  const freezerAliasesMap = new Map<string, string[]>();
  for (const entry of state.voiceDictionary || []) {
    const phrase = entry.spokenPhrase?.trim();
    if (!phrase || !entry.targetId) continue;
    if (entry.targetType === 'container') {
      const list = containerAliasesMap.get(entry.targetId) || [];
      list.push(phrase);
      containerAliasesMap.set(entry.targetId, list);
    } else if (entry.targetType === 'freezer') {
      const list = freezerAliasesMap.get(entry.targetId) || [];
      list.push(phrase);
      freezerAliasesMap.set(entry.targetId, list);
    }
  }

  // 1. Check hierarchical "<container> in <freezer>" pattern (e.g. "orange in canada")
  const hierarchyMatch = query.match(/^(.+?)\s+(?:in|inside|at|of)\s+(.+)$/i);
  if (hierarchyMatch) {
    const contPart = hierarchyMatch[1]
      .trim()
      .replace(/^(?:the\s+)?containers?\s+/i, '')
      .trim();
    const freezerPartRaw = hierarchyMatch[2].trim();
    const freezerPartStripped =
      freezerPartRaw
        .replace(/^(?:the\s+)?freezer\s+/i, '')
        .replace(/\s+freezer$/i, '')
        .trim() || freezerPartRaw;

    const hierarchyDisplayRes = resolveDisplayFreezersForQuery(freezerPartRaw, state);
    const matchingFreezers =
      hierarchyDisplayRes.matched && hierarchyDisplayRes.matchedFreezers.length > 0
        ? hierarchyDisplayRes.matchedFreezers.map(f => ({
            f,
            m: { score: 100, reason: 'exact' as MatchReason, isExact: true },
          }))
        : freezers
            .map(f => {
              const aliases = freezerAliasesMap.get(f.id);
              const mRaw = scoreNameWithAliases(freezerPartRaw, f.name, aliases);
              const mStripped =
                freezerPartStripped !== freezerPartRaw
                  ? scoreNameWithAliases(freezerPartStripped, f.name, aliases)
                  : null;
              const m =
                mRaw && mStripped
                  ? mRaw.score >= mStripped.score
                    ? mRaw
                    : mStripped
                  : mRaw || mStripped;
              return { f, m };
            })
            .filter(
              (x): x is { f: Freezer; m: NonNullable<ReturnType<typeof scoreNameMatch>> } =>
                x.m !== null
            );

    // Also allow "staging" as the freezer part
    const isStagingFreezerQuery =
      freezerPartStripped === 'staging' ||
      freezerPartStripped === 'staging area' ||
      freezerPartStripped === 'sorting table';

    const matchedFreezerIds = new Set(matchingFreezers.map(x => x.f.id));
    const freezerScoreMap = new Map(matchingFreezers.map(x => [x.f.id, x.m]));

    const candidates: VoiceLocationCandidate[] = [];
    for (const target of allTargets) {
      const inMatchedFreezer =
        (target.freezer && matchedFreezerIds.has(target.freezer.id)) ||
        (isStagingFreezerQuery && target.isStaging);

      if (!inMatchedFreezer) continue;

      const contMatch =
        target.isLoose && contPart.toLowerCase() === 'loose'
          ? { score: 100, reason: 'exact' as MatchReason, isExact: true }
          : scoreNameWithAliases(
              contPart,
              target.container.name,
              containerAliasesMap.get(target.container.id),
              { keepUnitTokens: true }
            );
      // Also match "loose" explicitly if someone says "loose in canada"
      if (contMatch) {
        const fScore = target.freezer ? (freezerScoreMap.get(target.freezer.id)?.score ?? 70) : 90;
        const combinedScore = Math.round((contMatch.score + fScore) / 2);
        const fExact = target.freezer ? (freezerScoreMap.get(target.freezer.id)?.isExact ?? false) : true;
        candidates.push({
          containerId: target.container.id,
          containerName: target.container.name,
          freezerId: target.freezer?.id,
          freezerName: target.freezerName,
          isDisplay: target.isDisplay,
          isLoose: target.isLoose,
          isStaging: target.isStaging,
          score: combinedScore,
          matchReason: contMatch.reason,
          isExact: contMatch.isExact && fExact,
          label: target.isLoose ? `${target.freezerName} (Loose)` : `${target.container.name} (${target.freezerName})`,
        });
      }
    }

    if (candidates.length > 0) {
      return candidates.sort((a, b) => b.score - a.score);
    }
  }

  // 1b. Handle "<freezer/display/staging> loose" or "loose <freezer/display/staging>" (e.g. "display loose", "chest freezer loose", "canada loose")
  const looseSuffixMatch = query.match(/^(.+?)\s+loose$/i);
  const loosePrefixMatch = !looseSuffixMatch ? query.match(/^loose\s+(.+)$/i) : null;
  const looseBaseQuery = (looseSuffixMatch?.[1] || loosePrefixMatch?.[1] || '').trim();
  if (looseBaseQuery) {
    const looseCandidates: VoiceLocationCandidate[] = [];

    // Check if there is literally a non-loose container matching the full phrase (e.g. a bin actually named "Display Loose")
    for (const target of allTargets) {
      if (target.isLoose) continue;
      const customAliases = containerAliasesMap.get(target.container.id) || [];
      const literalMatch = scoreNameWithAliases(query, target.container.name, customAliases, {
        keepUnitTokens: true,
      });
      if (literalMatch && literalMatch.isExact) {
        looseCandidates.push({
          containerId: target.container.id,
          containerName: target.container.name,
          freezerId: target.freezer?.id,
          freezerName: target.freezerName,
          isDisplay: target.isDisplay,
          isLoose: false,
          isStaging: target.isStaging,
          score: literalMatch.score,
          matchReason: literalMatch.reason,
          isExact: literalMatch.isExact,
          label: `${target.container.name} (${target.freezerName})`,
        });
      }
    }

    const baseNorm = looseBaseQuery
      .replace(/^(?:the\s+)?freezer\s+/i, '')
      .replace(/\s+freezer$/i, '')
      .trim() || looseBaseQuery;

    if (baseNorm === 'staging' || baseNorm === 'staging area' || baseNorm === 'sorting table' || baseNorm === 'unassigned') {
      const stagingLoose = allTargets.find(t => t.container.id === 'staging_loose');
      if (stagingLoose) {
        looseCandidates.push({
          containerId: stagingLoose.container.id,
          containerName: stagingLoose.container.name,
          freezerId: undefined,
          freezerName: 'Staging Area',
          isDisplay: false,
          isLoose: true,
          isStaging: true,
          score: 100,
          matchReason: 'exact',
          isExact: true,
          label: 'Staging Area (Loose)',
        });
      }
    } else {
      const looseDisplayRes = resolveDisplayFreezersForQuery(looseBaseQuery, state);
      if (looseDisplayRes.matched && looseDisplayRes.matchedFreezers.length > 0) {
        for (const df of looseDisplayRes.matchedFreezers) {
          const looseContainer = activeContainers.find(c => c.id === `${df.id}_loose`);
          if (looseContainer) {
            looseCandidates.push({
              containerId: looseContainer.id,
              containerName: looseContainer.name,
              freezerId: df.id,
              freezerName: df.name,
              isDisplay: true,
              isLoose: true,
              isStaging: false,
              score: 100,
              matchReason: 'exact',
              isExact: true,
              label: `${df.name} (Loose)`,
            });
          }
        }
      } else {
        for (const freezer of freezers) {
          const aliases = freezerAliasesMap.get(freezer.id);
          const fRaw = scoreNameWithAliases(looseBaseQuery, freezer.name, aliases, { keepUnitTokens: true });
          const fStripped =
            baseNorm !== looseBaseQuery
              ? scoreNameWithAliases(baseNorm, freezer.name, aliases, { keepUnitTokens: true })
              : null;
          const fMatch =
            fRaw && fStripped ? (fRaw.score >= fStripped.score ? fRaw : fStripped) : fRaw || fStripped;
          if (!fMatch || fMatch.score < 60) continue;

          const looseContainer = activeContainers.find(c => c.id === `${freezer.id}_loose`);
          if (looseContainer) {
            looseCandidates.push({
              containerId: looseContainer.id,
              containerName: looseContainer.name,
              freezerId: freezer.id,
              freezerName: freezer.name,
              isDisplay: Boolean(freezer.isSpecial),
              isLoose: true,
              isStaging: false,
              score: fMatch.score,
              matchReason: fMatch.reason,
              isExact: fMatch.isExact,
              label: `${freezer.name} (Loose)`,
            });
          }
        }
      }
    }

    if (looseCandidates.length > 0) {
      return looseCandidates.sort((a, b) => b.score - a.score);
    }
  }

  // 2. Special shortcut: singular "display" / "display case" (Primary setting -> literal name -> isSpecial) & plural "all displays" / "special freezers"
  const displayQueryRes = resolveDisplayFreezersForQuery(query, state);

  if (displayQueryRes.matched) {
    const displayFreezers = displayQueryRes.matchedFreezers;
    if (displayFreezers.length > 0) {
      const displayFreezerIds = new Set(displayFreezers.map(f => f.id));
      const candidates: VoiceLocationCandidate[] = [];

      for (const df of displayFreezers) {
        const looseId = `${df.id}_loose`;
        const looseContainer = activeContainers.find(c => c.id === looseId);
        const namedContainers = activeContainers.filter(
          c => c.freezerId === df.id && c.id !== looseId
        );

        if (mode === 'dest') {
          if (looseContainer) {
            candidates.push({
              containerId: looseContainer.id,
              containerName: looseContainer.name,
              freezerId: df.id,
              freezerName: df.name,
              isDisplay: true,
              isLoose: true,
              isStaging: false,
              score: 100,
              matchReason: 'exact',
              isExact: true,
              label: `${df.name} (Loose)`,
            });
          }
        } else {
          // For source/query, include loose plus any named containers inside the display freezer
          if (looseContainer) {
            candidates.push({
              containerId: looseContainer.id,
              containerName: looseContainer.name,
              freezerId: df.id,
              freezerName: df.name,
              isDisplay: true,
              isLoose: true,
              isStaging: false,
              score: 100,
              matchReason: 'exact',
              isExact: true,
              label: `${df.name} (Loose)`,
            });
          }
          for (const nc of namedContainers) {
            candidates.push({
              containerId: nc.id,
              containerName: nc.name,
              freezerId: df.id,
              freezerName: df.name,
              isDisplay: true,
              isLoose: false,
              isStaging: false,
              score: 95,
              matchReason: 'exact',
              isExact: true,
              label: `${nc.name} (${df.name})`,
            });
          }
        }
      }

      // Also keep non-display containers matching "display" if none found in special freezers
      if (candidates.length > 0) {
        return candidates;
      }
      // Fallback: check displayFreezerIds if loose container missing
      if (displayFreezerIds.size > 0) {
        return allTargets
          .filter(t => t.freezer && displayFreezerIds.has(t.freezer.id))
          .map(t => ({
            containerId: t.container.id,
            containerName: t.container.name,
            freezerId: t.freezer?.id,
            freezerName: t.freezerName,
            isDisplay: true,
            isLoose: t.isLoose,
            isStaging: false,
            score: 95,
            matchReason: 'exact' as MatchReason,
            isExact: true,
            label: `${t.container.name} (${t.freezerName})`,
          }));
      }
    }
  }

  // 3. Special shortcut: "staging" / "sorting table"
  if (query === 'staging' || query === 'staging area' || query === 'sorting table' || query === 'loose') {
    const stagingLoose = allTargets.find(t => t.container.id === 'staging_loose');
    const stagingContainers = allTargets.filter(t => t.isStaging);
    if (mode === 'dest' && stagingLoose) {
      return [{
        containerId: stagingLoose.container.id,
        containerName: stagingLoose.container.name,
        freezerId: undefined,
        freezerName: 'Staging Area',
        isDisplay: false,
        isLoose: true,
        isStaging: true,
        score: 100,
        matchReason: 'exact',
        isExact: true,
        label: 'Staging Area (Loose)',
      }];
    }
    if (stagingContainers.length > 0) {
      return stagingContainers.map(t => ({
        containerId: t.container.id,
        containerName: t.container.name,
        freezerId: undefined,
        freezerName: 'Staging Area',
        isDisplay: false,
        isLoose: t.isLoose,
        isStaging: true,
        score: t.container.id === 'staging_loose' ? 100 : 95,
        matchReason: 'exact',
        isExact: t.container.id === 'staging_loose',
        label: t.container.id === 'staging_loose' ? 'Staging Area (Loose)' : `${t.container.name} (Staging Area)`,
      }));
    }
  }

  // 4. General matching across Containers and Freezers
  const CONTAINER_TYPE_PREFIX_REGEX = new RegExp(`^(${SPECIFIC_CONTAINER_NOUN_PATTERN})\\s+(.+)$`, 'i');
  const containerTypePrefixMatch = query.match(CONTAINER_TYPE_PREFIX_REGEX);
  const querySpokenTypeNoun = containerTypePrefixMatch?.[1].toLowerCase();
  const queryWithoutTypePrefix = containerTypePrefixMatch?.[2]?.trim();
  const resultsByContainerId = new Map<string, VoiceLocationCandidate>();

  for (const target of allTargets) {
    const customContainerAliases = containerAliasesMap.get(target.container.id) || [];
    // Match container name or custom container alias
    if (!target.isLoose || customContainerAliases.length > 0) {
      let cMatch = !target.isLoose
        ? scoreNameWithAliases(query, target.container.name, customContainerAliases, { keepUnitTokens: true })
        : scoreNameWithAliases(query, '', customContainerAliases, { keepUnitTokens: true });

      // Fallback: allow "box dogs 4" to match container literally named "Dogs 4" (unless target has a conflicting type noun like "Bag Dogs 4")
      if (!cMatch && !target.isLoose && queryWithoutTypePrefix) {
        const targetNorm = normalizeText(target.container.name);
        const targetTypeMatch = targetNorm.match(CONTAINER_TYPE_PREFIX_REGEX);
        const targetTypeNoun = targetTypeMatch?.[1].toLowerCase();
        if (!targetTypeNoun || targetTypeNoun === querySpokenTypeNoun) {
          const strippedMatch = scoreNameWithAliases(
            queryWithoutTypePrefix,
            target.container.name,
            customContainerAliases,
            { keepUnitTokens: true }
          );
          if (strippedMatch) {
            cMatch = {
              score: Math.max(55, strippedMatch.score - 8),
              reason: strippedMatch.reason,
              isExact: false,
            };
          }
        }
      }

      if (cMatch) {
        const existing = resultsByContainerId.get(target.container.id);
        if (!existing || cMatch.score > existing.score) {
          resultsByContainerId.set(target.container.id, {
            containerId: target.container.id,
            containerName: target.container.name,
            freezerId: target.freezer?.id,
            freezerName: target.freezerName,
            isDisplay: target.isDisplay,
            isLoose: target.isLoose,
            isStaging: target.isStaging,
            score: cMatch.score,
            matchReason: cMatch.reason,
            isExact: cMatch.isExact,
            label: target.isLoose ? `${target.freezerName} (Loose)` : `${target.container.name} (${target.freezerName})`,
          });
        }
      }
    }

    // Also allow matching "container freezer" combined string (e.g. "orange canada")
    const combinedLabel = `${target.container.name} ${target.freezerName}`;
    if (!target.isLoose) {
      const comboMatch = scoreNameMatch(query, combinedLabel, { keepUnitTokens: true });
      if (comboMatch) {
        const existing = resultsByContainerId.get(target.container.id);
        if (!existing || comboMatch.score > existing.score) {
          resultsByContainerId.set(target.container.id, {
            containerId: target.container.id,
            containerName: target.container.name,
            freezerId: target.freezer?.id,
            freezerName: target.freezerName,
            isDisplay: target.isDisplay,
            isLoose: false,
            isStaging: target.isStaging,
            score: comboMatch.score,
            matchReason: comboMatch.reason,
            isExact: comboMatch.isExact,
            label: `${target.container.name} (${target.freezerName})`,
          });
        }
      }
    }
  }

  // Match Freezer names or custom freezer aliases (e.g. "chest freezer" or "canada")
  for (const freezer of freezers) {
    const fMatch = scoreNameWithAliases(query, freezer.name, freezerAliasesMap.get(freezer.id), {
      keepUnitTokens: true,
    });
    if (!fMatch) continue;

    const looseId = `${freezer.id}_loose`;
    const looseContainer = allTargets.find(t => t.container.id === looseId);
    const namedContainers = allTargets.filter(t => t.freezer?.id === freezer.id && !t.isLoose);

    if (mode === 'dest') {
      if (looseContainer && !resultsByContainerId.has(looseContainer.container.id)) {
        resultsByContainerId.set(looseContainer.container.id, {
          containerId: looseContainer.container.id,
          containerName: looseContainer.container.name,
          freezerId: freezer.id,
          freezerName: freezer.name,
          isDisplay: Boolean(freezer.isSpecial),
          isLoose: true,
          isStaging: false,
          score: fMatch.score,
          matchReason: fMatch.reason,
          isExact: fMatch.isExact,
          label: `${freezer.name} (Loose)`,
        });
      }
      // If freezer also has named containers, include them for selection if user didn't pick loose
      for (const nc of namedContainers) {
        if (!resultsByContainerId.has(nc.container.id)) {
          resultsByContainerId.set(nc.container.id, {
            containerId: nc.container.id,
            containerName: nc.container.name,
            freezerId: freezer.id,
            freezerName: freezer.name,
            isDisplay: Boolean(freezer.isSpecial),
            isLoose: false,
            isStaging: false,
            score: Math.max(50, fMatch.score - 5),
            matchReason: fMatch.reason,
            isExact: false,
            label: `${nc.container.name} (${freezer.name})`,
          });
        }
      }
    } else {
      // Source or any: include all containers in that freezer (loose + named)
      const inFreezer = allTargets.filter(t => t.freezer?.id === freezer.id);
      for (const t of inFreezer) {
        if (!resultsByContainerId.has(t.container.id)) {
          resultsByContainerId.set(t.container.id, {
            containerId: t.container.id,
            containerName: t.container.name,
            freezerId: freezer.id,
            freezerName: freezer.name,
            isDisplay: Boolean(freezer.isSpecial),
            isLoose: t.isLoose,
            isStaging: false,
            score: t.isLoose ? fMatch.score : Math.max(50, fMatch.score - 3),
            matchReason: fMatch.reason,
            isExact: fMatch.isExact && t.isLoose,
            label: t.isLoose ? `${freezer.name} (Loose)` : `${t.container.name} (${freezer.name})`,
          });
        }
      }
    }
  }

  return Array.from(resultsByContainerId.values()).sort((a, b) => b.score - a.score);
}

/**
 * Resolve matching active on-site products for a spoken product fragment.
 */
export function resolveOnSiteProductCandidates(
  productQuery: string,
  state: InventoryState,
  scopedContainerIds?: Set<string>
): VoiceProductMatch[] {
  const cleaned = stripUnitFillers(productQuery);
  const query = normalizeText(cleaned || productQuery);
  if (!query) return [];

  const activeProducts = (state.products || []).filter(p => !p.isArchived);
  const activeContainerIds = new Set(
    (state.containers || []).filter(c => !c.isArchived).map(c => c.id)
  );

  // Build on-site stock maps
  const totalOnSiteMap = new Map<string, number>();
  const scopedStockMap = new Map<string, number>();

  for (const mc of state.meatCuts || []) {
    if (mc.quantity <= 0 || !activeContainerIds.has(mc.containerId)) continue;
    totalOnSiteMap.set(mc.productId, (totalOnSiteMap.get(mc.productId) || 0) + mc.quantity);
    if (!scopedContainerIds || scopedContainerIds.has(mc.containerId)) {
      scopedStockMap.set(mc.productId, (scopedStockMap.get(mc.productId) || 0) + mc.quantity);
    }
  }

  const productAliasesMap = new Map<string, string[]>();
  for (const entry of state.voiceDictionary || []) {
    const phrase = entry.spokenPhrase?.trim();
    if (!phrase || entry.targetType !== 'product' || !entry.targetId) continue;
    const list = productAliasesMap.get(entry.targetId) || [];
    list.push(phrase);
    productAliasesMap.set(entry.targetId, list);
  }

  const allMatches: VoiceProductMatch[] = [];
  for (const product of activeProducts) {
    let bestMatch = scoreNameWithAliases(query, product.name, productAliasesMap.get(product.id));
    // Also allow matching product numbers if spoken (e.g. item code)
    if (!bestMatch && Array.isArray(product.productNumbers)) {
      for (const num of product.productNumbers) {
        const numMatch = scoreNameMatch(query, String(num));
        if (numMatch && (!bestMatch || numMatch.score > bestMatch.score)) {
          bestMatch = numMatch;
        }
      }
    }

    if (bestMatch) {
      allMatches.push({
        product,
        score: bestMatch.score,
        matchReason: bestMatch.reason,
        isExact: bestMatch.isExact,
        totalOnSiteQty: totalOnSiteMap.get(product.id) || 0,
        locationStockQty: scopedStockMap.get(product.id) || 0,
      });
    }
  }

  // Sort by exactness, score, and whether in stock at location
  allMatches.sort((a, b) => {
    if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    if (b.locationStockQty !== a.locationStockQty) return b.locationStockQty - a.locationStockQty;
    return a.product.name.localeCompare(b.product.name);
  });

  // When scoped to a source location (e.g. Remove from Display), filter to items stocked there first if any match
  if (scopedContainerIds && scopedContainerIds.size > 0) {
    const stockedMatches = allMatches.filter(m => m.locationStockQty > 0);
    if (stockedMatches.length > 0) {
      return stockedMatches;
    }
  }

  return allMatches;
}

export interface ResolvedVoiceBundleMatch {
  entry: VoiceDictionaryEntry;
  score: number;
  isExact: boolean;
}

export interface VoiceBundleLookupResult {
  best: ResolvedVoiceBundleMatch;
  matches: ResolvedVoiceBundleMatch[];
  isAmbiguous: boolean;
}

/**
 * Resolve a spoken item phrase against 1-to-many Voice Dictionary product pack/bundle entries.
 * Preserves unit words ("pack", "box", "bag") so phrases like "broth mix pack" / "broth mix packs"
 * match deterministically without colliding with single-product queries like "broth".
 */
export function resolveVoiceDictionaryBundles(
  productQuery: string,
  state: InventoryState,
  options?: { scopedContainerIds?: Set<string> }
): VoiceBundleLookupResult | null {
  const bundleEntries = (state.voiceDictionary || []).filter(
    e =>
      e.targetType === 'bundle' &&
      Boolean(e.spokenPhrase?.trim()) &&
      Array.isArray(e.bundleItems) &&
      e.bundleItems.length > 0
  );
  if (bundleEntries.length === 0) return null;

  const rawNorm = normalizeText(productQuery);
  if (!rawNorm) return null;

  const articleStripped = rawNorm.replace(/^(?:the|some|a|an)\s+/i, '').trim();
  const wrapperStripped = articleStripped
    .replace(/^(?:packs?|packages?|pkgs?|bags?|boxes?|cases?|sets?|bundles?)\s+of\s+/i, '')
    .trim();

  const queriesToTry = Array.from(
    new Set([rawNorm, articleStripped, wrapperStripped].filter(Boolean))
  );

  const matches: ResolvedVoiceBundleMatch[] = [];
  for (const entry of bundleEntries) {
    let bestScore: { score: number; isExact: boolean } | null = null;
    for (const q of queriesToTry) {
      const m = scoreNameMatch(q, entry.spokenPhrase, { keepUnitTokens: true });
      if (m && (!bestScore || m.score > bestScore.score || (m.isExact && !bestScore.isExact))) {
        bestScore = { score: m.score, isExact: m.isExact };
      }
    }
    if (bestScore) {
      matches.push({
        entry,
        score: bestScore.score,
        isExact: bestScore.isExact,
      });
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.entry.spokenPhrase.trim().length - a.entry.spokenPhrase.trim().length;
  });

  const best = matches[0];
  if (best.isExact) {
    const exactTies = matches.filter(m => m.isExact && m.score === best.score);
    return {
      best,
      matches: exactTies,
      isAmbiguous: exactTies.length > 1,
    };
  }

  // Non-exact bundle match (e.g. "broth mix" -> "broth mix pack") only applies when no single product matches
  if (best.score >= 80) {
    const singleProdMatches = resolveOnSiteProductCandidates(
      productQuery,
      state,
      options?.scopedContainerIds
    );
    if (singleProdMatches.length === 0) {
      const topTies = matches.filter(m => m.score >= best.score - 2);
      return {
        best,
        matches: topTies,
        isAmbiguous: topTies.length > 1,
      };
    }
  }

  return null;
}

function resolvePinnedProductCandidates(
  pinnedProductId: string,
  state: InventoryState,
  scopedContainerIds?: Set<string>
): VoiceProductMatch[] {
  const pinnedProduct = (state.products || []).find(
    p => p.id === pinnedProductId && !p.isArchived
  );
  if (!pinnedProduct) return [];

  const activeContainerIds = new Set(
    (state.containers || []).filter(c => !c.isArchived).map(c => c.id)
  );
  let totalOnSiteQty = 0;
  let locationStockQty = 0;
  for (const mc of state.meatCuts || []) {
    if (mc.quantity <= 0 || mc.productId !== pinnedProduct.id || !activeContainerIds.has(mc.containerId)) {
      continue;
    }
    totalOnSiteQty += mc.quantity;
    if (!scopedContainerIds || scopedContainerIds.has(mc.containerId)) {
      locationStockQty += mc.quantity;
    }
  }

  return [
    {
      product: pinnedProduct,
      score: 100,
      matchReason: 'exact',
      isExact: true,
      totalOnSiteQty,
      locationStockQty,
    },
  ];
}

/**
 * Determine whether a candidate list requires explicit user selection.
 * Rule per user preference:
 * - 0 matches -> cannot auto-select (error / no match)
 * - 1 match -> unambiguously selected
 * - 2+ matches -> require explicit user selection unless there is a single unique exact full-name match
 *   (Wait: for partial matches like "brats", none are exact, so ALL options are shown and selection is required!)
 */
function pickSingleOrRequireSelection<T extends { isExact: boolean }>(
  candidates: T[],
  getId: (item: T) => string,
  overrideId?: string | null
): { selectedId: string | null; requiresSelection: boolean } {
  if (candidates.length === 0) {
    return { selectedId: null, requiresSelection: false };
  }

  if (overrideId !== undefined && overrideId !== null) {
    const exists = candidates.some(c => getId(c) === overrideId);
    if (exists) {
      return { selectedId: overrideId, requiresSelection: false };
    }
  }

  if (candidates.length === 1) {
    return { selectedId: getId(candidates[0]), requiresSelection: false };
  }

  // Multiple candidates: if exactly ONE is a true exact name match, select it unless the user hasn't seen options;
  // Wait: if user explicitly chose "Show all options and require selection" for partial matches,
  // partial matches have isExact === false so they ALWAYS require selection when length > 1!
  const exactMatches = candidates.filter(c => c.isExact);
  if (exactMatches.length === 1) {
    return { selectedId: getId(exactMatches[0]), requiresSelection: false };
  }

  return { selectedId: null, requiresSelection: true };
}

/**
 * Resolve MeatCut rows for a selected product inside selected source container(s).
 */
function resolveCutCandidates(
  productId: string | null,
  sourceContainerIds: string[],
  state: InventoryState
): VoiceCutCandidate[] {
  if (!productId) return [];
  const product = (state.products || []).find(p => p.id === productId);
  if (!product) return [];

  const containerMap = new Map<string, Container>(
    (state.containers || []).filter(c => !c.isArchived).map(c => [c.id, c])
  );
  const freezerMap = new Map<string, Freezer>((state.freezers || []).map(f => [f.id, f]));
  const tagMap = new Map<string, Tag>((state.tags || []).map(t => [t.id, t]));
  const allowedContainers = sourceContainerIds.length > 0 ? new Set(sourceContainerIds) : null;

  const matchingCuts: VoiceCutCandidate[] = [];
  for (const mc of state.meatCuts || []) {
    if (mc.quantity <= 0) continue;
    if (mc.productId !== productId) continue;
    const container = containerMap.get(mc.containerId);
    if (!container) continue;
    if (allowedContainers && !allowedContainers.has(mc.containerId)) continue;

    const freezer = container.freezerId ? freezerMap.get(container.freezerId) : undefined;
    const freezerLabel = freezer ? freezer.name : 'Staging Area';
    const locationLabel = container.id.endsWith('_loose')
      ? `${freezerLabel} (Loose)`
      : `${container.name} (${freezerLabel})`;

    const tags = (mc.tagIds || [])
      .map(id => tagMap.get(id))
      .filter((t): t is Tag => Boolean(t));

    matchingCuts.push({
      meatCut: mc,
      product,
      container,
      freezer,
      locationLabel,
      tags,
    });
  }

  return matchingCuts;
}

function formatSpokenContainerName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New Container';
  if (/[A-Z]/.test(cleaned)) return cleaned;
  const lowercaseWords = new Set(['w/', 'w/o', 'b/i', 'b/l', 'c/o', 'and', 'or', 'of', 'the', 'in', 'with', 'without']);
  return cleaned
    .split(' ')
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && lowercaseWords.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function resolveOnSiteFreezerCandidates(
  freezerQuery: string | undefined,
  state: InventoryState
): VoiceFreezerCandidate[] {
  const freezers = state.freezers || [];
  const stagingEntry: VoiceFreezerCandidate = {
    freezerId: '__staging__',
    freezerName: 'Staging Area',
    isDisplay: false,
    isStaging: true,
    score: 50,
    matchReason: 'fuzzy',
    isExact: false,
  };

  const allFreezerOptions: VoiceFreezerCandidate[] = [
    stagingEntry,
    ...freezers.map(f => ({
      freezerId: f.id,
      freezerName: f.name,
      isDisplay: Boolean(f.isSpecial),
      isStaging: false,
      score: 50,
      matchReason: 'fuzzy' as MatchReason,
      isExact: false,
    })),
  ];

  if (!freezerQuery || !freezerQuery.trim()) {
    return allFreezerOptions;
  }

  const rawNorm = normalizeText(freezerQuery).replace(/^the\s+/, '').trim();
  if (!rawNorm) return [];

  const variants = Array.from(
    new Set(
      [
        rawNorm,
        rawNorm.replace(/^freezer\s+/, '').trim(),
        rawNorm.replace(/\s+freezer$/, '').trim(),
      ].filter(Boolean)
    )
  );

  const freezerAliasesMap = new Map<string, string[]>();
  for (const entry of state.voiceDictionary || []) {
    if (entry.targetType === 'freezer' && entry.targetId && entry.spokenPhrase?.trim()) {
      const list = freezerAliasesMap.get(entry.targetId) || [];
      list.push(entry.spokenPhrase.trim());
      freezerAliasesMap.set(entry.targetId, list);
    }
  }

  const matches: VoiceFreezerCandidate[] = [];

  if (
    variants.some(
      v => v === 'staging' || v === 'staging area' || v === 'sorting table' || v === 'unassigned' || v === 'loose'
    )
  ) {
    matches.push({
      freezerId: '__staging__',
      freezerName: 'Staging Area',
      isDisplay: false,
      isStaging: true,
      score: 100,
      matchReason: 'exact',
      isExact: true,
    });
  }

  const displayQueryRes = resolveDisplayFreezersForQuery(rawNorm, state);
  if (displayQueryRes.matched && displayQueryRes.matchedFreezers.length > 0) {
    return displayQueryRes.matchedFreezers.map(f => ({
      freezerId: f.id,
      freezerName: f.name,
      isDisplay: true,
      isStaging: false,
      score: 100,
      matchReason: 'exact' as MatchReason,
      isExact: true,
    }));
  }

  for (const f of freezers) {

    const aliases = freezerAliasesMap.get(f.id) || [];
    let best: { score: number; reason: MatchReason; isExact: boolean } | null = null;
    for (const v of variants) {
      const m = scoreNameWithAliases(v, f.name, aliases);
      if (m && (!best || m.score > best.score || (m.isExact && !best.isExact))) {
        best = m;
      }
    }

    if (best && best.score >= 60) {
      matches.push({
        freezerId: f.id,
        freezerName: f.name,
        isDisplay: Boolean(f.isSpecial),
        isStaging: false,
        score: best.score,
        matchReason: best.reason,
        isExact: best.isExact,
      });
    }
  }

  return matches.sort((a, b) => {
    if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.freezerName.localeCompare(b.freezerName);
  });
}

function resolveNewContainerTemplates(
  containerNameQuery: string,
  state: InventoryState,
  explicitTemplateRequested = false,
  defaultIcon = 'box'
): {
  candidates: VoiceContainerTemplateCandidate[];
  selectedTemplateId: string | null;
  requiresSelection: boolean;
  errorMessage?: string;
} {
  const customDisplayName = formatSpokenContainerName(containerNameQuery);
  const customCandidate: VoiceContainerTemplateCandidate = {
    templateId: '__custom__',
    name: customDisplayName,
    icon: defaultIcon || 'box',
    isCustom: true,
    score: 50,
    matchReason: 'exact',
    isExact: false,
  };

  const templates = state.containerTemplates || [];
  const matchedTemplates: VoiceContainerTemplateCandidate[] = [];

  const qNormTokens = tokenize(normalizeText(containerNameQuery))
    .map(canonicalizeToken)
    .sort();
  for (const tpl of templates) {
    const m = scoreNameMatch(containerNameQuery, tpl.name, { keepUnitTokens: true });
    if (m && m.score >= 65) {
      const tplNormTokens = tokenize(normalizeText(tpl.name))
        .map(canonicalizeToken)
        .sort();
      const isReorderedExact =
        !m.isExact &&
        qNormTokens.length >= 2 &&
        qNormTokens.length === tplNormTokens.length &&
        qNormTokens.every((t, idx) => t === tplNormTokens[idx]);
      matchedTemplates.push({
        templateId: tpl.id,
        name: tpl.name,
        icon: tpl.icon || 'box',
        imageUrl: tpl.imageUrl,
        isCustom: false,
        score: isReorderedExact ? Math.max(m.score, 95) : m.score,
        matchReason: isReorderedExact ? 'exact' : m.reason,
        isExact: m.isExact || isReorderedExact,
      });
    }
  }

  matchedTemplates.sort((a, b) => {
    if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  const nonMatchedTemplates: VoiceContainerTemplateCandidate[] = templates
    .filter(t => !matchedTemplates.some(mt => mt.templateId === t.id))
    .map(t => ({
      templateId: t.id,
      name: t.name,
      icon: t.icon || 'box',
      imageUrl: t.imageUrl,
      isCustom: false,
      score: 10,
      matchReason: 'fuzzy' as MatchReason,
      isExact: false,
    }));

  const exactTemplates = matchedTemplates.filter(t => t.isExact);

  if (explicitTemplateRequested) {
    if (matchedTemplates.length === 0) {
      return {
        candidates: [customCandidate, ...nonMatchedTemplates],
        selectedTemplateId: null,
        requiresSelection: templates.length > 0,
        errorMessage: `No container template matched "${containerNameQuery}".`,
      };
    }
    if (exactTemplates.length === 1 || matchedTemplates.length === 1) {
      return {
        candidates: [...matchedTemplates, customCandidate, ...nonMatchedTemplates],
        selectedTemplateId: (exactTemplates[0] || matchedTemplates[0]).templateId,
        requiresSelection: false,
      };
    }
    return {
      candidates: [...matchedTemplates, customCandidate, ...nonMatchedTemplates],
      selectedTemplateId: null,
      requiresSelection: true,
    };
  }

  if (exactTemplates.length === 1) {
    return {
      candidates: [...matchedTemplates, customCandidate, ...nonMatchedTemplates],
      selectedTemplateId: exactTemplates[0].templateId,
      requiresSelection: false,
    };
  }

  if (matchedTemplates.length > 0) {
    // Partial template match(es): require explicit user choice between template(s) and custom container
    return {
      candidates: [...matchedTemplates, customCandidate, ...nonMatchedTemplates],
      selectedTemplateId: null,
      requiresSelection: true,
    };
  }

  // Zero template matches -> clean custom container creation without ambiguity
  return {
    candidates: [customCandidate, ...nonMatchedTemplates],
    selectedTemplateId: '__custom__',
    requiresSelection: false,
  };
}

function getContainerCutSummaries(
  containerId: string,
  state: InventoryState
): VoiceContainerCutSummary[] {
  const productMap = new Map<string, Product>(
    (state.products || []).filter(p => !p.isArchived).map(p => [p.id, p])
  );
  const containerMap = new Map<string, Container>(
    (state.containers || []).filter(c => !c.isArchived).map(c => [c.id, c])
  );
  const freezerMap = new Map<string, Freezer>((state.freezers || []).map(f => [f.id, f]));
  const tagMap = new Map<string, Tag>((state.tags || []).map(t => [t.id, t]));

  const container = containerMap.get(containerId);
  if (!container) return [];
  const freezer = container.freezerId ? freezerMap.get(container.freezerId) : undefined;
  const freezerName = freezer ? freezer.name : 'Staging Area';
  const containerLabel =
    container.id === 'staging_loose' || container.id.endsWith('_loose')
      ? `${freezerName} (Loose)`
      : `${container.name} (${freezerName})`;

  const summaries: VoiceContainerCutSummary[] = [];
  for (const mc of state.meatCuts || []) {
    if (mc.quantity <= 0 || mc.containerId !== containerId) continue;
    const product = productMap.get(mc.productId);
    if (!product) continue;
    summaries.push({
      meatCut: mc,
      product,
      quantity: mc.quantity,
      containerId,
      containerLabel,
      tags: (mc.tagIds || []).map(id => tagMap.get(id)).filter((t): t is Tag => Boolean(t)),
    });
  }
  return summaries;
}

function resolveCustomListCandidates(
  rawQuery: string,
  state: InventoryState
): VoiceCustomListCandidate[] {
  const cleaned = rawQuery
    .trim()
    .replace(/^(?:the|my|our)\s+/i, '')
    .trim();
  if (!cleaned) return [];
  const strippedListWord = cleaned.replace(/\s+lists?$/i, '').trim() || cleaned;

  const lists = state.customLists || [];
  const results: VoiceCustomListCandidate[] = [];

  for (const list of lists) {
    const nameNoList = list.name.replace(/\s+lists?$/i, '').trim() || list.name;
    const m1 = scoreNameMatch(cleaned, list.name);
    const m2 = scoreNameMatch(strippedListWord, nameNoList);
    const best =
      m1 && m2
        ? m1.score >= m2.score
          ? m1
          : m2
        : m1 || m2;
    if (best && best.score >= 60) {
      results.push({
        list,
        score: best.score,
        matchReason: best.reason,
        isExact: best.isExact,
      });
    }
  }

  return results.sort((a, b) => {
    if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.list.name.localeCompare(b.list.name);
  });
}

function resolveTagCandidates(
  rawQuery: string,
  state: InventoryState
): VoiceTagCandidate[] {
  const cleaned = rawQuery
    .trim()
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s+tag$/i, '')
    .trim();
  if (!cleaned) return [];

  const matches: VoiceTagCandidate[] = [];
  for (const tag of state.tags || []) {
    const m = scoreNameMatch(cleaned, tag.name);
    if (m && m.score >= 60) {
      matches.push({
        tag,
        score: m.score,
        matchReason: m.reason,
        isExact: m.isExact,
      });
    }
  }
  return matches.sort((a, b) => {
    if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.tag.name.localeCompare(b.tag.name);
  });
}

function resolveCategoryCandidates(
  rawQuery: string,
  state: InventoryState
): Array<{ name: string; type: 'primary' | 'sub'; score: number; isExact: boolean }> {
  const cleaned = rawQuery
    .trim()
    .replace(/^(?:all|any|every)\s+/i, '')
    .replace(/\s+(?:cuts?|items?|products?|meats?)$/i, '')
    .trim();
  if (!cleaned) return [];

  const seen = new Map<string, 'primary' | 'sub'>();
  for (const c of state.categories || []) {
    seen.set(`${c.type}::${c.name.toLowerCase()}`, c.type);
  }
  for (const p of state.products || []) {
    if (p.isArchived) continue;
    if (p.primaryCategory) seen.set(`primary::${p.primaryCategory.toLowerCase()}`, 'primary');
    if (p.subCategory) seen.set(`sub::${p.subCategory.toLowerCase()}`, 'sub');
  }

  const canonicalNames = new Map<string, { name: string; type: 'primary' | 'sub' }>();
  for (const c of state.categories || []) {
    canonicalNames.set(`${c.type}::${c.name.toLowerCase()}`, { name: c.name, type: c.type });
  }
  for (const p of state.products || []) {
    if (p.isArchived) continue;
    if (p.primaryCategory) {
      const k = `primary::${p.primaryCategory.toLowerCase()}`;
      if (!canonicalNames.has(k)) canonicalNames.set(k, { name: p.primaryCategory, type: 'primary' });
    }
    if (p.subCategory) {
      const k = `sub::${p.subCategory.toLowerCase()}`;
      if (!canonicalNames.has(k)) canonicalNames.set(k, { name: p.subCategory, type: 'sub' });
    }
  }

  const out: Array<{ name: string; type: 'primary' | 'sub'; score: number; isExact: boolean }> = [];
  const qSing = tokenize(cleaned).map(canonicalizeToken).join(' ');

  for (const cat of canonicalNames.values()) {
    const cSing = tokenize(cat.name).map(canonicalizeToken).join(' ');
    const m1 = scoreNameMatch(cleaned, cat.name);
    const m2 = qSing && cSing ? scoreNameMatch(qSing, cSing) : null;
    const best =
      m1 && m2
        ? m1.score >= m2.score
          ? m1
          : m2
        : m1 || m2;
    if (best && best.score >= 70) {
      out.push({
        name: cat.name,
        type: cat.type,
        score: best.score,
        isExact: best.isExact || qSing === cSing,
      });
    }
  }

  return out.sort((a, b) => {
    if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });
}

function resolveArchivedOrActiveContainerCandidates(
  rawQuery: string,
  state: InventoryState,
  options: { includeArchived: boolean; onlyArchived?: boolean }
): VoiceLocationCandidate[] {
  const active = options.onlyArchived ? [] : resolveOnSiteLocationCandidates(rawQuery, state, 'source').filter(l => !l.isLoose);
  if (!options.includeArchived) return active;

  const freezerMap = new Map((state.freezers || []).map(f => [f.id, f]));
  const archived = (state.containers || []).filter(c => Boolean(c.isArchived));
  const archivedCandidates: VoiceLocationCandidate[] = [];
  for (const c of archived) {
    const m = scoreNameMatch(rawQuery, c.name);
    if (m && m.score >= 60) {
      const f = c.freezerId ? freezerMap.get(c.freezerId) : undefined;
      const fName = f ? f.name : 'Archived';
      archivedCandidates.push({
        containerId: c.id,
        containerName: c.name,
        freezerId: f?.id,
        freezerName: fName,
        isDisplay: Boolean(f?.isSpecial),
        isLoose: false,
        isStaging: !c.freezerId,
        score: m.score,
        matchReason: m.reason,
        isExact: m.isExact,
        label: `${c.name} (${fName})`,
      });
    }
  }
  const combined = [...active, ...archivedCandidates];
  const seen = new Set<string>();
  return combined
    .filter(c => {
      if (seen.has(c.containerId)) return false;
      seen.add(c.containerId);
      return true;
    })
    .sort((a, b) => {
      if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return a.containerName.localeCompare(b.containerName);
    });
}

function splitPlainProductList(body: string): string[] {
  const parts = body
    .split(/\s*(?:,|\band\b|&)\s*/i)
    .map(p => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : body.trim() ? [body.trim()] : [];
}

function getAllActiveLocationCandidates(
  state: InventoryState,
  includeLoose = true
): VoiceLocationCandidate[] {
  const freezerMap = new Map<string, Freezer>((state.freezers || []).map(f => [f.id, f]));
  return (state.containers || [])
    .filter(c => {
      if (c.isArchived) return false;
      if (!includeLoose && (c.id === 'staging_loose' || c.id.endsWith('_loose'))) return false;
      return true;
    })
    .map(c => {
      const freezer = c.freezerId ? freezerMap.get(c.freezerId) : undefined;
      const freezerName = freezer ? freezer.name : 'Staging Area';
      const isLoose = c.id === 'staging_loose' || c.id.endsWith('_loose');
      return {
        containerId: c.id,
        containerName: c.name,
        freezerId: freezer?.id,
        freezerName,
        isDisplay: Boolean(freezer?.isSpecial),
        isLoose,
        isStaging: !c.freezerId,
        score: 50,
        matchReason: 'fuzzy' as MatchReason,
        isExact: false,
        label: isLoose ? `${freezerName} (Loose)` : `${c.name} (${freezerName})`,
      };
    });
}

function getDiceBigramSimilarity(aRaw: string, bRaw: string): number {
  const a = normalizeText(aRaw);
  const b = normalizeText(bRaw);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) {
    return b.includes(a) || a.includes(b) ? 0.5 : 0;
  }
  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      bigramsA.set(bg, count - 1);
      intersection++;
    }
  }
  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

function findFallbackProductMatches(
  productQuery: string,
  state: InventoryState,
  scopedContainerIds?: Set<string>,
  limit = 6
): VoiceProductMatch[] {
  const direct = resolveOnSiteProductCandidates(productQuery, state, scopedContainerIds);
  if (direct.length >= limit) {
    return direct.slice(0, limit);
  }

  const activeProducts = (state.products || []).filter(p => !p.isArchived);
  const activeContainerIds = new Set(
    (state.containers || []).filter(c => !c.isArchived).map(c => c.id)
  );
  const totalOnSiteMap = new Map<string, number>();
  const scopedStockMap = new Map<string, number>();
  for (const mc of state.meatCuts || []) {
    if (mc.quantity <= 0 || !activeContainerIds.has(mc.containerId)) continue;
    totalOnSiteMap.set(mc.productId, (totalOnSiteMap.get(mc.productId) || 0) + mc.quantity);
    if (!scopedContainerIds || scopedContainerIds.has(mc.containerId)) {
      scopedStockMap.set(mc.productId, (scopedStockMap.get(mc.productId) || 0) + mc.quantity);
    }
  }

  const cleanedQuery = normalizeText(stripUnitFillers(productQuery) || productQuery);
  const qTokens = tokenize(cleanedQuery);
  const seenIds = new Set(direct.map(d => d.product.id));
  const extraMatches: VoiceProductMatch[] = [];

  for (const product of activeProducts) {
    if (seenIds.has(product.id)) continue;
    const prodNorm = normalizeText(product.name);
    const catNorm = normalizeText(`${product.primaryCategory || ''} ${product.subCategory || ''}`);
    const dice = getDiceBigramSimilarity(cleanedQuery, prodNorm);
    const catDice = getDiceBigramSimilarity(cleanedQuery, catNorm);
    const pTokens = tokenize(prodNorm);
    const tokenHits = qTokens.filter(qt =>
      pTokens.some(pt => pt.startsWith(qt.slice(0, 3)) || qt.startsWith(pt.slice(0, 3)))
    ).length;

    const totalStock = totalOnSiteMap.get(product.id) || 0;
    const scopedStock = scopedStockMap.get(product.id) || 0;
    const simScore = Math.round(Math.max(dice, catDice * 0.8) * 65 + tokenHits * 12);
    const stockBoost = scopedStock > 0 ? 18 : totalStock > 0 ? 8 : 0;

    if (cleanedQuery && simScore === 0 && totalStock === 0 && scopedStock === 0) {
      continue;
    }

    extraMatches.push({
      product,
      score: Math.max(10, simScore + stockBoost),
      matchReason: 'fuzzy',
      isExact: false,
      totalOnSiteQty: totalStock,
      locationStockQty: scopedStock,
    });
  }

  extraMatches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.locationStockQty !== a.locationStockQty) return b.locationStockQty - a.locationStockQty;
    if (b.totalOnSiteQty !== a.totalOnSiteQty) return b.totalOnSiteQty - a.totalOnSiteQty;
    return a.product.name.localeCompare(b.product.name);
  });

  // If still fewer than limit (e.g. completely unrecognized gibberish), surface top stocked products
  if (direct.length + extraMatches.length < limit) {
    for (const product of activeProducts) {
      if (seenIds.has(product.id) || extraMatches.some(m => m.product.id === product.id)) continue;
      extraMatches.push({
        product,
        score: 5 + ((totalOnSiteMap.get(product.id) || 0) > 0 ? 5 : 0),
        matchReason: 'fuzzy',
        isExact: false,
        totalOnSiteQty: totalOnSiteMap.get(product.id) || 0,
        locationStockQty: scopedStockMap.get(product.id) || 0,
      });
    }
    extraMatches.sort((a, b) => b.score - a.score || b.totalOnSiteQty - a.totalOnSiteQty);
  }

  return [...direct, ...extraMatches].slice(0, limit);
}

function findFallbackLocations(
  locQuery: string | undefined,
  state: InventoryState,
  options?: {
    mode?: 'source' | 'dest' | 'any';
    productId?: string | null;
    excludeIds?: Set<string>;
    onlyNonLoose?: boolean;
    limit?: number;
  }
): VoiceLocationCandidate[] {
  const mode = options?.mode || 'any';
  const productId = options?.productId || null;
  const limit = options?.limit ?? 8;

  const qtyByContainer = new Map<string, number>();
  if (productId) {
    for (const mc of state.meatCuts || []) {
      if (mc.quantity > 0 && mc.productId === productId) {
        qtyByContainer.set(mc.containerId, (qtyByContainer.get(mc.containerId) || 0) + mc.quantity);
      }
    }
  }

  const totalPiecesByContainer = new Map<string, number>();
  for (const mc of state.meatCuts || []) {
    if (mc.quantity > 0) {
      totalPiecesByContainer.set(
        mc.containerId,
        (totalPiecesByContainer.get(mc.containerId) || 0) + mc.quantity
      );
    }
  }

  const direct = locQuery?.trim() ? resolveOnSiteLocationCandidates(locQuery, state, mode) : [];
  const directById = new Map(direct.map(d => [d.containerId, d]));

  const allLocs = getAllActiveLocationCandidates(state, !options?.onlyNonLoose).filter(
    l => !options?.excludeIds?.has(l.containerId)
  );

  const cleanedQuery = normalizeText(cleanLocationFragment(locQuery || ''));
  const enriched = allLocs.map(loc => {
    const existingProductQty = productId ? qtyByContainer.get(loc.containerId) || 0 : 0;
    const hasMatchingProduct = existingProductQty > 0;
    const totalInside = totalPiecesByContainer.get(loc.containerId) || 0;
    const directHit = directById.get(loc.containerId);
    const sim = cleanedQuery
      ? Math.round(
          Math.max(
            getDiceBigramSimilarity(cleanedQuery, loc.containerName),
            getDiceBigramSimilarity(cleanedQuery, `${loc.containerName} ${loc.freezerName}`),
            getDiceBigramSimilarity(cleanedQuery, loc.freezerName) * 0.9
          ) * 60
        )
      : 0;
    return {
      ...loc,
      score: directHit ? directHit.score : Math.max(sim, totalInside > 0 ? 15 : 5),
      matchReason: directHit ? directHit.matchReason : ('fuzzy' as MatchReason),
      isExact: Boolean(directHit?.isExact),
      hasMatchingProduct,
      existingProductQty,
    };
  });

  enriched.sort((a, b) => {
    if (productId && a.hasMatchingProduct !== b.hasMatchingProduct) {
      return a.hasMatchingProduct ? -1 : 1;
    }
    if (mode === 'source' && productId) {
      const aQty = a.existingProductQty || 0;
      const bQty = b.existingProductQty || 0;
      if (bQty !== aQty) return bQty - aQty;
    }
    if (b.score !== a.score) return b.score - a.score;
    if (a.isDisplay !== b.isDisplay) return a.isDisplay ? -1 : 1;
    if (a.isLoose !== b.isLoose) return a.isLoose ? 1 : -1;
    return a.label.localeCompare(b.label);
  });

  return enriched.slice(0, limit);
}

function extractContainerAndFreezerFromDestQuery(
  rawDestQuery: string | undefined,
  state: InventoryState
): {
  containerNameQuery: string;
  freezerQuery?: string;
  matchedFreezers: VoiceFreezerCandidate[];
  onlyFreezer: boolean;
} {
  const cleaned = (rawDestQuery || '')
    .replace(/^(?:the|an?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return { containerNameQuery: '', matchedFreezers: [], onlyFreezer: false };
  }

  // 1. Check explicit preposition split: "red bag in freezer 2"
  const prepMatch = cleaned.match(/^(.+?)\s+\b(?:in|into|inside|to|at)\s+(.+)$/i);
  if (prepMatch) {
    const left = prepMatch[1].replace(/^(?:the|an?)\s+/i, '').trim();
    const right = prepMatch[2].trim();
    const matchedRight = resolveOnSiteFreezerCandidates(right, state);
    if (matchedRight.length > 0) {
      return {
        containerNameQuery: left,
        freezerQuery: right,
        matchedFreezers: matchedRight,
        onlyFreezer: false,
      };
    }
    return {
      containerNameQuery: left,
      freezerQuery: right,
      matchedFreezers: [],
      onlyFreezer: false,
    };
  }

  // 2. Check if the entire phrase is just a freezer (and NOT a container/template name)
  const directFreezers = resolveOnSiteFreezerCandidates(cleaned, state);
  const directNamedCont = resolveOnSiteLocationCandidates(cleaned, state, 'source').filter(
    c => !c.isLoose
  );
  const directTplMatch = (state.containerTemplates || []).some(t => {
    const m = scoreNameMatch(cleaned, t.name, { keepUnitTokens: true });
    return Boolean(m && m.score >= 65);
  });
  if (directFreezers.length > 0 && directNamedCont.length === 0 && !directTplMatch) {
    return {
      containerNameQuery: '',
      freezerQuery: cleaned,
      matchedFreezers: directFreezers,
      onlyFreezer: true,
    };
  }

  // 3. Check trailing freezer without preposition, e.g. "red bag freezer 2"
  const words = cleaned.split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 1; i--) {
    const left = words.slice(0, i).join(' ');
    const right = words.slice(i).join(' ');
    const rightFreezers = resolveOnSiteFreezerCandidates(right, state);
    if (rightFreezers.length > 0) {
      return {
        containerNameQuery: left,
        freezerQuery: right,
        matchedFreezers: rightFreezers,
        onlyFreezer: false,
      };
    }
  }

  return { containerNameQuery: cleaned, matchedFreezers: [], onlyFreezer: false };
}

function buildAddFallbackSuggestions(
  destLocationQuery: string | undefined,
  selectedProductId: string | null,
  state: InventoryState
): {
  suggestedTemplateCandidates: VoiceContainerTemplateCandidate[];
  suggestedFreezerId: string | null;
  suggestedFallbackFreezers: VoiceFreezerCandidate[];
  suggestedFallbackLocations: VoiceLocationCandidate[];
} {
  const split = extractContainerAndFreezerFromDestQuery(destLocationQuery, state);
  const allFreezers = resolveOnSiteFreezerCandidates(undefined, state);
  const suggestedFreezerId =
    split.matchedFreezers.length === 1 ? split.matchedFreezers[0].freezerId : null;
  const suggestedFallbackFreezers =
    split.matchedFreezers.length > 0 ? split.matchedFreezers : allFreezers;

  const suggestedTemplateCandidates: VoiceContainerTemplateCandidate[] = [];
  if (split.containerNameQuery) {
    const tplRes = resolveNewContainerTemplates(
      split.containerNameQuery,
      state,
      false,
      inferContainerIconFromName(split.containerNameQuery)
    );
    suggestedTemplateCandidates.push(...tplRes.candidates.slice(0, 6));
  } else {
    for (const tpl of (state.containerTemplates || []).slice(0, 6)) {
      suggestedTemplateCandidates.push({
        templateId: tpl.id,
        name: tpl.name,
        icon: tpl.icon || 'box',
        imageUrl: tpl.imageUrl,
        isCustom: false,
        score: 40,
        matchReason: 'fuzzy',
        isExact: false,
      });
    }
  }

  const suggestedFallbackLocations = findFallbackLocations(destLocationQuery, state, {
    mode: 'dest',
    productId: selectedProductId,
    limit: 8,
  });

  return {
    suggestedTemplateCandidates,
    suggestedFreezerId,
    suggestedFallbackFreezers,
    suggestedFallbackLocations,
  };
}

function analyzeUnknownSegment(
  segmentRaw: string,
  state: InventoryState
): {
  quantity: number;
  inferredProductQuery?: string;
  inferredLocationQuery?: string;
  inferredFreezerQuery?: string;
  suggestedFallbackProducts: VoiceProductMatch[];
  suggestedFallbackLocations: VoiceLocationCandidate[];
  suggestedTemplateCandidates: VoiceContainerTemplateCandidate[];
  suggestedFreezerId: string | null;
  suggestedFallbackFreezers: VoiceFreezerCandidate[];
} {
  const cleanedRaw = stripPoliteLeadIn(segmentRaw.trim()).replace(/[?!.]+$/g, '').trim();
  const qtyExtracted = extractLeadingQuantity(cleanedRaw, { allowToAsTwo: true, defaultQty: 1 });
  const body = (qtyExtracted.rest || cleanedRaw).trim();

  // Direct phrase checks on full body
  const directProd = body ? resolveOnSiteProductCandidates(body, state) : [];
  const directLoc = body ? resolveOnSiteLocationCandidates(body, state, 'any') : [];
  const directTpl = body
    ? resolveNewContainerTemplates(body, state, false, inferContainerIconFromName(body)).candidates.filter(
        c => !c.isCustom && c.score >= 65
      )
    : [];
  const directFreezer = body ? resolveOnSiteFreezerCandidates(body, state) : [];

  let bestRank =
    (directProd[0]?.score || 0) +
    (directLoc[0]?.score || 0) +
    (directTpl[0]?.score || 0) +
    (directFreezer[0]?.score || 0);
  let inferredProductQuery = directProd.length > 0 ? body : undefined;
  let inferredLocationQuery = directLoc.length > 0 ? body : undefined;
  let inferredFreezerQuery = directFreezer.length > 0 && directLoc.length === 0 ? body : undefined;
  let bestProducts = directProd;
  let bestLocations = directLoc;
  let bestTemplates = directTpl;
  let bestFreezers = directFreezer;

  // Test two-part splits across words / prepositions (e.g. "4 broths red bag", "red bag freezer 2")
  const words = body.split(/\s+/).filter(Boolean);
  for (let i = 1; i < words.length; i++) {
    const left = words
      .slice(0, i)
      .join(' ')
      .replace(/\s+\b(?:to|into|in|inside|from|at|on|for)$/i, '')
      .trim();
    const right = words
      .slice(i)
      .join(' ')
      .replace(/^(?:to|into|in|inside|from|at|on|for|the|a|an)\b\s*/i, '')
      .trim();
    if (!left || !right) continue;

    const pLeft = resolveOnSiteProductCandidates(left, state);
    const lRight = resolveOnSiteLocationCandidates(right, state, 'any');
    const tRight = resolveNewContainerTemplates(right, state, false, inferContainerIconFromName(right)).candidates.filter(
      c => !c.isCustom && c.score >= 65
    );
    const fRight = resolveOnSiteFreezerCandidates(right, state);

    // Pair A: left = product, right = container/template/freezer
    const rightTargetScore = Math.max(lRight[0]?.score || 0, tRight[0]?.score || 0, fRight[0]?.score || 0);
    if (pLeft.length > 0 && rightTargetScore > 0) {
      const rank = pLeft[0].score + rightTargetScore + 25;
      if (rank > bestRank) {
        bestRank = rank;
        inferredProductQuery = left;
        inferredLocationQuery = lRight.length > 0 || tRight.length > 0 ? right : undefined;
        inferredFreezerQuery = fRight.length > 0 ? right : undefined;
        bestProducts = pLeft;
        bestLocations = lRight;
        bestTemplates = tRight;
        bestFreezers = fRight;
      }
    }

    // Pair B: left = container/template, right = freezer (e.g. "red bag freezer 2")
    const lLeft = resolveOnSiteLocationCandidates(left, state, 'any').filter(l => !l.isLoose);
    const tLeft = resolveNewContainerTemplates(left, state, false, inferContainerIconFromName(left)).candidates.filter(
      c => !c.isCustom && c.score >= 65
    );
    const leftContScore = Math.max(lLeft[0]?.score || 0, tLeft[0]?.score || 0);
    if (leftContScore > 0 && fRight.length > 0) {
      const rank = leftContScore + fRight[0].score + 20;
      if (rank > bestRank) {
        bestRank = rank;
        inferredProductQuery = undefined;
        inferredLocationQuery = left;
        inferredFreezerQuery = right;
        bestProducts = [];
        bestLocations = lLeft;
        bestTemplates = tLeft;
        bestFreezers = fRight;
      }
    }
  }

  const productSearchSeed = inferredProductQuery || body;
  const suggestedFallbackProducts =
    bestProducts.length > 0
      ? bestProducts.slice(0, 6)
      : findFallbackProductMatches(productSearchSeed, state, undefined, 5);

  const primaryProductId = bestProducts[0]?.product.id || null;
  const suggestedFallbackLocations =
    bestLocations.length > 0
      ? bestLocations.slice(0, 6)
      : findFallbackLocations(inferredLocationQuery || body, state, {
          mode: 'any',
          productId: primaryProductId,
          limit: 6,
        });

  const tplSeed = inferredLocationQuery || (!inferredProductQuery ? body : '');
  const suggestedTemplateCandidates =
    bestTemplates.length > 0
      ? bestTemplates
      : tplSeed
      ? resolveNewContainerTemplates(tplSeed, state, false, inferContainerIconFromName(tplSeed)).candidates
          .filter(c => !c.isCustom || Boolean(inferredLocationQuery))
          .slice(0, 4)
      : (state.containerTemplates || []).slice(0, 4).map(t => ({
          templateId: t.id,
          name: t.name,
          icon: t.icon || 'box',
          imageUrl: t.imageUrl,
          isCustom: false,
          score: 30,
          matchReason: 'fuzzy' as MatchReason,
          isExact: false,
        }));

  const allFreezers = resolveOnSiteFreezerCandidates(undefined, state);
  const suggestedFallbackFreezers = bestFreezers.length > 0 ? bestFreezers : allFreezers;
  const suggestedFreezerId = bestFreezers.length === 1 ? bestFreezers[0].freezerId : null;

  return {
    quantity: qtyExtracted.quantity,
    inferredProductQuery,
    inferredLocationQuery,
    inferredFreezerQuery,
    suggestedFallbackProducts,
    suggestedFallbackLocations,
    suggestedTemplateCandidates,
    suggestedFreezerId,
    suggestedFallbackFreezers,
  };
}

/**
 * Evaluate a single parsed clause (with optional user selection overrides) against live state.
 */
export function evaluateParsedClause(
  baseClause: Omit<
    ParsedVoiceClause,
    | 'productCandidates'
    | 'selectedProductId'
    | 'requiresProductSelection'
    | 'sourceLocationCandidates'
    | 'selectedSourceContainerId'
    | 'requiresSourceLocationSelection'
    | 'destLocationCandidates'
    | 'selectedDestContainerId'
    | 'requiresDestLocationSelection'
    | 'cutCandidates'
    | 'selectedMeatCutId'
    | 'requiresCutSelection'
    | 'queryResults'
    | 'isValid'
    | 'excluded'
    | 'errorMessage'
    | 'warningMessage'
  >,
  state: InventoryState,
  override?: VoiceSelectionOverrides
): ParsedVoiceClause {
  const minQty = baseClause.intent === 'set_quantity' ? 0 : 1;
  let quantity =
    override?.quantity !== undefined
      ? Math.max(minQty, override.quantity)
      : Math.max(minQty, baseClause.quantity);
  const excluded = Boolean(override?.excluded);

  // Handle CONTAINER CONTENTS / LOCATION / COUNT QUERY intent
  if (baseClause.intent === 'container_query') {
    const rawLoc = baseClause.sourceLocationQuery || '';
    const locFilter = baseClause.queryLocationFilter;
    const mode = baseClause.containerQueryMode || 'contents';
    const explicitAllContainers = baseClause.productQuery === '__all_containers__';

    let locCandidates: VoiceLocationCandidate[] = [];
    let resolvedTargetLabel: string | undefined;
    let errorMessage: string | undefined;

    if (mode === 'empty' || mode === 'staging') {
      const includeLooseInStaging = mode === 'staging';
      const allLocs = getAllActiveLocationCandidates(state, includeLooseInStaging);
      let candidatePool =
        mode === 'staging'
          ? allLocs.filter(c => c.isStaging)
          : allLocs.filter(c => !c.isLoose);

      if (mode === 'empty' && locFilter) {
        const freezerMatches = resolveOnSiteFreezerCandidates(locFilter, state);
        if (freezerMatches.length === 0) {
          errorMessage = `No on-site freezer matched "${locFilter}".`;
          candidatePool = [];
        } else {
          const topScore = freezerMatches[0].score;
          const selectedFreezers = freezerMatches.filter(f => f.score >= topScore - 5);
          const allowedFreezerIds = new Set(selectedFreezers.map(f => f.freezerId));
          resolvedTargetLabel = selectedFreezers.map(f => f.freezerName).join(' / ');
          candidatePool = candidatePool.filter(c =>
            c.isStaging ? allowedFreezerIds.has('__staging__') : Boolean(c.freezerId && allowedFreezerIds.has(c.freezerId))
          );
        }
      } else if (mode === 'staging') {
        resolvedTargetLabel = 'Staging Area';
      }

      const rawResults: VoiceContainerQueryResult[] = candidatePool.map(loc => {
        const items = getContainerCutSummaries(loc.containerId, state);
        const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);
        return {
          containerId: loc.containerId,
          containerName: loc.containerName,
          freezerId: loc.freezerId,
          freezerName: loc.freezerName,
          isDisplay: loc.isDisplay,
          isLoose: loc.isLoose,
          isStaging: loc.isStaging,
          label: loc.label,
          totalPieces,
          items,
        };
      });

      const containerQueryResults =
        mode === 'empty'
          ? rawResults.filter(r => r.totalPieces === 0)
          : rawResults.filter(r => !r.isLoose || r.totalPieces > 0);

      return {
        ...baseClause,
        quantity,
        excluded,
        productCandidates: [],
        selectedProductId: null,
        requiresProductSelection: false,
        sourceLocationCandidates: candidatePool,
        selectedSourceContainerId: null,
        requiresSourceLocationSelection: false,
        destLocationCandidates: [],
        selectedDestContainerId: null,
        requiresDestLocationSelection: false,
        cutCandidates: [],
        selectedMeatCutId: null,
        requiresCutSelection: false,
        containerQueryResults,
        containerQueryMode: mode,
        containerQueryTargetLabel: resolvedTargetLabel,
        queryLocationFilter: locFilter,
        isValid: !errorMessage,
        errorMessage,
      };
    }

    if (explicitAllContainers) {
      const allNamed = getAllActiveLocationCandidates(state, false);
      if (locFilter) {
        const freezerMatches = resolveOnSiteFreezerCandidates(locFilter, state);
        if (freezerMatches.length === 0) {
          errorMessage = `No on-site freezer matched "${locFilter}".`;
        } else {
          const topScore = freezerMatches[0].score;
          const selectedFreezers = freezerMatches.filter(f => f.score >= topScore - 5);
          const allowedFreezerIds = new Set(selectedFreezers.map(f => f.freezerId));
          resolvedTargetLabel = selectedFreezers.map(f => f.freezerName).join(' / ');
          locCandidates = allNamed.filter(c =>
            c.isStaging ? allowedFreezerIds.has('__staging__') : Boolean(c.freezerId && allowedFreezerIds.has(c.freezerId))
          );
        }
      } else {
        locCandidates = allNamed;
      }
    } else if (locFilter) {
      const freezerMatches = resolveOnSiteFreezerCandidates(locFilter, state);
      const allowLoose = /\b(?:loose|display|staging)\b/i.test(rawLoc);
      if (freezerMatches.length > 0) {
        const topScore = freezerMatches[0].score;
        const selectedFreezers = freezerMatches.filter(f => f.score >= topScore - 5);
        const allowedFreezerIds = new Set(selectedFreezers.map(f => f.freezerId));
        resolvedTargetLabel = selectedFreezers.map(f => f.freezerName).join(' / ');

        const candidatesInScope = resolveOnSiteLocationCandidates(rawLoc, state, allowLoose ? 'any' : 'source').filter(
          c =>
            (!c.isLoose || allowLoose) &&
            (c.isStaging
              ? allowedFreezerIds.has('__staging__')
              : Boolean(c.freezerId && allowedFreezerIds.has(c.freezerId)))
        );
        locCandidates = candidatesInScope;
      } else {
        // Fallback: try combined hierarchical expression "<container> in <location>"
        const combinedCandidates = rawLoc
          ? resolveOnSiteLocationCandidates(`${rawLoc} in ${locFilter}`, state, allowLoose ? 'any' : 'source').filter(
              c => !c.isLoose || allowLoose
            )
          : [];
        if (combinedCandidates.length > 0) {
          locCandidates = combinedCandidates;
        } else {
          errorMessage = `No on-site freezer matched "${locFilter}".`;
        }
      }
    } else if (rawLoc) {
      const allowLoose = mode === 'contents' || /\b(?:loose|display|staging)\b/i.test(rawLoc);
      const rawCandidates = resolveOnSiteLocationCandidates(rawLoc, state, allowLoose ? 'any' : 'source');
      locCandidates = allowLoose ? rawCandidates : rawCandidates.filter(c => !c.isLoose);
    }

    const containerQueryResults: VoiceContainerQueryResult[] = locCandidates.map(loc => {
      const items = getContainerCutSummaries(loc.containerId, state);
      const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);
      return {
        containerId: loc.containerId,
        containerName: loc.containerName,
        freezerId: loc.freezerId,
        freezerName: loc.freezerName,
        isDisplay: loc.isDisplay,
        isLoose: loc.isLoose,
        isStaging: loc.isStaging,
        label: loc.label,
        totalPieces,
        items,
      };
    });

    if (!errorMessage && containerQueryResults.length === 0) {
      const freezerResolved = Boolean(resolvedTargetLabel || explicitAllContainers);
      const isTypedFreezerFilterQuery =
        freezerResolved &&
        new RegExp(`^${ALL_CONTAINER_NOUN_PATTERN}$`, 'i').test(rawLoc.trim());
      if (!(mode === 'count' && freezerResolved) && !(explicitAllContainers && freezerResolved) && !isTypedFreezerFilterQuery) {
        errorMessage = resolvedTargetLabel
          ? `No on-site container matched "${rawLoc}" in ${resolvedTargetLabel}.`
          : `No on-site container or freezer matched "${rawLoc || locFilter || ''}".`;
      }
    }

    return {
      ...baseClause,
      quantity,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: locCandidates,
      selectedSourceContainerId: locCandidates.length === 1 ? locCandidates[0].containerId : null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      containerQueryResults,
      containerQueryMode: mode,
      containerQueryTargetLabel: resolvedTargetLabel,
      queryLocationFilter: locFilter || (mode === 'contents' ? rawLoc : undefined),
      isValid: !errorMessage && (containerQueryResults.length > 0 || (Boolean(resolvedTargetLabel) && (mode === 'count' || explicitAllContainers))),
      errorMessage,
    };
  }

  // Handle EMPTY CONTAINER and MOVE ALL CONTENTS intents
  if (baseClause.intent === 'empty_container' || baseClause.intent === 'move_all') {
    let sourceLocationCandidates = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'source')
      : [];
    if (
      override?.sourceContainerId &&
      !sourceLocationCandidates.some(l => l.containerId === override.sourceContainerId)
    ) {
      const ovLoc = getAllActiveLocationCandidates(state, true).find(
        l => l.containerId === override.sourceContainerId
      );
      if (ovLoc) {
        sourceLocationCandidates = [{ ...ovLoc, score: 100, isExact: true }, ...sourceLocationCandidates];
      }
    }

    // Prefer non-empty source containers if ambiguity comes strictly from empty ones
    const nonEmptySource = sourceLocationCandidates.filter(
      l => getContainerCutSummaries(l.containerId, state).length > 0
    );
    const effectiveSourceCandidates =
      nonEmptySource.length > 0 ? nonEmptySource : sourceLocationCandidates;

    const srcPick = pickSingleOrRequireSelection(
      effectiveSourceCandidates,
      l => l.containerId,
      override?.sourceContainerId
    );
    const selectedSourceContainerId = srcPick.selectedId;
    const requiresSourceLocationSelection = srcPick.requiresSelection;

    let destLocationCandidates: VoiceLocationCandidate[] = [];
    let selectedDestContainerId: string | null = null;
    let requiresDestLocationSelection = false;

    if (baseClause.destLocationQuery) {
      destLocationCandidates = resolveOnSiteLocationCandidates(
        baseClause.destLocationQuery,
        state,
        'dest'
      );
      if (
        override?.destContainerId &&
        !destLocationCandidates.some(l => l.containerId === override.destContainerId)
      ) {
        const ovDest = getAllActiveLocationCandidates(state, true).find(
          l => l.containerId === override.destContainerId
        );
        if (ovDest) {
          destLocationCandidates = [{ ...ovDest, score: 100, isExact: true }, ...destLocationCandidates];
        }
      }
      const destPick = pickSingleOrRequireSelection(
        destLocationCandidates,
        l => l.containerId,
        override?.destContainerId
      );
      selectedDestContainerId = destPick.selectedId;
      requiresDestLocationSelection = destPick.requiresSelection;
    } else if (baseClause.intent === 'empty_container') {
      const allDest = getAllActiveLocationCandidates(state);
      const stagingLoose = allDest.find(d => d.containerId === 'staging_loose');
      destLocationCandidates = stagingLoose
        ? [stagingLoose, ...allDest.filter(d => d.containerId !== 'staging_loose')]
        : allDest;
      if (
        override?.destContainerId &&
        destLocationCandidates.some(d => d.containerId === override.destContainerId)
      ) {
        selectedDestContainerId = override.destContainerId;
      } else if (stagingLoose) {
        selectedDestContainerId = 'staging_loose';
      }
      requiresDestLocationSelection = !selectedDestContainerId;
    } else {
      destLocationCandidates = getAllActiveLocationCandidates(state).filter(
        d => d.containerId !== selectedSourceContainerId
      );
      const destPick = pickSingleOrRequireSelection(
        destLocationCandidates,
        l => l.containerId,
        override?.destContainerId
      );
      selectedDestContainerId = destPick.selectedId;
      requiresDestLocationSelection =
        destLocationCandidates.length > 0 && !selectedDestContainerId;
    }

    const rawPreviews = selectedSourceContainerId
      ? getContainerCutSummaries(selectedSourceContainerId, state)
      : [];

    const exceptQueries = (baseClause.exceptProductQueries || []).filter(Boolean);
    const excludedIds = new Set<string>();
    let exceptError: string | undefined;
    if (exceptQueries.length > 0) {
      for (const eq of exceptQueries) {
        const matches = resolveOnSiteProductCandidates(eq, state, selectedSourceContainerId ? new Set([selectedSourceContainerId]) : undefined);
        if (matches.length === 0) {
          exceptError = `No item matched excluded product "${eq}".`;
          break;
        }
        const topScore = matches[0].score;
        for (const pm of matches) {
          if (pm.isExact || pm.score >= topScore - 5) {
            excludedIds.add(pm.product.id);
          }
        }
      }
    }

    const containerCutPreviews =
      excludedIds.size > 0
        ? rawPreviews.filter(item => !excludedIds.has(item.product.id))
        : rawPreviews;

    let errorMessage: string | undefined;
    if (sourceLocationCandidates.length === 0) {
      errorMessage = `No on-site container matched "${baseClause.sourceLocationQuery || ''}".`;
    } else if (baseClause.destLocationQuery && destLocationCandidates.length === 0) {
      errorMessage = `No on-site destination matched "${baseClause.destLocationQuery}".`;
    } else if (
      selectedSourceContainerId &&
      selectedDestContainerId &&
      selectedSourceContainerId === selectedDestContainerId
    ) {
      errorMessage =
        baseClause.intent === 'empty_container' && selectedSourceContainerId === 'staging_loose'
          ? 'Staging Area (Loose) is already the Sorting Table.'
          : 'Source and destination containers cannot be the same.';
    } else if (exceptError) {
      errorMessage = exceptError;
    } else if (selectedSourceContainerId && rawPreviews.length === 0) {
      const srcLabel =
        effectiveSourceCandidates.find(l => l.containerId === selectedSourceContainerId)?.label ||
        baseClause.sourceLocationQuery ||
        'container';
      errorMessage = `${srcLabel} is already empty.`;
    } else if (selectedSourceContainerId && containerCutPreviews.length === 0 && excludedIds.size > 0) {
      const srcLabel =
        effectiveSourceCandidates.find(l => l.containerId === selectedSourceContainerId)?.label ||
        baseClause.sourceLocationQuery ||
        'container';
      errorMessage = `All items in ${srcLabel} were excluded — nothing left to move.`;
    }

    const selectedDestLoc = destLocationCandidates.find(
      d => d.containerId === selectedDestContainerId
    );
    let warningMessage: string | undefined;
    if (!errorMessage && selectedDestLoc?.isDisplay && containerCutPreviews.length > 0) {
      const excludedTagSet = getExcludedFromDisplayRestockTagIds(state.tags);
      const excludedItems = containerCutPreviews.filter(item =>
        isCutExcludedFromDisplayRestock(item.meatCut, excludedTagSet)
      );
      if (excludedItems.length > 0) {
        const excludedTagNames = Array.from(
          new Set(
            excludedItems.flatMap(item =>
              getCutExcludedRestockTags(item.meatCut, state.tags).map(t => t.name)
            )
          )
        );
        warningMessage = `${excludedItems.length} item stack(s) in this container carry tag${
          excludedTagNames.length > 1 ? 's' : ''
        } excluded from Display Restock (${excludedTagNames.join(', ')}).`;
      }
    }

    const hasUnresolvedSelection =
      requiresSourceLocationSelection || requiresDestLocationSelection;

    const isValid =
      !errorMessage &&
      !hasUnresolvedSelection &&
      Boolean(selectedSourceContainerId) &&
      Boolean(selectedDestContainerId) &&
      containerCutPreviews.length > 0;

    const suggestedFallbackLocations =
      sourceLocationCandidates.length === 0
        ? findFallbackLocations(baseClause.sourceLocationQuery, state, { mode: 'source', limit: 8 })
        : baseClause.destLocationQuery && destLocationCandidates.length === 0
        ? findFallbackLocations(baseClause.destLocationQuery, state, { mode: 'dest', limit: 8 })
        : undefined;

    return {
      ...baseClause,
      quantity: containerCutPreviews.reduce((s, c) => s + c.quantity, 0) || 1,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: effectiveSourceCandidates,
      selectedSourceContainerId,
      requiresSourceLocationSelection,
      destLocationCandidates,
      selectedDestContainerId,
      requiresDestLocationSelection,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      containerCutPreviews,
      excludedProductIds: Array.from(excludedIds),
      suggestedFallbackLocations,
      isValid,
      errorMessage,
      warningMessage,
    };
  }

  // Handle MOVE CONTAINER (relocate whole container intact to another freezer or Staging Area)
  if (baseClause.intent === 'move_container') {
    let rawMatchedSources = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'source').filter(
          l => !l.isLoose
        )
      : [];
    if (
      override?.sourceContainerId &&
      !rawMatchedSources.some(l => l.containerId === override.sourceContainerId)
    ) {
      const ovLoc = getAllActiveLocationCandidates(state, false).find(
        l => l.containerId === override.sourceContainerId
      );
      if (ovLoc) {
        rawMatchedSources = [{ ...ovLoc, score: 100, isExact: true }, ...rawMatchedSources];
      }
    }

    const srcPick = pickSingleOrRequireSelection(
      rawMatchedSources,
      l => l.containerId,
      override?.sourceContainerId
    );
    const selectedSourceContainerId = srcPick.selectedId;
    const requiresSourceLocationSelection = srcPick.requiresSelection;

    const hasFreezerQuery = Boolean(baseClause.destLocationQuery?.trim());
    const matchedFreezers = hasFreezerQuery
      ? resolveOnSiteFreezerCandidates(baseClause.destLocationQuery, state)
      : [];
    const allFreezerOptions = resolveOnSiteFreezerCandidates(undefined, state);
    const overriddenFreezerOption = override?.freezerId
      ? allFreezerOptions.find(f => f.freezerId === override.freezerId)
      : undefined;
    const freezerCandidates =
      matchedFreezers.length > 0
        ? overriddenFreezerOption &&
          !matchedFreezers.some(f => f.freezerId === overriddenFreezerOption.freezerId)
          ? [overriddenFreezerOption, ...matchedFreezers]
          : matchedFreezers
        : allFreezerOptions;

    let selectedFreezerId: string | null = null;
    let requiresFreezerSelection = false;
    let freezerError: string | undefined;

    if (overriddenFreezerOption) {
      selectedFreezerId = overriddenFreezerOption.freezerId;
      requiresFreezerSelection = false;
    } else if (!hasFreezerQuery) {
      selectedFreezerId = null;
      requiresFreezerSelection = true;
    } else if (matchedFreezers.length === 0) {
      selectedFreezerId = null;
      requiresFreezerSelection = true;
      freezerError = `No on-site freezer matched "${baseClause.destLocationQuery}".`;
    } else {
      const fPick = pickSingleOrRequireSelection(
        matchedFreezers,
        f => f.freezerId,
        override?.freezerId
      );
      selectedFreezerId = fPick.selectedId;
      requiresFreezerSelection = fPick.requiresSelection;
    }

    const selectedSourceObj = rawMatchedSources.find(
      l => l.containerId === selectedSourceContainerId
    );
    const containerCutPreviews = selectedSourceContainerId
      ? getContainerCutSummaries(selectedSourceContainerId, state)
      : [];

    let errorMessage: string | undefined;
    let warningMessage: string | undefined;

    if (rawMatchedSources.length === 0) {
      errorMessage = `No named on-site container matched "${baseClause.sourceLocationQuery || ''}".`;
    } else if (freezerError && !requiresFreezerSelection) {
      errorMessage = freezerError;
    } else if (selectedSourceObj && selectedFreezerId) {
      const currentFreezerKey = selectedSourceObj.freezerId || '__staging__';
      if (currentFreezerKey === selectedFreezerId) {
        const fName =
          freezerCandidates.find(f => f.freezerId === selectedFreezerId)?.freezerName || 'that location';
        errorMessage = `"${selectedSourceObj.containerName}" is already in ${fName}.`;
      } else {
        const destFreezer = (state.freezers || []).find(f => f.id === selectedFreezerId);
        if (destFreezer?.isLooseOnly) {
          warningMessage = `"${destFreezer.name}" only holds loose stock — moving a container there will unpack its items into loose layers and retire the container.`;
        }
      }
    }

    const hasUnresolvedSelection = requiresSourceLocationSelection || requiresFreezerSelection;
    const isValid =
      !errorMessage &&
      !hasUnresolvedSelection &&
      Boolean(selectedSourceContainerId) &&
      Boolean(selectedFreezerId);

    return {
      ...baseClause,
      quantity: containerCutPreviews.reduce((s, c) => s + c.quantity, 0) || 1,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: rawMatchedSources,
      selectedSourceContainerId,
      requiresSourceLocationSelection,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      freezerCandidates,
      selectedFreezerId,
      requiresFreezerSelection,
      containerCutPreviews,
      suggestedFallbackLocations:
        rawMatchedSources.length === 0
          ? findFallbackLocations(baseClause.sourceLocationQuery, state, {
              mode: 'source',
              onlyNonLoose: true,
              limit: 8,
            })
          : undefined,
      isValid,
      errorMessage,
      warningMessage,
    };
  }

  // Handle COMBINE / MERGE CONTAINERS intent
  if (baseClause.intent === 'combine_containers') {
    const rawSlots = baseClause.combineSlots || [];
    const slotOverrides = override?.combineSlotSelections || {};

    const evaluatedSlots: VoiceCombineSlot[] = rawSlots.map(slot => {
      const candidates = resolveOnSiteLocationCandidates(slot.query, state, 'any');
      const slotOverrideId = slotOverrides[slot.slotIndex];
      const pick = pickSingleOrRequireSelection(candidates, l => l.containerId, slotOverrideId);
      return {
        slotIndex: slot.slotIndex,
        query: slot.query,
        candidates,
        selectedContainerId: pick.selectedId,
        requiresSelection: pick.requiresSelection,
      };
    });

    const anySlotUnmatched = evaluatedSlots.find(s => s.candidates.length === 0);
    const anySlotNeedsSelection = evaluatedSlots.some(s => s.requiresSelection);
    const allSlotsSelected = evaluatedSlots.length >= 2 && evaluatedSlots.every(s => Boolean(s.selectedContainerId));

    // Build surviving destination candidates:
    // If combineTargetQuery was explicitly specified separately (e.g. "combine X and Y into Z"), resolve Z;
    // otherwise allow picking any resolved participating container (defaulting ONLY if combineExplicitTarget=true and directional target slot was resolved).
    const slotSelectedCandidates: VoiceLocationCandidate[] = [];
    const seenDestIds = new Set<string>();
    for (const s of evaluatedSlots) {
      if (!s.selectedContainerId || seenDestIds.has(s.selectedContainerId)) continue;
      const matched = s.candidates.find(c => c.containerId === s.selectedContainerId);
      if (matched) {
        seenDestIds.add(matched.containerId);
        slotSelectedCandidates.push(matched);
      }
    }

    let destLocationCandidates: VoiceLocationCandidate[] = [];
    let selectedDestContainerId: string | null = null;
    let requiresDestLocationSelection = false;

    if (baseClause.combineTargetQuery) {
      destLocationCandidates = resolveOnSiteLocationCandidates(
        baseClause.combineTargetQuery,
        state,
        'dest'
      );
      const dPick = pickSingleOrRequireSelection(
        destLocationCandidates,
        l => l.containerId,
        override?.destContainerId
      );
      selectedDestContainerId = dPick.selectedId;
      requiresDestLocationSelection = dPick.requiresSelection;
    } else if (baseClause.combineExplicitTarget && evaluatedSlots.length >= 2) {
      // Directional "merge X into Y": last slot is intended target
      destLocationCandidates = slotSelectedCandidates;
      const lastSlot = evaluatedSlots[evaluatedSlots.length - 1];
      if (
        override?.destContainerId &&
        destLocationCandidates.some(d => d.containerId === override.destContainerId)
      ) {
        selectedDestContainerId = override.destContainerId;
        requiresDestLocationSelection = false;
      } else if (allSlotsSelected && lastSlot.selectedContainerId && slotSelectedCandidates.length >= 2) {
        selectedDestContainerId = lastSlot.selectedContainerId;
        requiresDestLocationSelection = false;
      } else {
        selectedDestContainerId = null;
        requiresDestLocationSelection = allSlotsSelected && slotSelectedCandidates.length >= 2;
      }
    } else {
      // Symmetric "combine containers X and Y": require explicit choice of which container survives!
      destLocationCandidates = slotSelectedCandidates;
      if (
        override?.destContainerId &&
        destLocationCandidates.some(d => d.containerId === override.destContainerId)
      ) {
        selectedDestContainerId = override.destContainerId;
        requiresDestLocationSelection = false;
      } else {
        selectedDestContainerId = null;
        requiresDestLocationSelection = allSlotsSelected && destLocationCandidates.length >= 2;
      }
    }

    // Gather cuts that will be moved from absorbed containers into selectedDestContainerId
    const absorbedContainerIds = Array.from(
      new Set(
        evaluatedSlots
          .map(s => s.selectedContainerId)
          .filter((id): id is string => Boolean(id) && id !== selectedDestContainerId)
      )
    );
    const containerCutPreviews = absorbedContainerIds.flatMap(cid =>
      getContainerCutSummaries(cid, state)
    );

    const uniqueParticipatingIds = new Set(
      [
        ...evaluatedSlots.map(s => s.selectedContainerId).filter((id): id is string => Boolean(id)),
        ...(selectedDestContainerId ? [selectedDestContainerId] : []),
      ]
    );

    let errorMessage: string | undefined;
    if (anySlotUnmatched) {
      errorMessage = `No on-site container matched "${anySlotUnmatched.query}".`;
    } else if (baseClause.combineTargetQuery && destLocationCandidates.length === 0) {
      errorMessage = `No on-site destination container matched "${baseClause.combineTargetQuery}".`;
    } else if (allSlotsSelected && uniqueParticipatingIds.size < 2) {
      errorMessage = 'Select at least two different containers to combine.';
    } else if (
      allSlotsSelected &&
      selectedDestContainerId &&
      !anySlotNeedsSelection &&
      !requiresDestLocationSelection &&
      containerCutPreviews.length === 0
    ) {
      const targetLabel =
        destLocationCandidates.find(d => d.containerId === selectedDestContainerId)?.label ||
        'target container';
      errorMessage = `The container(s) being merged into ${targetLabel} are empty — nothing to combine.`;
    }

    const hasUnresolvedSelection = anySlotNeedsSelection || requiresDestLocationSelection;
    const isValid =
      !errorMessage &&
      !hasUnresolvedSelection &&
      allSlotsSelected &&
      Boolean(selectedDestContainerId) &&
      absorbedContainerIds.length >= 1 &&
      containerCutPreviews.length > 0;

    return {
      ...baseClause,
      quantity: containerCutPreviews.reduce((s, c) => s + c.quantity, 0) || 1,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: [],
      selectedSourceContainerId: null,
      requiresSourceLocationSelection: false,
      destLocationCandidates,
      selectedDestContainerId,
      requiresDestLocationSelection,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      combineSlots: evaluatedSlots,
      containerCutPreviews,
      isValid,
      errorMessage,
    };
  }

  // Handle SWAP CONTAINERS intent (swap two containers' freezer assignments)
  if (baseClause.intent === 'swap_containers') {
    const rawSlots = baseClause.combineSlots || [];
    const slotOverrides = override?.combineSlotSelections || {};
    const evaluatedSlots: VoiceCombineSlot[] = rawSlots.map(slot => {
      const candidates = resolveOnSiteLocationCandidates(slot.query, state, 'source').filter(
        c => !c.isLoose
      );
      const pick = pickSingleOrRequireSelection(candidates, l => l.containerId, slotOverrides[slot.slotIndex]);
      return {
        slotIndex: slot.slotIndex,
        query: slot.query,
        candidates,
        selectedContainerId: pick.selectedId,
        requiresSelection: pick.requiresSelection,
      };
    });

    const anyUnmatched = evaluatedSlots.find(s => s.candidates.length === 0);
    const anyNeedsSelection = evaluatedSlots.some(s => s.requiresSelection);
    const firstId = evaluatedSlots[0]?.selectedContainerId;
    const secondId = evaluatedSlots[1]?.selectedContainerId;
    const contA = firstId ? (state.containers || []).find(c => c.id === firstId) : undefined;
    const contB = secondId ? (state.containers || []).find(c => c.id === secondId) : undefined;

    let errorMessage: string | undefined;
    if (evaluatedSlots.length < 2) {
      errorMessage = 'Specify two containers to swap (e.g. "swap red bag and blue bag").';
    } else if (anyUnmatched) {
      errorMessage = `No named on-site container matched "${anyUnmatched.query}".`;
    } else if (firstId && secondId && firstId === secondId) {
      errorMessage = 'Choose two different containers to swap.';
    } else if (contA && contB && (contA.freezerId || undefined) === (contB.freezerId || undefined)) {
      const fName = contA.freezerId
        ? (state.freezers || []).find(f => f.id === contA.freezerId)?.name || 'the same freezer'
        : 'Staging Area';
      errorMessage = `"${contA.name}" and "${contB.name}" are already in ${fName}.`;
    }

    const isValid =
      !errorMessage &&
      !anyNeedsSelection &&
      Boolean(contA) &&
      Boolean(contB) &&
      firstId !== secondId;

    return {
      ...baseClause,
      quantity: 1,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: [],
      selectedSourceContainerId: firstId || null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: secondId || null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      combineSlots: evaluatedSlots,
      isValid,
      errorMessage,
    };
  }

  // Handle RENAME CONTAINER intent
  if (baseClause.intent === 'rename_container') {
    const rawMatched = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'source').filter(
          c => !c.isLoose
        )
      : [];
    const pick = pickSingleOrRequireSelection(rawMatched, l => l.containerId, override?.sourceContainerId);
    const selectedSourceContainerId = pick.selectedId;
    const requiresSourceLocationSelection = pick.requiresSelection;
    const chosen = rawMatched.find(l => l.containerId === selectedSourceContainerId);
    const newName = (baseClause.newContainerNameInput || '').trim();

    let errorMessage: string | undefined;
    if (!baseClause.sourceLocationQuery?.trim()) {
      errorMessage = 'Specify which container to rename (e.g. "rename box 4 in chest 1 to sausage box").';
    } else if (rawMatched.length === 0) {
      errorMessage = `No named on-site container matched "${baseClause.sourceLocationQuery}".`;
    } else if (!newName) {
      errorMessage = 'Specify the new name for the container.';
    } else if (chosen && normalizeText(chosen.containerName) === normalizeText(newName)) {
      errorMessage = `"${chosen.containerName}" already has that name.`;
    }

    return {
      ...baseClause,
      quantity: 1,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: rawMatched,
      selectedSourceContainerId,
      requiresSourceLocationSelection,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      newContainerNameInput: newName,
      isValid: !errorMessage && !requiresSourceLocationSelection && Boolean(selectedSourceContainerId) && Boolean(newName),
      errorMessage,
    };
  }

  // Handle ARCHIVE / UNARCHIVE CONTAINER & DELETE CONTAINER intents
  if (baseClause.intent === 'archive_container' || baseClause.intent === 'delete_container') {
    const isUnarchive = baseClause.intent === 'archive_container' && baseClause.archiveState === false;
    const rawMatched = baseClause.sourceLocationQuery
      ? resolveArchivedOrActiveContainerCandidates(baseClause.sourceLocationQuery, state, {
          includeArchived: isUnarchive,
          onlyArchived: isUnarchive,
        })
      : [];
    const pick = pickSingleOrRequireSelection(rawMatched, l => l.containerId, override?.sourceContainerId);
    const selectedSourceContainerId = pick.selectedId;
    const requiresSourceLocationSelection = pick.requiresSelection;
    const containerCutPreviews = selectedSourceContainerId
      ? getContainerCutSummaries(selectedSourceContainerId, state)
      : [];
    const totalInside = containerCutPreviews.reduce((s, c) => s + c.quantity, 0);

    let errorMessage: string | undefined;
    let warningMessage: string | undefined;
    if (rawMatched.length === 0) {
      errorMessage = isUnarchive
        ? `No archived on-site container matched "${baseClause.sourceLocationQuery || ''}".`
        : `No named on-site container matched "${baseClause.sourceLocationQuery || ''}".`;
    } else if (selectedSourceContainerId && totalInside > 0 && (baseClause.intent === 'delete_container' || baseClause.archiveState !== false)) {
      warningMessage = `Contains ${totalInside} piece(s) — ${
        baseClause.intent === 'delete_container' ? 'deleting' : 'archiving'
      } will move all items to the Sorting Table (Staging Area).`;
    }

    return {
      ...baseClause,
      quantity: totalInside || 1,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: rawMatched,
      selectedSourceContainerId,
      requiresSourceLocationSelection,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      containerCutPreviews,
      isValid: !errorMessage && !requiresSourceLocationSelection && Boolean(selectedSourceContainerId),
      errorMessage,
      warningMessage,
    };
  }

  // Handle UNDO LAST COMMAND intent
  if (baseClause.intent === 'undo_last') {
    const latestHistory = (state.history || [])[0];
    const hasUndo = Boolean(latestHistory);
    return {
      ...baseClause,
      quantity: 1,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: [],
      selectedSourceContainerId: null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      undoTargetDescription: latestHistory?.description || undefined,
      undoTargetTimestamp: latestHistory?.timestamp || undefined,
      isValid: hasUndo,
      errorMessage: hasUndo ? undefined : 'No recent history action found to undo.',
    };
  }

  // Handle MANAGE LIST intent (add/remove/set_threshold/toggle alert on CustomList)
  if (baseClause.intent === 'manage_list') {
    const listAction = baseClause.listAction || 'add';
    const allLists = state.customLists || [];
    const matchedLists = baseClause.listQueryText?.trim()
      ? resolveCustomListCandidates(baseClause.listQueryText, state)
      : allLists.map(list => ({
          list,
          score: 50,
          matchReason: 'fuzzy' as MatchReason,
          isExact: false,
        }));

    const listPick = pickSingleOrRequireSelection(
      matchedLists,
      l => l.list.id,
      override?.listId
    );
    const selectedListId = listPick.selectedId;
    const requiresListSelection = listPick.requiresSelection;

    const selectedListObj = matchedLists.find(l => l.list.id === selectedListId)?.list;
    const rawProductCandidates = baseClause.pinnedProductId
      ? resolvePinnedProductCandidates(baseClause.pinnedProductId, state)
      : baseClause.productQuery.trim()
      ? resolveOnSiteProductCandidates(baseClause.productQuery, state)
      : [];
    const onListCandidates =
      !baseClause.pinnedProductId && selectedListObj && listAction !== 'add' && rawProductCandidates.length > 1
        ? rawProductCandidates.filter(c =>
            selectedListObj.items.some(i => i.productId === c.product.id)
          )
        : [];
    const productCandidates =
      onListCandidates.length > 0 ? onListCandidates : rawProductCandidates;
    const prodPick = baseClause.pinnedProductId
      ? {
          selectedId: productCandidates[0]?.product.id || null,
          requiresSelection: false,
        }
      : pickSingleOrRequireSelection(
          productCandidates,
          p => p.product.id,
          override?.productId
        );
    const selectedProductId = prodPick.selectedId;
    const requiresProductSelection = prodPick.requiresSelection;

    let errorMessage: string | undefined;
    let warningMessage: string | undefined;
    const selectedProdObj = productCandidates.find(p => p.product.id === selectedProductId)?.product;

    if (allLists.length === 0) {
      errorMessage = 'No custom lists exist yet. Create a list in Restock / Lists first.';
    } else if (baseClause.listQueryText && matchedLists.length === 0) {
      errorMessage = `No custom list matched "${baseClause.listQueryText}".`;
    } else if (productCandidates.length === 0) {
      errorMessage = baseClause.pinnedProductId
        ? `Product "${baseClause.productQuery}" in voice pack "${baseClause.bundlePhrase || ''}" is archived or no longer exists.`
        : `No on-site product matched "${baseClause.productQuery || ''}".`;
    } else if (selectedListObj && selectedProdObj) {
      const alreadyOnList = selectedListObj.items.some(i => i.productId === selectedProdObj.id);
      if (listAction === 'add' && alreadyOnList && baseClause.listThreshold === undefined) {
        warningMessage = `"${selectedProdObj.name}" is already on "${selectedListObj.name}".`;
      } else if (listAction === 'remove' && !alreadyOnList) {
        warningMessage = `"${selectedProdObj.name}" is not currently on "${selectedListObj.name}".`;
      }
    }

    const isValid =
      !errorMessage &&
      !requiresListSelection &&
      !requiresProductSelection &&
      Boolean(selectedListId) &&
      Boolean(selectedProductId);

    return {
      ...baseClause,
      quantity: baseClause.listThreshold !== undefined ? baseClause.listThreshold : 1,
      excluded,
      productCandidates,
      selectedProductId,
      requiresProductSelection,
      sourceLocationCandidates: [],
      selectedSourceContainerId: null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      listAction,
      listCandidates: matchedLists,
      selectedListId,
      requiresListSelection,
      isValid,
      errorMessage,
      warningMessage,
    };
  }

  // Handle LIST QUERY intent (read-only list contents / membership check)
  if (baseClause.intent === 'list_query') {
    const allLists = state.customLists || [];
    const prodMap = new Map((state.products || []).filter(p => !p.isArchived).map(p => [p.id, p]));
    const activeContainerIds = new Set((state.containers || []).filter(c => !c.isArchived).map(c => c.id));
    const productQtyMap = new Map<string, number>();
    for (const mc of state.meatCuts || []) {
      if (mc.quantity > 0 && activeContainerIds.has(mc.containerId)) {
        productQtyMap.set(mc.productId, (productQtyMap.get(mc.productId) || 0) + mc.quantity);
      }
    }

    const matchedLists = baseClause.listQueryText?.trim()
      ? resolveCustomListCandidates(baseClause.listQueryText, state).map(c => c.list)
      : allLists;

    const checkedProdMatches = baseClause.productQuery.trim()
      ? resolveOnSiteProductCandidates(baseClause.productQuery, state)
      : [];
    const checkedProduct = checkedProdMatches[0]?.product;

    const listQueryResults: VoiceListQueryResult[] = matchedLists.map(list => {
      const mappedItems = list.items
        .map((it): VoiceListQueryItemSummary | null => {
          const prod = prodMap.get(it.productId);
          if (!prod) return null;
          return {
            product: prod,
            currentOnSiteQty: productQtyMap.get(prod.id) || 0,
            threshold: it.threshold,
            controlSource: it.controlSource,
            notifyEnabled: it.notifyEnabled,
            notes: it.notes,
          };
        })
        .filter((x): x is VoiceListQueryItemSummary => Boolean(x));

      mappedItems.sort((a, b) => {
        const aLow = a.threshold !== undefined && a.currentOnSiteQty <= a.threshold ? 0 : 1;
        const bLow = b.threshold !== undefined && b.currentOnSiteQty <= b.threshold ? 0 : 1;
        if (aLow !== bLow) return aLow - bLow;
        return 0;
      });

      return {
        list,
        items: mappedItems,
        checkedProduct,
        isProductOnList: checkedProduct
          ? list.items.some(it => it.productId === checkedProduct.id)
          : undefined,
      };
    });

    let errorMessage: string | undefined;
    if (allLists.length === 0) {
      errorMessage = 'No custom lists have been created yet.';
    } else if (baseClause.listQueryText && matchedLists.length === 0) {
      errorMessage = `No custom list matched "${baseClause.listQueryText}".`;
    } else if (baseClause.productQuery.trim() && !checkedProduct) {
      errorMessage = `No on-site product matched "${baseClause.productQuery}".`;
    }

    return {
      ...baseClause,
      quantity: 1,
      excluded,
      productCandidates: checkedProdMatches,
      selectedProductId: checkedProduct?.id || null,
      requiresProductSelection: false,
      sourceLocationCandidates: [],
      selectedSourceContainerId: null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      listQueryResults,
      isValid: !errorMessage && listQueryResults.length > 0,
      errorMessage,
    };
  }

  // Handle INVENTORY ALERT QUERY intent (out of stock / low stock / needs restocking)
  if (baseClause.intent === 'inventory_alert_query') {
    let mode = baseClause.alertQueryMode || 'display_out_of_stock';
    const threshold = baseClause.alertThreshold ?? (mode.includes('low') ? 3 : 0);
    const activeContainers = (state.containers || []).filter(c => !c.isArchived);
    const containerMap = new Map(activeContainers.map(c => [c.id, c]));
    const freezerMap = new Map((state.freezers || []).map(f => [f.id, f]));

    const targetLocCandidates = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'any')
      : resolveOnSiteLocationCandidates('display', state, 'any');
    // If no explicit location was named and no display freezer exists, fall back cleanly to global mode
    if (!baseClause.sourceLocationQuery && targetLocCandidates.length === 0 && !mode.startsWith('global_')) {
      mode = mode === 'display_low_stock' ? 'global_low_stock' : mode === 'display_out_of_stock' ? 'global_out_of_stock' : mode;
    }
    const targetContainerIds = new Set(targetLocCandidates.map(l => l.containerId));
    const isGlobalMode = mode === 'global_out_of_stock' || mode === 'global_low_stock';

    let errorMessage: string | undefined;
    if (!isGlobalMode && baseClause.sourceLocationQuery && targetLocCandidates.length === 0) {
      errorMessage = `No on-site location matched "${baseClause.sourceLocationQuery}".`;
    }

    const alertQueryResults: VoiceAlertQueryItem[] = [];
    const excludedRestockTagIds = getExcludedFromDisplayRestockTagIds(state.tags);
    const prioritizedTagIds = getPrioritizeItemTagIds(state.tags);
    const isDisplayAlertContext =
      !isGlobalMode &&
      (!baseClause.sourceLocationQuery || targetLocCandidates.some(l => l.isDisplay));

    if (!errorMessage) {
      for (const product of (state.products || []).filter(p => !p.isArchived)) {
        let targetLocationQty = 0;
        let totalOnSiteQty = 0;
        let backstockQty = 0;
        const backstockByContainer = new Map<
          string,
          { label: string; quantity: number; hasPrioritized: boolean }
        >();

        for (const mc of state.meatCuts || []) {
          if (mc.quantity <= 0 || mc.productId !== product.id) continue;
          const cont = containerMap.get(mc.containerId);
          if (!cont) continue;
          const freezer = cont.freezerId ? freezerMap.get(cont.freezerId) : undefined;
          totalOnSiteQty += mc.quantity;
          if (!isGlobalMode && targetContainerIds.has(mc.containerId)) {
            targetLocationQty += mc.quantity;
          } else if (!freezer?.isSpecial) {
            if (isDisplayAlertContext && isCutExcludedFromDisplayRestock(mc, excludedRestockTagIds)) {
              continue;
            }
            backstockQty += mc.quantity;
            const fName = freezer ? freezer.name : 'Staging Area';
            const label =
              cont.id === 'staging_loose' || cont.id.endsWith('_loose')
                ? `${fName} (Loose)`
                : `${cont.name} (${fName})`;
            const existing = backstockByContainer.get(cont.id);
            backstockByContainer.set(cont.id, {
              label,
              quantity: (existing?.quantity || 0) + mc.quantity,
              hasPrioritized: Boolean(existing?.hasPrioritized || isCutPrioritized(mc, prioritizedTagIds)),
            });
          }
        }

        const matches =
          mode === 'display_out_of_stock'
            ? targetLocationQty === 0
            : mode === 'needs_restock'
            ? targetLocationQty === 0 && backstockQty > 0
            : mode === 'display_low_stock'
            ? targetLocationQty <= threshold && (targetLocationQty > 0 || backstockQty > 0)
            : mode === 'global_out_of_stock'
            ? totalOnSiteQty === 0
            : totalOnSiteQty > 0 && totalOnSiteQty <= threshold;

        if (matches) {
          alertQueryResults.push({
            product,
            targetLocationQty,
            totalOnSiteQty,
            backstockQty,
            backstockLocations: Array.from(backstockByContainer.entries())
              .map(([containerId, info]) => ({
                containerId,
                label: info.label,
                quantity: info.quantity,
                hasPrioritized: info.hasPrioritized,
              }))
              .sort((a, b) => {
                if (Boolean(a.hasPrioritized) !== Boolean(b.hasPrioritized)) {
                  return a.hasPrioritized ? -1 : 1;
                }
                return b.quantity - a.quantity;
              }),
          });
        }
      }
      alertQueryResults.sort((a, b) => {
        if (b.backstockQty !== a.backstockQty) return b.backstockQty - a.backstockQty;
        return a.product.name.localeCompare(b.product.name);
      });
    }

    return {
      ...baseClause,
      quantity: 1,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: targetLocCandidates,
      selectedSourceContainerId: null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      alertQueryMode: mode,
      alertThreshold: threshold,
      alertQueryResults,
      queryLocationFilter: isGlobalMode
        ? 'All Freezers'
        : targetLocCandidates[0]?.label || baseClause.sourceLocationQuery || 'Display',
      isValid: !errorMessage,
      errorMessage,
    };
  }

  // Handle RESTOCK DISPLAY FROM BACKSTOCK intent (guided pull from non-destination storage)
  if (baseClause.intent === 'restock_display') {
    const destQuery = baseClause.destLocationQuery?.trim() || 'display';
    const destLocationCandidates = resolveOnSiteLocationCandidates(destQuery, state, 'dest');
    const destPick = pickSingleOrRequireSelection(
      destLocationCandidates,
      l => l.containerId,
      override?.destContainerId
    );
    const selectedDestContainerId = destPick.selectedId;
    const requiresDestLocationSelection = destPick.requiresSelection;
    const selectedDestLoc = destLocationCandidates.find(
      d => d.containerId === selectedDestContainerId
    );
    const isDisplayDest = selectedDestLoc
      ? selectedDestLoc.isDisplay
      : /\bdisplay\b/i.test(destQuery) || destLocationCandidates.some(d => d.isDisplay);

    const freezerMap = new Map((state.freezers || []).map(f => [f.id, f]));
    const excludedRestockTagIds = getExcludedFromDisplayRestockTagIds(state.tags);
    const prioritizedTagIds = getPrioritizeItemTagIds(state.tags);

    const activeNonSpecialIds = new Set(
      (state.containers || [])
        .filter(c => {
          if (c.isArchived || c.id === selectedDestContainerId) return false;
          const f = c.freezerId ? freezerMap.get(c.freezerId) : undefined;
          return !f?.isSpecial;
        })
        .map(c => c.id)
    );

    let productCandidates = baseClause.pinnedProductId
      ? resolvePinnedProductCandidates(baseClause.pinnedProductId, state, activeNonSpecialIds)
      : baseClause.productQuery.trim()
      ? resolveOnSiteProductCandidates(baseClause.productQuery, state, activeNonSpecialIds)
      : [];

    if (!baseClause.pinnedProductId && isDisplayDest && productCandidates.length > 1) {
      const eligibleBackstockByProduct = new Map<string, number>();
      for (const mc of state.meatCuts || []) {
        if (mc.quantity <= 0 || !activeNonSpecialIds.has(mc.containerId)) continue;
        if (isCutExcludedFromDisplayRestock(mc, excludedRestockTagIds)) continue;
        eligibleBackstockByProduct.set(
          mc.productId,
          (eligibleBackstockByProduct.get(mc.productId) || 0) + mc.quantity
        );
      }
      const eligibleCandidates = productCandidates.filter(
        c => (eligibleBackstockByProduct.get(c.product.id) || 0) > 0
      );
      const hasExactNonEligible = productCandidates.some(
        c => c.isExact && (eligibleBackstockByProduct.get(c.product.id) || 0) === 0
      );
      if (eligibleCandidates.length > 0 && !hasExactNonEligible) {
        productCandidates = eligibleCandidates;
      }
    }

    const prodPick = baseClause.pinnedProductId
      ? {
          selectedId: productCandidates[0]?.product.id || null,
          requiresSelection: false,
        }
      : pickSingleOrRequireSelection(
          productCandidates,
          p => p.product.id,
          override?.productId
        );
    const selectedProductId = prodPick.selectedId;
    const requiresProductSelection = prodPick.requiresSelection;
    const selectedProductObj = productCandidates.find(p => p.product.id === selectedProductId)?.product;

    // Gather non-special backstock cuts (excluding destination container & Display-excluded tags)
    const backstockCuts: VoiceCutCandidate[] = [];
    let excludedBackstockQty = 0;
    const excludedTagNameSet = new Set<string>();

    if (selectedProductId) {
      const containerMap = new Map((state.containers || []).filter(c => !c.isArchived).map(c => [c.id, c]));
      const tagMap = new Map((state.tags || []).map(t => [t.id, t]));
      for (const mc of state.meatCuts || []) {
        if (mc.quantity <= 0 || mc.productId !== selectedProductId) continue;
        if (mc.containerId === selectedDestContainerId) continue;
        const cont = containerMap.get(mc.containerId);
        if (!cont) continue;
        const freezer = cont.freezerId ? freezerMap.get(cont.freezerId) : undefined;
        if (freezer?.isSpecial && destLocationCandidates.some(d => d.containerId === mc.containerId)) {
          continue;
        }
        if (isDisplayDest && isCutExcludedFromDisplayRestock(mc, excludedRestockTagIds)) {
          excludedBackstockQty += mc.quantity;
          for (const exTag of getCutExcludedRestockTags(mc, state.tags)) {
            excludedTagNameSet.add(exTag.name);
          }
          continue;
        }
        const fName = freezer ? freezer.name : 'Staging Area';
        const locLabel =
          cont.id === 'staging_loose' || cont.id.endsWith('_loose')
            ? `${fName} (Loose)`
            : `${cont.name} (${fName})`;
        backstockCuts.push({
          meatCut: mc,
          product: selectedProductObj!,
          container: cont,
          freezer,
          locationLabel: locLabel,
          tags: (mc.tagIds || []).map(id => tagMap.get(id)).filter((t): t is Tag => Boolean(t)),
        });
      }
      // Prioritize `prioritizeItem` tagged stock first, then non-special storage freezers, then larger stacks
      backstockCuts.sort((a, b) => compareBackstockForDisplayRestock(a, b, prioritizedTagIds));
    }

    const totalBackstockAvailable = backstockCuts.reduce((s, c) => s + c.meatCut.quantity, 0);
    const restockAllocations: VoiceRestockAllocation[] = [];
    let remainingNeeded = quantity;

    // If user overrode a specific cut/source container, pull from that first
    const preferredCut = override?.meatCutId
      ? backstockCuts.find(c => c.meatCut.id === override.meatCutId)
      : undefined;
    const orderedCuts = preferredCut
      ? [preferredCut, ...backstockCuts.filter(c => c.meatCut.id !== preferredCut.meatCut.id)]
      : backstockCuts;

    for (const c of orderedCuts) {
      if (remainingNeeded <= 0) break;
      const take = Math.min(remainingNeeded, c.meatCut.quantity);
      if (take > 0) {
        restockAllocations.push({
          meatCut: c.meatCut,
          product: c.product,
          container: c.container,
          freezer: c.freezer,
          locationLabel: c.locationLabel,
          moveQty: take,
          availableQty: c.meatCut.quantity,
          tags: c.tags,
        });
        remainingNeeded -= take;
      }
    }

    const excludedTagNames = Array.from(excludedTagNameSet);
    const prioritizedAllocTags = new Set<string>();
    for (const alloc of restockAllocations) {
      for (const pTag of getCutPrioritizedTags(alloc.meatCut, state.tags)) {
        prioritizedAllocTags.add(pTag.name);
      }
    }
    const ruleParts: string[] = [];
    if (prioritizedAllocTags.size > 0) {
      ruleParts.push(`Prioritized ${Array.from(prioritizedAllocTags).join(', ')} stock`);
    }
    if (excludedBackstockQty > 0) {
      ruleParts.push(
        `Skipped ${excludedBackstockQty} pack(s) excluded by tag (${excludedTagNames.join(', ')})`
      );
    }
    const restockRuleNote = ruleParts.length > 0 ? ruleParts.join(' · ') : undefined;

    let errorMessage: string | undefined;
    if (destLocationCandidates.length === 0) {
      errorMessage = `No display or destination location matched "${destQuery}".`;
    } else if (productCandidates.length === 0) {
      errorMessage = `No on-site product matched "${baseClause.productQuery || ''}".`;
    } else if (selectedProductId && !requiresProductSelection && totalBackstockAvailable === 0) {
      errorMessage =
        excludedBackstockQty > 0
          ? `No eligible backstock of "${selectedProductObj?.name || baseClause.productQuery}" found for Display restock (${excludedBackstockQty} pack(s) excluded by tag rule${excludedTagNames.length > 1 ? 's' : ''}: ${excludedTagNames.join(', ')}).`
          : `No backstock of "${selectedProductObj?.name || baseClause.productQuery}" found to pull from.`;
    } else if (
      selectedProductId &&
      !requiresProductSelection &&
      totalBackstockAvailable < quantity
    ) {
      const exclSuffix =
        excludedBackstockQty > 0
          ? ` (${excludedBackstockQty} pack(s) excluded by tag rule${excludedTagNames.length > 1 ? 's' : ''}: ${excludedTagNames.join(', ')})`
          : '';
      errorMessage = `Only ${totalBackstockAvailable} pack(s) of "${selectedProductObj?.name}" available in backstock (requested ${quantity})${exclSuffix}.`;
    }

    const isValid =
      !errorMessage &&
      !requiresDestLocationSelection &&
      !requiresProductSelection &&
      Boolean(selectedDestContainerId) &&
      Boolean(selectedProductId) &&
      remainingNeeded === 0 &&
      restockAllocations.length > 0;

    return {
      ...baseClause,
      quantity,
      excluded,
      productCandidates,
      selectedProductId,
      requiresProductSelection,
      sourceLocationCandidates: [],
      selectedSourceContainerId: restockAllocations[0]?.container.id || null,
      requiresSourceLocationSelection: false,
      destLocationCandidates,
      selectedDestContainerId,
      requiresDestLocationSelection,
      cutCandidates: backstockCuts,
      selectedMeatCutId: restockAllocations[0]?.meatCut.id || null,
      requiresCutSelection: false,
      restockAllocations,
      restockRuleNote,
      isValid,
      errorMessage,
    };
  }

  // Handle MANAGE TAG intent (apply or remove Tag on a stocked MeatCut)
  if (baseClause.intent === 'manage_tag') {
    const tagAction = baseClause.tagAction || 'add';
    const allTags = state.tags || [];
    const tagCandidates = baseClause.tagQueryText?.trim()
      ? resolveTagCandidates(baseClause.tagQueryText, state)
      : allTags.map(tag => ({ tag, score: 50, matchReason: 'fuzzy' as MatchReason, isExact: false }));

    const tagPick = pickSingleOrRequireSelection(tagCandidates, t => t.tag.id, override?.tagId);
    const selectedTagId = tagPick.selectedId;
    const requiresTagSelection = tagPick.requiresSelection;

    const sourceLocationCandidates = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'any')
      : [];
    const srcPick = pickSingleOrRequireSelection(
      sourceLocationCandidates,
      l => l.containerId,
      override?.sourceContainerId
    );
    const selectedSourceContainerId = srcPick.selectedId;
    const requiresSourceLocationSelection =
      Boolean(baseClause.sourceLocationQuery) && srcPick.requiresSelection;

    const scopedIds =
      sourceLocationCandidates.length > 0
        ? new Set(
            selectedSourceContainerId
              ? [selectedSourceContainerId]
              : sourceLocationCandidates.map(l => l.containerId)
          )
        : undefined;

    const productCandidates = baseClause.productQuery.trim()
      ? resolveOnSiteProductCandidates(baseClause.productQuery, state, scopedIds)
      : [];
    const prodPick = pickSingleOrRequireSelection(
      productCandidates,
      p => p.product.id,
      override?.productId
    );
    const selectedProductId = prodPick.selectedId;
    const requiresProductSelection = prodPick.requiresSelection;

    let cutCandidates: VoiceCutCandidate[] = [];
    if (selectedProductId) {
      cutCandidates = resolveCutCandidates(
        selectedProductId,
        selectedSourceContainerId
          ? [selectedSourceContainerId]
          : sourceLocationCandidates.length > 0
          ? sourceLocationCandidates.map(l => l.containerId)
          : [],
        state
      );
      if (cutCandidates.length === 0 && !selectedSourceContainerId) {
        cutCandidates = resolveCutCandidates(selectedProductId, [], state);
      }
    }

    let selectedMeatCutId: string | null = null;
    let requiresCutSelection = false;
    if (override?.meatCutId && cutCandidates.some(c => c.meatCut.id === override.meatCutId)) {
      selectedMeatCutId = override.meatCutId;
    } else if (cutCandidates.length === 1) {
      selectedMeatCutId = cutCandidates[0].meatCut.id;
    } else if (cutCandidates.length > 1 && !requiresSourceLocationSelection) {
      requiresCutSelection = true;
    }

    const chosenCut = cutCandidates.find(c => c.meatCut.id === selectedMeatCutId);
    const chosenTag = tagCandidates.find(t => t.tag.id === selectedTagId)?.tag;

    let errorMessage: string | undefined;
    let warningMessage: string | undefined;
    if (allTags.length === 0) {
      errorMessage = 'No inventory tags are defined yet. Create tags in Library or Products first.';
    } else if (baseClause.tagQueryText && tagCandidates.length === 0) {
      errorMessage = `No tag matched "${baseClause.tagQueryText}".`;
    } else if (baseClause.sourceLocationQuery && sourceLocationCandidates.length === 0) {
      errorMessage = `No on-site location matched "${baseClause.sourceLocationQuery}".`;
    } else if (productCandidates.length === 0) {
      errorMessage = `No on-site product matched "${baseClause.productQuery}".`;
    } else if (selectedProductId && !requiresProductSelection && cutCandidates.length === 0) {
      errorMessage = 'No active inventory stack found for that product in the selected location.';
    } else if (chosenCut && chosenTag) {
      const alreadyTagged = (chosenCut.meatCut.tagIds || []).includes(chosenTag.id);
      if (tagAction === 'add' && alreadyTagged) {
        warningMessage = `"${chosenCut.product.name}" in ${chosenCut.locationLabel} already has the "${chosenTag.name}" tag.`;
      } else if (tagAction === 'remove' && !alreadyTagged) {
        warningMessage = `"${chosenCut.product.name}" in ${chosenCut.locationLabel} does not have the "${chosenTag.name}" tag.`;
      }
    }

    const isValid =
      !errorMessage &&
      !requiresTagSelection &&
      !requiresSourceLocationSelection &&
      !requiresProductSelection &&
      !requiresCutSelection &&
      Boolean(selectedTagId) &&
      Boolean(selectedMeatCutId);

    return {
      ...baseClause,
      quantity: 1,
      excluded,
      productCandidates,
      selectedProductId,
      requiresProductSelection,
      sourceLocationCandidates,
      selectedSourceContainerId,
      requiresSourceLocationSelection,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates,
      selectedMeatCutId,
      requiresCutSelection,
      tagAction,
      tagCandidates,
      selectedTagId,
      requiresTagSelection,
      isValid,
      errorMessage,
      warningMessage,
    };
  }

  // Handle CORRECT LABEL intent (relabel wrong-labeled MeatCut to replacement Product)
  if (baseClause.intent === 'correct_label') {
    const sourceLocationCandidates = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'any')
      : [];
    const srcPick = pickSingleOrRequireSelection(
      sourceLocationCandidates,
      l => l.containerId,
      override?.sourceContainerId
    );
    const selectedSourceContainerId = srcPick.selectedId;
    const requiresSourceLocationSelection =
      Boolean(baseClause.sourceLocationQuery) && srcPick.requiresSelection;

    const scopedIds =
      sourceLocationCandidates.length > 0
        ? new Set(
            selectedSourceContainerId
              ? [selectedSourceContainerId]
              : sourceLocationCandidates.map(l => l.containerId)
          )
        : undefined;

    const productCandidates = baseClause.productQuery.trim()
      ? resolveOnSiteProductCandidates(baseClause.productQuery, state, scopedIds)
      : [];
    const prodPick = pickSingleOrRequireSelection(
      productCandidates,
      p => p.product.id,
      override?.productId
    );
    const selectedProductId = prodPick.selectedId;
    const requiresProductSelection = prodPick.requiresSelection;

    let cutCandidates: VoiceCutCandidate[] = [];
    if (selectedProductId) {
      cutCandidates = resolveCutCandidates(
        selectedProductId,
        selectedSourceContainerId
          ? [selectedSourceContainerId]
          : sourceLocationCandidates.length > 0
          ? sourceLocationCandidates.map(l => l.containerId)
          : [],
        state
      );
    }
    let selectedMeatCutId: string | null = null;
    let requiresCutSelection = false;
    if (override?.meatCutId && cutCandidates.some(c => c.meatCut.id === override.meatCutId)) {
      selectedMeatCutId = override.meatCutId;
    } else if (cutCandidates.length === 1) {
      selectedMeatCutId = cutCandidates[0].meatCut.id;
    } else if (cutCandidates.length > 1 && !requiresSourceLocationSelection) {
      requiresCutSelection = true;
    }

    const replacementQuery = (baseClause.replacementProductQuery || '').trim();
    const allCatalogProductCandidates: VoiceProductMatch[] = (state.products || [])
      .filter(p => !p.isArchived && p.id !== selectedProductId)
      .map(product => ({
        product,
        score: 50,
        matchReason: 'fuzzy' as MatchReason,
        isExact: false,
        totalOnSiteQty: 0,
        locationStockQty: 0,
      }));
    const matchedReplacements = replacementQuery
      ? resolveOnSiteProductCandidates(replacementQuery, state).filter(p => p.product.id !== selectedProductId)
      : allCatalogProductCandidates;
    const replacementPick = pickSingleOrRequireSelection(
      matchedReplacements,
      p => p.product.id,
      override?.replacementProductId
    );
    const selectedReplacementProductId = replacementQuery
      ? replacementPick.selectedId
      : override?.replacementProductId || null;
    const requiresReplacementProductSelection =
      !selectedReplacementProductId && matchedReplacements.length > 0;

    let errorMessage: string | undefined;
    if (baseClause.sourceLocationQuery && sourceLocationCandidates.length === 0) {
      errorMessage = `No on-site location matched "${baseClause.sourceLocationQuery}".`;
    } else if (productCandidates.length === 0) {
      errorMessage = `No on-site product matched "${baseClause.productQuery}".`;
    } else if (selectedProductId && !requiresProductSelection && cutCandidates.length === 0) {
      errorMessage = 'No active inventory stack found for that product in the selected location.';
    } else if (replacementQuery && matchedReplacements.length === 0) {
      errorMessage = `No catalog product matched replacement label "${replacementQuery}".`;
    } else if (!replacementQuery && !selectedReplacementProductId) {
      errorMessage = 'Select the correct replacement product label below.';
    }

    const isValid =
      !errorMessage &&
      !requiresSourceLocationSelection &&
      !requiresProductSelection &&
      !requiresCutSelection &&
      !requiresReplacementProductSelection &&
      Boolean(selectedMeatCutId) &&
      Boolean(selectedReplacementProductId);

    return {
      ...baseClause,
      quantity: 1,
      excluded,
      productCandidates,
      selectedProductId,
      requiresProductSelection,
      sourceLocationCandidates,
      selectedSourceContainerId,
      requiresSourceLocationSelection,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates,
      selectedMeatCutId,
      requiresCutSelection,
      replacementProductQuery: replacementQuery,
      replacementProductCandidates: matchedReplacements,
      selectedReplacementProductId,
      requiresReplacementProductSelection,
      isValid,
      errorMessage,
    };
  }

  // Handle QUERY intent (single product stock, tag queries, and category queries)
  if (baseClause.intent === 'query') {
    const locCandidates = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'any')
      : [];
    const scopedContainerIds =
      locCandidates.length > 0 ? new Set(locCandidates.map(l => l.containerId)) : undefined;

    const containerMap = new Map((state.containers || []).filter(c => !c.isArchived).map(c => [c.id, c]));
    const freezerMap = new Map((state.freezers || []).map(f => [f.id, f]));
    const tagMap = new Map((state.tags || []).map(t => [t.id, t]));
    const productMap = new Map((state.products || []).filter(p => !p.isArchived).map(p => [p.id, p]));

    // 1. Tag query: "what's tagged as sell first?", "show items tagged featured"
    if (baseClause.tagQueryText) {
      const tagMatches = resolveTagCandidates(baseClause.tagQueryText, state);
      const tagQueryResults: VoiceTagQueryResult[] = tagMatches.map(({ tag }) => {
        const items: VoiceContainerCutSummary[] = [];
        let totalQuantity = 0;
        for (const mc of state.meatCuts || []) {
          if (mc.quantity <= 0 || !(mc.tagIds || []).includes(tag.id)) continue;
          const cont = containerMap.get(mc.containerId);
          if (!cont) continue;
          if (scopedContainerIds && !scopedContainerIds.has(mc.containerId)) continue;
          const prod = productMap.get(mc.productId);
          if (!prod) continue;
          const freezer = cont.freezerId ? freezerMap.get(cont.freezerId) : undefined;
          const fName = freezer ? freezer.name : 'Staging Area';
          const containerLabel =
            cont.id === 'staging_loose' || cont.id.endsWith('_loose')
              ? `${fName} (Loose)`
              : `${cont.name} (${fName})`;
          totalQuantity += mc.quantity;
          items.push({
            meatCut: mc,
            product: prod,
            quantity: mc.quantity,
            containerId: cont.id,
            containerLabel,
            tags: (mc.tagIds || []).map(id => tagMap.get(id)).filter((t): t is Tag => Boolean(t)),
          });
        }
        return { tag, totalQuantity, items };
      });

      return {
        ...baseClause,
        quantity,
        excluded,
        productCandidates: [],
        selectedProductId: null,
        requiresProductSelection: false,
        sourceLocationCandidates: locCandidates,
        selectedSourceContainerId: null,
        requiresSourceLocationSelection: false,
        destLocationCandidates: [],
        selectedDestContainerId: null,
        requiresDestLocationSelection: false,
        cutCandidates: [],
        selectedMeatCutId: null,
        requiresCutSelection: false,
        tagQueryResults,
        queryLocationFilter: baseClause.sourceLocationQuery,
        isValid: tagQueryResults.length > 0,
        errorMessage:
          tagQueryResults.length === 0 ? `No tag matched "${baseClause.tagQueryText}".` : undefined,
      };
    }

    let prodMatches = resolveOnSiteProductCandidates(baseClause.productQuery, state);
    if (
      override?.productId &&
      !prodMatches.some(p => p.product.id === override.productId)
    ) {
      const pinnedOverride = resolvePinnedProductCandidates(
        override.productId,
        state,
        scopedContainerIds
      );
      if (pinnedOverride.length > 0) {
        prodMatches = pinnedOverride;
      }
    } else if (override?.productId) {
      const picked = prodMatches.find(p => p.product.id === override.productId);
      if (picked) {
        prodMatches = [picked];
      }
    }
    const catMatches = resolveCategoryCandidates(baseClause.productQuery, state);
    const topProdScore = prodMatches[0]?.score ?? 0;
    const topCat = catMatches[0];
    const hasExactProd = prodMatches.some(p => p.isExact);

    // Check 1-to-many Voice Dictionary pack/bundle before category/single-product query fallback
    const bundleHit = resolveVoiceDictionaryBundles(baseClause.productQuery, state, {
      scopedContainerIds,
    });
    let matchedBundlePhrase: string | undefined;
    if (bundleHit && !bundleHit.isAmbiguous && (bundleHit.best.isExact || !hasExactProd)) {
      const bundleProductMatches: VoiceProductMatch[] = [];
      for (const bi of bundleHit.best.entry.bundleItems || []) {
        const pinned = resolvePinnedProductCandidates(bi.productId, state, scopedContainerIds);
        if (pinned.length > 0) {
          bundleProductMatches.push(pinned[0]);
        }
      }
      if (bundleProductMatches.length > 0) {
        prodMatches = bundleProductMatches;
        matchedBundlePhrase = bundleHit.best.entry.spokenPhrase;
      }
    }

    const preferCategory =
      !matchedBundlePhrase &&
      Boolean(topCat) &&
      !hasExactProd &&
      (topCat!.isExact || topCat!.score > topProdScore || /^\s*all\s+/i.test(baseClause.productQuery));

    if (preferCategory && topCat) {
      const matchingCats = catMatches.filter(c => c.score >= topCat.score - 5);
      const categoryQueryResults: VoiceCategoryQueryResult[] = matchingCats.map(cat => {
        const prodsInCat = (state.products || []).filter(
          p =>
            !p.isArchived &&
            (cat.type === 'primary'
              ? normalizeText(p.primaryCategory) === normalizeText(cat.name)
              : normalizeText(p.subCategory) === normalizeText(cat.name))
        );
        const items: VoiceQueryProductResult[] = [];
        let catTotal = 0;

        for (const prod of prodsInCat) {
          const locations: VoiceQueryLocationBreakdown[] = [];
          let totalQuantity = 0;
          for (const mc of state.meatCuts || []) {
            if (mc.quantity <= 0 || mc.productId !== prod.id) continue;
            const cont = containerMap.get(mc.containerId);
            if (!cont) continue;
            if (scopedContainerIds && !scopedContainerIds.has(mc.containerId)) continue;
            const freezer = cont.freezerId ? freezerMap.get(cont.freezerId) : undefined;
            totalQuantity += mc.quantity;
            locations.push({
              containerId: cont.id,
              containerName: cont.name,
              freezerId: freezer?.id,
              freezerName: freezer ? freezer.name : 'Staging Area',
              isDisplay: Boolean(freezer?.isSpecial),
              isStaging: !cont.freezerId,
              quantity: mc.quantity,
              notes: mc.notes,
              tags: (mc.tagIds || []).map(id => tagMap.get(id)).filter((t): t is Tag => Boolean(t)),
            });
          }
          if (totalQuantity > 0 || !scopedContainerIds) {
            catTotal += totalQuantity;
            items.push({
              product: prod,
              score: cat.score,
              matchReason: 'exact',
              totalQuantity,
              locations,
            });
          }
        }
        items.sort((a, b) => b.totalQuantity - a.totalQuantity || a.product.name.localeCompare(b.product.name));
        return {
          categoryName: cat.name,
          categoryType: cat.type,
          totalQuantity: catTotal,
          items,
        };
      });

      return {
        ...baseClause,
        quantity,
        excluded,
        productCandidates: [],
        selectedProductId: null,
        requiresProductSelection: false,
        sourceLocationCandidates: locCandidates,
        selectedSourceContainerId: null,
        requiresSourceLocationSelection: false,
        destLocationCandidates: [],
        selectedDestContainerId: null,
        requiresDestLocationSelection: false,
        cutCandidates: [],
        selectedMeatCutId: null,
        requiresCutSelection: false,
        categoryQueryResults,
        queryLocationFilter: baseClause.sourceLocationQuery,
        isValid: categoryQueryResults.length > 0,
      };
    }

    const queryResults: VoiceQueryProductResult[] = prodMatches.map(pm => {
      const locations: VoiceQueryLocationBreakdown[] = [];
      let totalQuantity = 0;

      for (const mc of state.meatCuts || []) {
        if (mc.quantity <= 0 || mc.productId !== pm.product.id) continue;
        const cont = containerMap.get(mc.containerId);
        if (!cont) continue;
        if (scopedContainerIds && !scopedContainerIds.has(mc.containerId)) continue;

        const freezer = cont.freezerId ? freezerMap.get(cont.freezerId) : undefined;
        totalQuantity += mc.quantity;
        locations.push({
          containerId: cont.id,
          containerName: cont.name,
          freezerId: freezer?.id,
          freezerName: freezer ? freezer.name : 'Staging Area',
          isDisplay: Boolean(freezer?.isSpecial),
          isStaging: !cont.freezerId,
          quantity: mc.quantity,
          notes: mc.notes,
          tags: (mc.tagIds || []).map(id => tagMap.get(id)).filter((t): t is Tag => Boolean(t)),
        });
      }

      return {
        product: pm.product,
        score: pm.score,
        matchReason: pm.matchReason,
        totalQuantity,
        locations,
      };
    });

    return {
      ...baseClause,
      quantity,
      excluded,
      bundlePhrase: matchedBundlePhrase,
      productCandidates: prodMatches,
      selectedProductId: prodMatches.length === 1 ? prodMatches[0].product.id : null,
      requiresProductSelection: false,
      sourceLocationCandidates: locCandidates,
      selectedSourceContainerId: null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      queryResults,
      queryLocationFilter: baseClause.sourceLocationQuery,
      suggestedFallbackProducts:
        queryResults.length === 0 && baseClause.productQuery.trim()
          ? findFallbackProductMatches(baseClause.productQuery, state, scopedContainerIds)
          : undefined,
      isValid: queryResults.length > 0,
      errorMessage:
        queryResults.length === 0
          ? `No on-site products matched "${baseClause.productQuery}".`
          : undefined,
    };
  }

  if (baseClause.intent === 'unknown') {
    const analysis = analyzeUnknownSegment(baseClause.rawText, state);
    return {
      ...baseClause,
      quantity: override?.quantity !== undefined ? Math.max(1, override.quantity) : analysis.quantity,
      excluded,
      productCandidates: [],
      selectedProductId: null,
      requiresProductSelection: false,
      sourceLocationCandidates: [],
      selectedSourceContainerId: null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      suggestedFallbackProducts: analysis.suggestedFallbackProducts,
      suggestedFallbackLocations: analysis.suggestedFallbackLocations,
      suggestedTemplateCandidates: analysis.suggestedTemplateCandidates,
      suggestedFreezerId: analysis.suggestedFreezerId,
      suggestedFallbackFreezers: analysis.suggestedFallbackFreezers,
      inferredFallbackProductQuery: analysis.inferredProductQuery,
      inferredFallbackLocationQuery: analysis.inferredLocationQuery,
      inferredFallbackFreezerQuery: analysis.inferredFreezerQuery,
      isValid: false,
      errorMessage: `Could not understand command: "${baseClause.rawText}". Pick an action below or rephrase (e.g. "add 4 broths to red bag", "remove 2 brats from display").`,
    };
  }

  // Handle STRICT NEW CONTAINER CREATION (explicit keyword OR 1-tap switch from existing Add)
  if (
    (baseClause.newContainerGroupKey && baseClause.newContainerNameQuery) ||
    (baseClause.intent === 'add' && override?.createNewContainer)
  ) {
    const switchedFromExistingAdd = Boolean(
      baseClause.intent === 'add' && override?.createNewContainer && !baseClause.newContainerGroupKey
    );
    const resolvedGroupKey = baseClause.newContainerGroupKey || `switch-${baseClause.id}`;
    const destSplit = switchedFromExistingAdd
      ? extractContainerAndFreezerFromDestQuery(baseClause.destLocationQuery, state)
      : null;
    const effectiveNameQuery = switchedFromExistingAdd
      ? (override?.customContainerName?.trim() || destSplit?.containerNameQuery || '')
      : baseClause.newContainerNameQuery || '';
    const effectiveFreezerQuery = switchedFromExistingAdd
      ? destSplit?.freezerQuery
      : baseClause.newContainerFreezerQuery;
    const effectiveDefaultIcon =
      baseClause.newContainerIcon || inferContainerIconFromName(effectiveNameQuery);
    const isEmptyContainerOnly = baseClause.intent === 'add_container';
    const hasFreezerQuery = Boolean(effectiveFreezerQuery?.trim());
    const matchedFreezers = hasFreezerQuery
      ? resolveOnSiteFreezerCandidates(effectiveFreezerQuery, state)
      : [];
    const allFreezerOptions = resolveOnSiteFreezerCandidates(undefined, state);
    const overriddenFreezerOption = override?.freezerId
      ? allFreezerOptions.find(f => f.freezerId === override.freezerId)
      : undefined;
    const freezerCandidates =
      matchedFreezers.length > 0
        ? overriddenFreezerOption &&
          !matchedFreezers.some(f => f.freezerId === overriddenFreezerOption.freezerId)
          ? [overriddenFreezerOption, ...matchedFreezers]
          : matchedFreezers
        : allFreezerOptions;

    let selectedFreezerId: string | null = null;
    let requiresFreezerSelection = false;
    let freezerError: string | undefined;

    if (overriddenFreezerOption) {
      selectedFreezerId = overriddenFreezerOption.freezerId;
      requiresFreezerSelection = false;
    } else if (!hasFreezerQuery) {
      if (switchedFromExistingAdd) {
        selectedFreezerId = null;
        requiresFreezerSelection = true;
      } else {
        selectedFreezerId = '__staging__';
        requiresFreezerSelection = false;
      }
    } else if (matchedFreezers.length === 0) {
      selectedFreezerId = null;
      requiresFreezerSelection = true;
      freezerError = `No on-site freezer matched "${effectiveFreezerQuery}".`;
    } else {
      const fPick = pickSingleOrRequireSelection(
        matchedFreezers,
        f => f.freezerId,
        override?.freezerId
      );
      selectedFreezerId = fPick.selectedId;
      requiresFreezerSelection = fPick.requiresSelection;
    }

    const templateResolution = effectiveNameQuery.trim()
      ? resolveNewContainerTemplates(
          effectiveNameQuery,
          state,
          Boolean(baseClause.explicitTemplateRequested),
          effectiveDefaultIcon || 'box'
        )
      : {
          candidates: [
            ...(state.containerTemplates || []).map(tpl => ({
              templateId: tpl.id,
              name: tpl.name,
              icon: tpl.icon || 'box',
              imageUrl: tpl.imageUrl,
              isCustom: false,
              score: 50,
              matchReason: 'fuzzy' as MatchReason,
              isExact: false,
            })),
            {
              templateId: '__custom__',
              name: 'Custom New Container',
              icon: effectiveDefaultIcon || 'box',
              isCustom: true,
              score: 40,
              matchReason: 'fuzzy' as MatchReason,
              isExact: false,
            },
          ],
          selectedTemplateId: null,
          requiresSelection: true,
        };
    let selectedTemplateId = templateResolution.selectedTemplateId;
    let requiresTemplateSelection = templateResolution.requiresSelection;
    if (
      override?.templateId &&
      templateResolution.candidates.some(t => t.templateId === override.templateId)
    ) {
      selectedTemplateId = override.templateId;
      requiresTemplateSelection = false;
    } else if (override?.customContainerName?.trim() && !override?.templateId) {
      selectedTemplateId = '__custom__';
      requiresTemplateSelection = false;
    }

    const chosenTemplateObj = templateResolution.candidates.find(
      t => t.templateId === selectedTemplateId
    );
    const existingSpare = override?.existingSpareContainerId
      ? (state.containers || []).find(
          c => c.id === override.existingSpareContainerId && !c.isArchived
        )
      : undefined;
    if (existingSpare) {
      requiresTemplateSelection = false;
    }

    const resolvedNewContainerName =
      override?.customContainerName?.trim() ||
      existingSpare?.name ||
      chosenTemplateObj?.name ||
      (effectiveNameQuery.trim() ? formatSpokenContainerName(effectiveNameQuery) : 'New Container');

    const newContainerSaveAsTemplate = existingSpare
      ? false
      : Boolean(
          override?.saveAsTemplate && (!selectedTemplateId || selectedTemplateId === '__custom__')
        );
    const newContainerImageUrl =
      override?.containerImageUrl !== undefined
        ? override.containerImageUrl || undefined
        : existingSpare?.imageUrl || chosenTemplateObj?.imageUrl;
    const newContainerIcon =
      override?.containerIcon ||
      existingSpare?.icon ||
      chosenTemplateObj?.icon ||
      baseClause.newContainerIcon ||
      inferContainerIconFromName(resolvedNewContainerName);

    let productCandidates: VoiceProductMatch[] = [];
    let selectedProductId: string | null = null;
    let requiresProductSelection = false;
    let productError: string | undefined;
    let suggestedFallbackProducts: VoiceProductMatch[] | undefined;

    if (!isEmptyContainerOnly) {
      productCandidates = baseClause.pinnedProductId
        ? resolvePinnedProductCandidates(baseClause.pinnedProductId, state)
        : baseClause.productQuery.trim()
        ? resolveOnSiteProductCandidates(baseClause.productQuery, state)
        : [];
      if (
        override?.productId &&
        !productCandidates.some(p => p.product.id === override.productId)
      ) {
        const pinnedOverride = resolvePinnedProductCandidates(override.productId, state);
        if (pinnedOverride.length > 0) {
          productCandidates = [...pinnedOverride, ...productCandidates];
        }
      }
      const prodPick = pickSingleOrRequireSelection(
        productCandidates,
        p => p.product.id,
        override?.productId
      );
      selectedProductId = prodPick.selectedId;
      requiresProductSelection = prodPick.requiresSelection;
      if (productCandidates.length === 0) {
        productError = `No on-site product matched "${baseClause.productQuery}".`;
        suggestedFallbackProducts = findFallbackProductMatches(baseClause.productQuery, state);
      }
    }

    const emptyContainerError = isEmptyContainerOnly
      ? 'Empty containers cannot be created — empty containers are removed automatically. Add at least one item (e.g. "with 4 liverwurst").'
      : undefined;

    const templateError =
      override?.templateId || existingSpare ? undefined : templateResolution.errorMessage;

    const errorMessage =
      emptyContainerError ||
      productError ||
      freezerError ||
      (requiresTemplateSelection ? undefined : templateError);

    let warningMessage: string | undefined;
    if (!errorMessage && selectedFreezerId) {
      const targetFreezerNorm = selectedFreezerId === '__staging__' ? undefined : selectedFreezerId;
      const targetNameNorm = normalizeText(resolvedNewContainerName);
      const duplicateExists = (state.containers || []).some(
        c =>
          !c.isArchived &&
          c.id !== existingSpare?.id &&
          (c.freezerId || undefined) === targetFreezerNorm &&
          normalizeText(c.name) === targetNameNorm
      );
      if (duplicateExists) {
        const fLabel =
          freezerCandidates.find(f => f.freezerId === selectedFreezerId)?.freezerName || 'Staging Area';
        warningMessage = `An active container named "${resolvedNewContainerName}" already exists in ${fLabel}. Confirming will create another one.`;
      }
    }

    const hasUnresolvedSelection =
      requiresProductSelection || requiresFreezerSelection || requiresTemplateSelection;

    const isValid =
      !isEmptyContainerOnly &&
      !errorMessage &&
      !hasUnresolvedSelection &&
      Boolean(selectedFreezerId) &&
      (Boolean(existingSpare) || Boolean(selectedTemplateId)) &&
      Boolean(selectedProductId);

    return {
      ...baseClause,
      quantity,
      excluded,
      newContainerGroupKey: resolvedGroupKey,
      newContainerNameQuery: effectiveNameQuery || resolvedNewContainerName,
      newContainerFreezerQuery: effectiveFreezerQuery,
      switchedFromExistingAdd,
      canSwitchToNewContainer: false,
      productCandidates,
      selectedProductId,
      requiresProductSelection,
      suggestedFallbackProducts,
      sourceLocationCandidates: [],
      selectedSourceContainerId: null,
      requiresSourceLocationSelection: false,
      destLocationCandidates: [],
      selectedDestContainerId: null,
      requiresDestLocationSelection: false,
      cutCandidates: [],
      selectedMeatCutId: null,
      requiresCutSelection: false,
      freezerCandidates,
      selectedFreezerId,
      requiresFreezerSelection,
      templateCandidates: templateResolution.candidates,
      selectedTemplateId,
      requiresTemplateSelection,
      resolvedNewContainerName,
      newContainerSaveAsTemplate,
      newContainerImageUrl,
      newContainerIcon,
      selectedExistingSpareContainerId: existingSpare?.id,
      isValid,
      errorMessage,
      warningMessage,
    };
  }

  // 1. Resolve Location Candidates (Source & Destination)
  let sourceLocationCandidates: VoiceLocationCandidate[] = [];
  let selectedSourceContainerId: string | null = null;
  let requiresSourceLocationSelection = false;

  if (
    baseClause.intent === 'remove' ||
    baseClause.intent === 'move' ||
    baseClause.intent === 'set_quantity'
  ) {
    if (baseClause.sourceLocationQuery) {
      sourceLocationCandidates = resolveOnSiteLocationCandidates(
        baseClause.sourceLocationQuery,
        state,
        baseClause.intent === 'set_quantity' ? 'any' : 'source'
      );
    } else {
      // No source location spoken: populate later from containers holding the matched product
      sourceLocationCandidates = [];
    }
    if (
      override?.sourceContainerId &&
      !sourceLocationCandidates.some(l => l.containerId === override.sourceContainerId)
    ) {
      const overrideLoc = getAllActiveLocationCandidates(state, true).find(
        l => l.containerId === override.sourceContainerId
      );
      if (overrideLoc) {
        sourceLocationCandidates = [{ ...overrideLoc, score: 100, isExact: true }, ...sourceLocationCandidates];
      }
    }
  }

  let destLocationCandidates: VoiceLocationCandidate[] = [];
  let selectedDestContainerId: string | null = null;
  let requiresDestLocationSelection = false;

  if (baseClause.intent === 'move' || baseClause.intent === 'add') {
    if (baseClause.destLocationQuery) {
      destLocationCandidates = resolveOnSiteLocationCandidates(
        baseClause.destLocationQuery,
        state,
        'dest'
      );
    } else {
      // No destination specified: provide all active on-site loose/container options
      destLocationCandidates = getAllActiveLocationCandidates(state, true);
    }
    if (
      override?.destContainerId &&
      !destLocationCandidates.some(l => l.containerId === override.destContainerId)
    ) {
      const overrideLoc = getAllActiveLocationCandidates(state, true).find(
        l => l.containerId === override.destContainerId
      );
      if (overrideLoc) {
        destLocationCandidates = [{ ...overrideLoc, score: 100, isExact: true }, ...destLocationCandidates];
      }
    }
    const destPick = pickSingleOrRequireSelection(
      destLocationCandidates,
      l => l.containerId,
      override?.destContainerId
    );
    selectedDestContainerId = destPick.selectedId;
    requiresDestLocationSelection = baseClause.destLocationQuery
      ? destPick.requiresSelection
      : destLocationCandidates.length > 1 && !selectedDestContainerId;
  }

  // 2. Resolve Product Candidates (scoped to source containers if remove/move/set_quantity, or dest containers for upward inventory adjustments)
  const scopedSourceIds =
    sourceLocationCandidates.length > 0
      ? new Set(sourceLocationCandidates.map(l => l.containerId))
      : undefined;
  const scopedDestIds =
    destLocationCandidates.length > 0
      ? new Set(destLocationCandidates.map(l => l.containerId))
      : undefined;
  const scopedIdsForProducts =
    baseClause.intent === 'remove' ||
    baseClause.intent === 'move' ||
    baseClause.intent === 'set_quantity'
      ? scopedSourceIds
      : baseClause.intent === 'add' && baseClause.adjustDirection === 'up'
      ? scopedDestIds
      : undefined;

  let productCandidates: VoiceProductMatch[] = [];
  let selectedProductId: string | null = null;
  let requiresProductSelection = false;

  if (baseClause.pinnedProductId) {
    productCandidates = resolvePinnedProductCandidates(
      baseClause.pinnedProductId,
      state,
      scopedIdsForProducts
    );
    selectedProductId = productCandidates[0]?.product.id || null;
    requiresProductSelection = false;
  } else {
    productCandidates = baseClause.productQuery.trim()
      ? resolveOnSiteProductCandidates(
          baseClause.productQuery,
          state,
          scopedIdsForProducts
        )
      : [];
    if (
      override?.productId &&
      !productCandidates.some(p => p.product.id === override.productId)
    ) {
      const pinnedOverride = resolvePinnedProductCandidates(
        override.productId,
        state,
        scopedIdsForProducts
      );
      if (pinnedOverride.length > 0) {
        productCandidates = [...pinnedOverride, ...productCandidates];
      }
    }

    const prodPick = pickSingleOrRequireSelection(
      productCandidates,
      p => p.product.id,
      override?.productId
    );
    selectedProductId = prodPick.selectedId;
    requiresProductSelection = prodPick.requiresSelection;
  }

  // 2b. Annotate & prioritize destination containers that already stock selectedProductId
  //     For ADD: default to adding to an existing matched container holding the same product (unless overridden or ambiguous)
  if ((baseClause.intent === 'add' || baseClause.intent === 'move') && destLocationCandidates.length > 0) {
    const prodQtyByContainer = new Map<string, number>();
    if (selectedProductId) {
      for (const mc of state.meatCuts || []) {
        if (mc.quantity > 0 && mc.productId === selectedProductId) {
          prodQtyByContainer.set(
            mc.containerId,
            (prodQtyByContainer.get(mc.containerId) || 0) + mc.quantity
          );
        }
      }
    }

    destLocationCandidates = destLocationCandidates.map(loc => {
      const qty = prodQtyByContainer.get(loc.containerId) || 0;
      return {
        ...loc,
        hasMatchingProduct: qty > 0,
        existingProductQty: qty,
      };
    });

    if (baseClause.intent === 'add' && selectedProductId) {
      const exactMatches = destLocationCandidates.filter(c => c.isExact);
      if (baseClause.destLocationQuery) {
        // When destination was spoken (e.g. "red bag") and either multiple exact matches exist or none are exact,
        // bring same-product containers to the front and auto-select if uniquely holding that product.
        if (exactMatches.length !== 1) {
          destLocationCandidates.sort((a, b) => {
            if (Boolean(a.hasMatchingProduct) !== Boolean(b.hasMatchingProduct)) {
              return a.hasMatchingProduct ? -1 : 1;
            }
            if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
            if (b.score !== a.score) return b.score - a.score;
            return (b.existingProductQty || 0) - (a.existingProductQty || 0);
          });
          if (!override?.destContainerId) {
            const pool = exactMatches.length > 0 ? exactMatches : destLocationCandidates;
            const matchingInPool = pool.filter(c => c.hasMatchingProduct);
            if (matchingInPool.length === 1) {
              selectedDestContainerId = matchingInPool[0].containerId;
              requiresDestLocationSelection = false;
            }
          }
        }
      } else {
        // No destination spoken (e.g. "add 4 broths"): surface containers with same product first,
        // and default to a unique container already stocking that product.
        destLocationCandidates.sort((a, b) => {
          if (Boolean(a.hasMatchingProduct) !== Boolean(b.hasMatchingProduct)) {
            return a.hasMatchingProduct ? -1 : 1;
          }
          if ((b.existingProductQty || 0) !== (a.existingProductQty || 0)) {
            return (b.existingProductQty || 0) - (a.existingProductQty || 0);
          }
          if (a.isLoose !== b.isLoose) return a.isLoose ? 1 : -1;
          return a.label.localeCompare(b.label);
        });
        if (!override?.destContainerId) {
          const matchingAll = destLocationCandidates.filter(c => c.hasMatchingProduct);
          if (matchingAll.length === 1) {
            selectedDestContainerId = matchingAll[0].containerId;
            requiresDestLocationSelection = false;
          } else {
            selectedDestContainerId = null;
            requiresDestLocationSelection = destLocationCandidates.length > 1;
          }
        }
      }
    }
  }

  // 3. Narrow / resolve source locations & MeatCuts for REMOVE, MOVE, and SET_QUANTITY
  let cutCandidates: VoiceCutCandidate[] = [];
  let selectedMeatCutId: string | null = null;
  let requiresCutSelection = false;

  const selectedDestLocForMove = destLocationCandidates.find(
    d => d.containerId === selectedDestContainerId
  );
  const isMovingToDisplay =
    baseClause.intent === 'move' &&
    Boolean(
      selectedDestLocForMove?.isDisplay ||
        (!selectedDestContainerId && destLocationCandidates.some(d => d.isDisplay))
    );
  const excludedRestockTagIds = getExcludedFromDisplayRestockTagIds(state.tags);
  const prioritizedTagIds = getPrioritizeItemTagIds(state.tags);
  let restockRuleNote: string | undefined;

  if (
    baseClause.intent === 'remove' ||
    baseClause.intent === 'move' ||
    baseClause.intent === 'set_quantity'
  ) {
    // Filter sourceLocationCandidates to containers that actually hold the selected product (when product is known)
    if (selectedProductId && sourceLocationCandidates.length > 0) {
      let cutsInMatchedLocs = resolveCutCandidates(
        selectedProductId,
        sourceLocationCandidates.map(l => l.containerId),
        state
      );
      if (isMovingToDisplay) {
        const eligibleInMatched = cutsInMatchedLocs.filter(
          c => !isCutExcludedFromDisplayRestock(c.meatCut, excludedRestockTagIds)
        );
        if (eligibleInMatched.length > 0) {
          cutsInMatchedLocs = eligibleInMatched;
        }
      }
      if (cutsInMatchedLocs.length > 0) {
        const containerIdsWithStock = new Set(cutsInMatchedLocs.map(c => c.container.id));
        const prioritizedContainerIds = new Set(
          cutsInMatchedLocs
            .filter(c => isCutPrioritized(c.meatCut, prioritizedTagIds))
            .map(c => c.container.id)
        );
        const filteredLocs = sourceLocationCandidates
          .filter(l => containerIdsWithStock.has(l.containerId))
          .map(l => ({
            ...l,
            hasPrioritized: prioritizedContainerIds.has(l.containerId),
          }));
        if (filteredLocs.length > 0) {
          if (baseClause.intent === 'remove' || isMovingToDisplay) {
            filteredLocs.sort((a, b) => (b.hasPrioritized ? 1 : 0) - (a.hasPrioritized ? 1 : 0));
          }
          sourceLocationCandidates = filteredLocs;
        }
      }
    } else if (selectedProductId && !baseClause.sourceLocationQuery) {
      // No source location was spoken, discover all on-site containers holding this product
      let allCutsForProd = resolveCutCandidates(selectedProductId, [], state);
      if (isMovingToDisplay) {
        const nonDestCuts = allCutsForProd.filter(
          c => c.container.id !== selectedDestContainerId && !c.freezer?.isSpecial
        );
        const pool = nonDestCuts.length > 0 ? nonDestCuts : allCutsForProd;
        const eligibleCuts = pool.filter(
          c => !isCutExcludedFromDisplayRestock(c.meatCut, excludedRestockTagIds)
        );
        allCutsForProd = (eligibleCuts.length > 0 ? eligibleCuts : pool).sort((a, b) =>
          compareBackstockForDisplayRestock(a, b, prioritizedTagIds)
        );
      } else if (baseClause.intent === 'remove') {
        allCutsForProd = [...allCutsForProd].sort((a, b) =>
          compareCutsForRemoval(a, b, prioritizedTagIds)
        );
      }
      const freezerMap = new Map((state.freezers || []).map(f => [f.id, f]));
      const seenContainers = new Set<string>();
      const prioritizedContainers = new Set(
        allCutsForProd
          .filter(c => isCutPrioritized(c.meatCut, prioritizedTagIds))
          .map(c => c.container.id)
      );
      sourceLocationCandidates = [];
      for (const cc of allCutsForProd) {
        if (seenContainers.has(cc.container.id)) continue;
        seenContainers.add(cc.container.id);
        const freezer = cc.container.freezerId ? freezerMap.get(cc.container.freezerId) : undefined;
        const freezerName = freezer ? freezer.name : 'Staging Area';
        sourceLocationCandidates.push({
          containerId: cc.container.id,
          containerName: cc.container.name,
          freezerId: freezer?.id,
          freezerName,
          isDisplay: Boolean(freezer?.isSpecial),
          isLoose: cc.container.id === 'staging_loose' || cc.container.id.endsWith('_loose'),
          isStaging: !cc.container.freezerId,
          score: 70,
          matchReason: 'tokens',
          isExact: allCutsForProd.length === 1,
          label: cc.container.id.endsWith('_loose') ? `${freezerName} (Loose)` : `${cc.container.name} (${freezerName})`,
          hasPrioritized: prioritizedContainers.has(cc.container.id),
        });
      }
    }

    // For removal without a spoken container: if exactly one container holds a sufficient prioritized cut, auto-target it first
    const autoPrioritizedSourceId =
      baseClause.intent === 'remove' &&
      !baseClause.sourceLocationQuery &&
      !override?.sourceContainerId &&
      selectedProductId
        ? (() => {
            const matchingPrioritizedCuts = resolveCutCandidates(
              selectedProductId,
              sourceLocationCandidates.map(l => l.containerId),
              state
            ).filter(
              c =>
                isCutPrioritized(c.meatCut, prioritizedTagIds) &&
                (!baseClause.isAllQuantity ? c.meatCut.quantity >= quantity : true)
            );
            const uniqueContainers = new Set(matchingPrioritizedCuts.map(c => c.container.id));
            return uniqueContainers.size === 1 ? matchingPrioritizedCuts[0].container.id : undefined;
          })()
        : undefined;

    const srcPick = pickSingleOrRequireSelection(
      sourceLocationCandidates,
      l => l.containerId,
      override?.sourceContainerId ?? autoPrioritizedSourceId
    );
    selectedSourceContainerId = srcPick.selectedId;
    requiresSourceLocationSelection = srcPick.requiresSelection;

    // Resolve concrete MeatCut stack(s)
    const targetContainerIdsForCut = selectedSourceContainerId
      ? [selectedSourceContainerId]
      : sourceLocationCandidates.map(l => l.containerId);

    if (selectedProductId) {
      cutCandidates = resolveCutCandidates(selectedProductId, targetContainerIdsForCut, state);
      if (isMovingToDisplay && cutCandidates.length > 0) {
        const eligibleInCuts = cutCandidates.filter(
          c => !isCutExcludedFromDisplayRestock(c.meatCut, excludedRestockTagIds)
        );
        if (eligibleInCuts.length > 0 && !override?.meatCutId) {
          cutCandidates = eligibleInCuts;
        }
        cutCandidates = [...cutCandidates].sort((a, b) =>
          compareBackstockForDisplayRestock(a, b, prioritizedTagIds)
        );
      } else if (baseClause.intent === 'remove' && cutCandidates.length > 0) {
        cutCandidates = [...cutCandidates].sort((a, b) =>
          compareCutsForRemoval(a, b, prioritizedTagIds)
        );
      }

      if (override?.meatCutId && cutCandidates.some(c => c.meatCut.id === override.meatCutId)) {
        selectedMeatCutId = override.meatCutId;
        requiresCutSelection = false;
      } else if (cutCandidates.length === 1) {
        selectedMeatCutId = cutCandidates[0].meatCut.id;
        requiresCutSelection = false;
      } else if (cutCandidates.length > 1 && !requiresSourceLocationSelection) {
        const prioritizedInCuts =
          baseClause.intent === 'remove' && selectedSourceContainerId
            ? cutCandidates.filter(
                c =>
                  isCutPrioritized(c.meatCut, prioritizedTagIds) &&
                  (!baseClause.isAllQuantity ? c.meatCut.quantity >= quantity : true)
              )
            : [];
        if (prioritizedInCuts.length === 1) {
          selectedMeatCutId = prioritizedInCuts[0].meatCut.id;
          requiresCutSelection = false;
        } else {
          // Multiple stacks/variants (e.g., different notes or tags) in the resolved container -> require selection!
          selectedMeatCutId = null;
          requiresCutSelection = true;
        }
      }

      if (selectedMeatCutId && (baseClause.intent === 'remove' || isMovingToDisplay)) {
        const chosenCut = cutCandidates.find(c => c.meatCut.id === selectedMeatCutId);
        if (chosenCut && isCutPrioritized(chosenCut.meatCut, prioritizedTagIds)) {
          const prioNames = getCutPrioritizedTags(chosenCut.meatCut, state.tags).map(t => t.name);
          if (prioNames.length > 0) {
            restockRuleNote =
              baseClause.intent === 'remove'
                ? `Prioritized ${prioNames.join(', ')} stock for removal`
                : `Prioritized ${prioNames.join(', ')} stock`;
          }
        }
      }
    }
  }

  // 4. Resolve effective "all" quantity from selected MeatCut if user spoke "all / the rest of"
  if (
    baseClause.isAllQuantity &&
    override?.quantity === undefined &&
    (baseClause.intent === 'remove' || baseClause.intent === 'move') &&
    selectedMeatCutId
  ) {
    const chosenCut = cutCandidates.find(c => c.meatCut.id === selectedMeatCutId);
    if (chosenCut && chosenCut.meatCut.quantity > 0) {
      quantity = chosenCut.meatCut.quantity;
    }
  }

  const isMissingTargetQtyUnset = Boolean(
    baseClause.intent === 'set_quantity' &&
      baseClause.missingTargetQuantity &&
      override?.quantity === undefined
  );

  if (
    isMissingTargetQtyUnset &&
    selectedMeatCutId
  ) {
    const chosenCut = cutCandidates.find(c => c.meatCut.id === selectedMeatCutId);
    if (chosenCut) {
      quantity = chosenCut.meatCut.quantity;
    }
  }

  // 5. Validate Readiness & Errors/Warnings
  let errorMessage: string | undefined;
  let warningMessage: string | undefined;

  if (baseClause.intent === 'set_quantity' && !baseClause.productQuery.trim()) {
    const locNote = baseClause.sourceLocationQuery ? ` in "${baseClause.sourceLocationQuery}"` : '';
    errorMessage = baseClause.sourceLocationQuery
      ? `Specify item(s) and quantity${locNote} — e.g. "change inventory${locNote}: 2 brats, 3 hotdogs" or "adjust quantity of brats${locNote} to 2".`
      : 'What would you like to change? Try "adjust quantity of brats in display to 2", "reduce inventory of hot dogs in box green to 3", or "change inventory in display: 2 brats, 3 hotdogs".';
  } else if (productCandidates.length === 0) {
    errorMessage = baseClause.pinnedProductId
      ? `Product "${baseClause.productQuery}" in voice pack "${baseClause.bundlePhrase || ''}" is archived or no longer exists.`
      : `No on-site product matched "${baseClause.productQuery}".`;
  } else if (
    (baseClause.intent === 'remove' ||
      baseClause.intent === 'move' ||
      baseClause.intent === 'set_quantity') &&
    baseClause.sourceLocationQuery &&
    sourceLocationCandidates.length === 0
  ) {
    errorMessage = `No on-site location matched "${baseClause.sourceLocationQuery}".`;
  } else if (
    (baseClause.intent === 'move' || baseClause.intent === 'add') &&
    baseClause.destLocationQuery &&
    destLocationCandidates.length === 0
  ) {
    errorMessage = `No on-site destination matched "${baseClause.destLocationQuery}".`;
  } else if (
    (baseClause.intent === 'remove' || baseClause.intent === 'move') &&
    selectedProductId &&
    cutCandidates.length === 0
  ) {
    const locLabel = selectedSourceContainerId
      ? sourceLocationCandidates.find(l => l.containerId === selectedSourceContainerId)?.label || 'selected location'
      : baseClause.sourceLocationQuery || 'on-site storage';
    errorMessage = `No stock available in ${locLabel}.`;
  } else if (baseClause.intent === 'set_quantity') {
    const locLabel = selectedSourceContainerId
      ? sourceLocationCandidates.find(l => l.containerId === selectedSourceContainerId)?.label || 'selected location'
      : baseClause.sourceLocationQuery || 'on-site storage';
    if (isMissingTargetQtyUnset) {
      errorMessage = 'Specify target quantity (e.g. "to 2") or tap +/- to adjust.';
    } else if (selectedProductId && cutCandidates.length === 0) {
      if (quantity === 0) {
        errorMessage = `Quantity in ${locLabel} is already 0.`;
      } else if (baseClause.adjustDirection === 'down' || !selectedSourceContainerId) {
        errorMessage = `No stock available in ${locLabel} (current: 0).`;
      } else {
        warningMessage = `Currently 0 in ${locLabel} — confirming will set stock to ${quantity}.`;
      }
    } else if (selectedMeatCutId) {
      const chosenCut = cutCandidates.find(c => c.meatCut.id === selectedMeatCutId);
      if (chosenCut) {
        if (quantity === chosenCut.meatCut.quantity) {
          errorMessage = `Quantity at ${chosenCut.locationLabel} is already ${chosenCut.meatCut.quantity}.`;
        } else if (baseClause.adjustDirection === 'down' && quantity > chosenCut.meatCut.quantity) {
          warningMessage = `Current stock at ${chosenCut.locationLabel} is ${chosenCut.meatCut.quantity} (already below ${quantity}). Confirming will set quantity to ${quantity}.`;
        } else if (baseClause.adjustDirection === 'up' && quantity < chosenCut.meatCut.quantity) {
          warningMessage = `Current stock at ${chosenCut.locationLabel} is ${chosenCut.meatCut.quantity} (already above ${quantity}). Confirming will set quantity to ${quantity}.`;
        }
      }
    }
  } else if ((baseClause.intent === 'remove' || baseClause.intent === 'move') && selectedMeatCutId) {
    const chosenCut = cutCandidates.find(c => c.meatCut.id === selectedMeatCutId);
    if (chosenCut && quantity > chosenCut.meatCut.quantity) {
      warningMessage = `Requested ${quantity}, but only ${chosenCut.meatCut.quantity} in stock at ${chosenCut.locationLabel}.`;
      errorMessage = `Insufficient stock (available: ${chosenCut.meatCut.quantity}). Adjust quantity to ${chosenCut.meatCut.quantity} or less.`;
    } else if (
      baseClause.intent === 'move' &&
      isMovingToDisplay &&
      chosenCut &&
      isCutExcludedFromDisplayRestock(chosenCut.meatCut, excludedRestockTagIds)
    ) {
      const excludedTags = getCutExcludedRestockTags(chosenCut.meatCut, state.tags).map(t => t.name);
      warningMessage = `"${chosenCut.product.name}" in ${chosenCut.locationLabel} is tagged ${excludedTags.join(', ')} (excluded from Display Restock).`;
    }
  }

  if (
    baseClause.intent === 'move' &&
    selectedSourceContainerId &&
    selectedDestContainerId &&
    selectedSourceContainerId === selectedDestContainerId
  ) {
    errorMessage = 'Source and destination containers cannot be the same.';
  }

  const hasUnresolvedSelection =
    requiresProductSelection ||
    requiresSourceLocationSelection ||
    requiresDestLocationSelection ||
    requiresCutSelection;

  const isValid =
    !errorMessage &&
    !hasUnresolvedSelection &&
    Boolean(selectedProductId) &&
    (baseClause.intent === 'add'
      ? Boolean(selectedDestContainerId)
      : baseClause.intent === 'set_quantity'
      ? Boolean(selectedMeatCutId) ||
        (quantity > 0 && Boolean(selectedSourceContainerId) && baseClause.adjustDirection !== 'down')
      : baseClause.intent === 'remove'
      ? Boolean(selectedMeatCutId)
      : Boolean(selectedMeatCutId) && Boolean(selectedDestContainerId));

  // Build non-dead-end suggestions when a primary match failed or needs recovery
  let suggestedTemplateCandidates: VoiceContainerTemplateCandidate[] | undefined;
  let suggestedFreezerId: string | null | undefined;
  let suggestedFallbackFreezers: VoiceFreezerCandidate[] | undefined;
  let suggestedFallbackLocations: VoiceLocationCandidate[] | undefined;
  let suggestedFallbackProducts: VoiceProductMatch[] | undefined;

  if (productCandidates.length === 0 && baseClause.productQuery.trim()) {
    suggestedFallbackProducts = findFallbackProductMatches(
      baseClause.productQuery,
      state,
      scopedIdsForProducts
    );
  }

  if (baseClause.intent === 'add' && baseClause.destLocationQuery && destLocationCandidates.length === 0) {
    const addFallbacks = buildAddFallbackSuggestions(
      baseClause.destLocationQuery,
      selectedProductId,
      state
    );
    suggestedTemplateCandidates = addFallbacks.suggestedTemplateCandidates;
    suggestedFreezerId = addFallbacks.suggestedFreezerId;
    suggestedFallbackFreezers = addFallbacks.suggestedFallbackFreezers;
    suggestedFallbackLocations = addFallbacks.suggestedFallbackLocations;
  } else if (
    (baseClause.intent === 'remove' ||
      baseClause.intent === 'move' ||
      baseClause.intent === 'set_quantity') &&
    ((baseClause.sourceLocationQuery && sourceLocationCandidates.length === 0) ||
      (selectedProductId && cutCandidates.length === 0))
  ) {
    suggestedFallbackLocations = findFallbackLocations(baseClause.sourceLocationQuery, state, {
      mode: 'source',
      productId: selectedProductId,
      limit: 8,
    });
  } else if (
    baseClause.intent === 'move' &&
    baseClause.destLocationQuery &&
    destLocationCandidates.length === 0
  ) {
    suggestedFallbackLocations = findFallbackLocations(baseClause.destLocationQuery, state, {
      mode: 'dest',
      productId: selectedProductId,
      excludeIds: selectedSourceContainerId ? new Set([selectedSourceContainerId]) : undefined,
      limit: 8,
    });
  }

  return {
    ...baseClause,
    missingTargetQuantity: isMissingTargetQtyUnset,
    quantity,
    excluded,
    canSwitchToNewContainer: baseClause.intent === 'add',
    productCandidates,
    selectedProductId,
    requiresProductSelection,
    sourceLocationCandidates,
    selectedSourceContainerId,
    requiresSourceLocationSelection,
    destLocationCandidates,
    selectedDestContainerId,
    requiresDestLocationSelection,
    cutCandidates,
    selectedMeatCutId,
    requiresCutSelection,
    restockRuleNote,
    suggestedTemplateCandidates,
    suggestedFreezerId,
    suggestedFallbackFreezers,
    suggestedFallbackLocations,
    suggestedFallbackProducts,
    isValid,
    errorMessage,
    warningMessage,
  };
}

function cleanQueryProductPhrase(raw: string): string {
  let res = raw
    .replace(/[?!.]+$/g, '')
    .replace(/\b(?:do\s+(?:we|i|you)\s+have|have\s+(?:we|i)\s+got|are\s+there|is\s+there|in\s+stock|on\s+site|on-site|located|stored|kept|available|remaining|left|right\s+now|currently|please)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let prev = '';
  while (res !== prev) {
    prev = res;
    res = res
      .replace(/^(?:me|us|the|my|our|any\s+more|any|some|all\s+(?:of\s+)?the|is|are)\s+/i, '')
      .replace(/\s+(?:is|are|have|has|located|at)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return res;
}

/**
 * Extract trailing "in / inside / at / out of <on-site location>" from an item phrase,
 * preferring splits where the right side matches an on-site location and the left side matches an on-site product
 * (so "all hotdogs in orange in canada" splits at the first "in" rather than inside "orange in canada").
 */
function extractInLocationFromBody(
  body: string,
  state: InventoryState
): { itemBody: string; locQuery: string } | null {
  const prepRegex = /\s+\b(?:in|inside|at|out\s+of)\s+/gi;
  let match: RegExpExecArray | null;
  let best: { itemBody: string; locQuery: string; rank: number } | null = null;

  while ((match = prepRegex.exec(body)) !== null) {
    const left = body.slice(0, match.index).trim();
    const right = cleanLocationFragment(body.slice(match.index + match[0].length));
    if (!left || !right) continue;

    const locs = resolveOnSiteLocationCandidates(right, state, 'source');
    if (locs.length === 0) continue;

    const qtyExtracted = extractLeadingQuantity(left, { allowToAsTwo: true, defaultQty: 1 });
    const prodText = (qtyExtracted.rest || left).trim();
    if (!prodText) continue;

    const scopedIds = new Set(locs.map(l => l.containerId));
    const prods = resolveOnSiteProductCandidates(prodText, state, scopedIds);

    const locScore = (locs[0].isExact ? 25 : 0) + locs[0].score;
    const prodScore =
      prods.length > 0
        ? 45 + (prods[0].isExact ? 20 : 0) + (prods[0].locationStockQty > 0 ? 25 : 0)
        : 0;
    const rank = locScore + prodScore;

    if (!best || rank > best.rank) {
      best = { itemBody: left, locQuery: right, rank };
    }
  }

  return best ? { itemBody: best.itemBody, locQuery: best.locQuery } : null;
}

function splitCombineContainerNames(raw: string): string[] {
  const parts: string[] = [];
  for (const commaPart of raw.split(/\s*,\s*/)) {
    const cleanedComma = commaPart.trim();
    if (!cleanedComma) continue;
    const sub = cleanedComma
      .split(/\s+(?:and|with)\s+|\s+&\s+/i)
      .map(s => s.replace(/^(?:the\s+)?containers?\s+/i, '').trim())
      .filter(Boolean);
    parts.push(...sub);
  }
  return parts;
}

const TARGET_QTY_NUMBER_WORDS: Record<string, number> = {
  ...NUMBER_WORDS,
  none: 0,
  nothing: 0,
  nil: 0,
  empty: 0,
  single: 1,
};

const TARGET_TRAILING_FILLER_TOKENS = new Set([
  'pack', 'packs', 'package', 'packages', 'pkg', 'pkgs',
  'bag', 'bags', 'box', 'boxes', 'case', 'cases',
  'piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'item', 'items',
  'left', 'remaining', 'total',
]);

function parseTargetQuantityExpression(
  text: string,
  options?: { allowHomophones?: boolean }
): { value: number; isNegative: boolean; isSigned: boolean; consumedLength: number; rest: string } | null {
  const trimmedStart = text.length - text.trimStart().length;
  const src = text.slice(trimmedStart);
  if (!src) return null;

  const signMatch = src.match(/^([+-])\s*(.+)$/);
  const isSigned = Boolean(signMatch);
  const isNegative = signMatch?.[1] === '-';
  const body = (signMatch ? signMatch[2] : src).trimStart();
  const bodyOffset = src.length - body.length;

  let value: number | null = null;
  let endInBody = 0;

  // 1. Numeric digits
  const digitMatch = body.match(/^(\d+(?:\.\d+)?)(?:\s*x\b)?(?=$|\s|[,;.)])/i);
  if (digitMatch) {
    value = Math.max(0, Math.round(parseFloat(digitMatch[1])));
    endInBody = digitMatch[0].length;
  } else {
    // 2. Spoken word quantities ("zero", "two", "twenty four", "a dozen", "half dozen", "a couple [of]")
    const tokenMatches: Array<{ raw: string; clean: string; start: number; end: number }> = [];
    const wordRe = /\S+/g;
    let wm: RegExpExecArray | null;
    while ((wm = wordRe.exec(body)) !== null && tokenMatches.length < 4) {
      tokenMatches.push({
        raw: wm[0],
        clean: wm[0].toLowerCase().replace(/[^a-z-]/g, ''),
        start: wm.index,
        end: wm.index + wm[0].length,
      });
    }

    const t0 = tokenMatches[0];
    const t1 = tokenMatches[1];
    const t2 = tokenMatches[2];

    if (t0) {
      if ((t0.clean === 'a' || t0.clean === 'one') && t1?.clean === 'dozen') {
        value = 12;
        endInBody = t1.end;
      } else if (t0.clean === 'half' && t1?.clean === 'a' && t2?.clean === 'dozen') {
        value = 6;
        endInBody = t2.end;
      } else if (t0.clean === 'half' && t1?.clean === 'dozen') {
        value = 6;
        endInBody = t1.end;
      } else if (t0.clean === 'a' && t1?.clean === 'couple') {
        value = 2;
        endInBody = t2?.clean === 'of' ? t2.end : t1.end;
      } else if (t0.clean === 'couple') {
        value = 2;
        endInBody = t1?.clean === 'of' ? t1.end : t0.end;
      } else if (t0.clean.includes('-')) {
        const [p1, p2] = t0.clean.split('-');
        if (TENS_WORDS.has(p1) && ONES_WORDS.has(p2)) {
          value = NUMBER_WORDS[p1] + NUMBER_WORDS[p2];
          endInBody = t0.end;
        }
      } else if (TENS_WORDS.has(t0.clean) && t1 && ONES_WORDS.has(t1.clean)) {
        value = NUMBER_WORDS[t0.clean] + NUMBER_WORDS[t1.clean];
        endInBody = t1.end;
      } else if (t0.clean === 'to') {
        if (options?.allowHomophones && (tokenMatches.length === 1 || t1?.clean === 'in' || t1?.clean === 'at' || t1?.clean === 'from')) {
          value = 2;
          endInBody = t0.end;
        }
      } else if (t0.clean === 'too') {
        if (options?.allowHomophones) {
          value = 2;
          endInBody = t0.end;
        }
      } else if (t0.clean === 'for') {
        if (options?.allowHomophones && (tokenMatches.length === 1 || t1?.clean === 'in' || t1?.clean === 'at' || t1?.clean === 'from')) {
          value = 4;
          endInBody = t0.end;
        }
      } else if (t0.clean === 'ate') {
        if (options?.allowHomophones) {
          value = 8;
          endInBody = t0.end;
        }
      } else if (t0.clean in TARGET_QTY_NUMBER_WORDS) {
        value = TARGET_QTY_NUMBER_WORDS[t0.clean];
        endInBody = t0.end;
      }
    }
  }

  if (value === null) return null;

  // Consume optional trailing unit/status filler tokens ("packs", "left", "remaining", "on hand", "in stock")
  let tail = body.slice(endInBody);
  let consumedTail = 0;
  let progress = true;
  while (progress) {
    progress = false;
    const fillerMatch = tail.match(/^\s+(on\s+hand|in\s+stock|[a-z]+)(?=$|\s|[,;.)])/i);
    if (fillerMatch) {
      const w = fillerMatch[1].toLowerCase().replace(/\s+/g, ' ');
      if (w === 'on hand' || w === 'in stock' || TARGET_TRAILING_FILLER_TOKENS.has(w)) {
        consumedTail += fillerMatch[0].length;
        tail = tail.slice(fillerMatch[0].length);
        progress = true;
      }
    }
  }

  const totalConsumedInSrc = bodyOffset + endInBody + consumedTail;
  const rest = src.slice(totalConsumedInSrc).replace(/^[,;.]\s*/, '').trim();

  return {
    value,
    isNegative,
    isSigned,
    consumedLength: trimmedStart + totalConsumedInSrc,
    rest,
  };
}

interface ParsedTargetClause {
  itemBody: string;
  keyword: 'to' | 'by' | '=' | 'bare_trailing' | 'leading' | 'none';
  quantity: number;
  isNegative?: boolean;
  isSigned?: boolean;
  trailingLoc?: string;
}

const TARGET_CONNECTOR_REGEX = /(?:\s+(by|(?:down\s+|up\s+)?to)\s+|\s*(=)\s*)/gi;

function extractTargetQtyAndLoc(
  rawItemText: string,
  allowBareOrLeadingQty: boolean
): ParsedTargetClause {
  const cleaned = cleanLocationFragment(rawItemText);
  if (!cleaned) {
    return { itemBody: '', keyword: 'none', quantity: 0 };
  }

  // 1. Collect all potential "by / [down|up] to / =" quantity splits and inspect from RIGHT to LEFT
  const matches: Array<{ index: number; end: number; rawKeyword: string }> = [];
  TARGET_CONNECTOR_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TARGET_CONNECTOR_REGEX.exec(cleaned)) !== null) {
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      rawKeyword: (m[1] || m[2] || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    });
  }

  for (let i = matches.length - 1; i >= 0; i--) {
    const cand = matches[i];
    const lhs = cleaned.slice(0, cand.index).trim();
    const rhs = cleaned.slice(cand.end).trim();
    if (!lhs || !rhs) continue;

    const parsedQty = parseTargetQuantityExpression(rhs, { allowHomophones: true });
    if (!parsedQty) continue;

    // Validate what remains after the quantity token: either empty OR a trailing location clause ("in display", "at box green", etc.)
    const trailLocMatch = parsedQty.rest
      ? parsedQty.rest.match(/^(?:in|inside|at|from|out\s+of)\s+(.+)$/i)
      : null;

    if (!parsedQty.rest || trailLocMatch) {
      const keyword: ParsedTargetClause['keyword'] =
        cand.rawKeyword === 'by' ? 'by' : cand.rawKeyword === '=' ? '=' : 'to';
      return {
        itemBody: lhs,
        keyword,
        quantity: parsedQty.value,
        isNegative: parsedQty.isNegative,
        isSigned: parsedQty.isSigned,
        trailingLoc: trailLocMatch ? cleanLocationFragment(trailLocMatch[1]) : undefined,
      };
    }
  }

  // 2. Bare trailing or leading quantity when user is inside a bulk/set inventory command
  if (allowBareOrLeadingQty) {
    let working = cleaned;
    let trailingLoc: string | undefined;
    const locTail = working.match(/^(.+?)\s+\b(?:in|inside|at|from|out\s+of)\s+(.+)$/i);
    if (locTail && locTail[1].trim() && locTail[2].trim()) {
      // Only peel locTail here if left still carries a leading or trailing qty
      const leftCheck = locTail[1].trim();
      if (startsWithNumberToken(leftCheck) || /\s+\d+\s*$/.test(leftCheck)) {
        working = leftCheck;
        trailingLoc = cleanLocationFragment(locTail[2]);
      }
    }

    // 2a. Leading quantity ("2 brats", "0 pork liver", "zero brats")
    const zeroLeadingMatch = working.match(/^(?:0|zero|none)\s+(.+)$/i);
    if (zeroLeadingMatch && zeroLeadingMatch[1].trim()) {
      return {
        itemBody: zeroLeadingMatch[1].trim(),
        keyword: 'leading',
        quantity: 0,
        trailingLoc,
      };
    }
    const leadingQty = extractLeadingQuantity(working, { allowToAsTwo: false, defaultQty: 1 });
    if (leadingQty.hasExplicitQuantity && leadingQty.rest) {
      return {
        itemBody: leadingQty.rest,
        keyword: 'leading',
        quantity: leadingQty.quantity,
        trailingLoc,
      };
    }

    // 2b. Trailing quantity right after item name ("brats 2", "pork liver zero"), avoiding weight measurements ("16 oz")
    const trailingTokenMatch = working.match(/^(.+?)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*$/i);
    if (
      trailingTokenMatch &&
      trailingTokenMatch[1].trim() &&
      !/\b(?:box|bag|bin|tote|freezer|tray|pack|size|no|#|number)$/i.test(trailingTokenMatch[1].trim())
    ) {
      const parsedTail = parseTargetQuantityExpression(trailingTokenMatch[2], { allowHomophones: false });
      if (parsedTail) {
        return {
          itemBody: trailingTokenMatch[1].trim(),
          keyword: 'bare_trailing',
          quantity: parsedTail.value,
          trailingLoc,
        };
      }
    }
  }

  return { itemBody: cleaned, keyword: 'none', quantity: 0 };
}

function hasTargetQtyExpression(text: string): boolean {
  TARGET_CONNECTOR_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TARGET_CONNECTOR_REGEX.exec(text)) !== null) {
    const rhs = text.slice(m.index + m[0].length).trim();
    if (rhs && parseTargetQuantityExpression(rhs, { allowHomophones: true })) {
      return true;
    }
  }
  return false;
}

/**
 * Split multi-item inventory-change bodies across commas, "and" boundaries between independent item targets,
 * and consecutive unpunctuated "<item> to <qty> <item2> to <qty>" segments.
 */
function splitInventoryChangeItems(body: string): string[] {
  const commaParts = body
    .split(/\s*,\s*/)
    .map(p => p.trim())
    .filter(Boolean);

  const result: string[] = [];

  for (const part of commaParts) {
    // 1. Split on "and" / "&" when either right side starts a quantity OR both sides contain target expressions
    const words = part.split(/\s+/).filter(Boolean);
    const andChunks: string[] = [];
    let currentWords: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const wClean = cleanSplitToken(words[i]);
      if ((wClean === 'and' || wClean === '&') && currentWords.length > 0 && i + 1 < words.length) {
        const leftStr = currentWords.join(' ').trim();
        const rightStr = words.slice(i + 1).join(' ').trim();
        const rightStartsQty =
          /^(?:0|zero|none)\b/i.test(rightStr) ||
          getQuantityTokenSpan(words, i + 1, true) > 0 ||
          startsWithNumberToken(rightStr);
        const bothHaveTargets = hasTargetQtyExpression(leftStr) && hasTargetQtyExpression(rightStr);

        if (rightStartsQty || bothHaveTargets) {
          andChunks.push(leftStr);
          currentWords = [];
          continue;
        }
      }
      currentWords.push(words[i]);
    }
    if (currentWords.length > 0) {
      andChunks.push(currentWords.join(' ').trim());
    }

    // 2. Within each chunk, split consecutive comma-less "<item> to <qty> <item2> to <qty>" OR delegate leading-qty chunks
    for (const chunk of andChunks) {
      if (!hasTargetQtyExpression(chunk)) {
        result.push(...splitItemClauses(chunk));
        continue;
      }

      let cursor = chunk.trim();
      let Safety = 0;
      while (cursor && Safety++ < 25) {
        TARGET_CONNECTOR_REGEX.lastIndex = 0;
        let splitAt: number | null = null;
        let m: RegExpExecArray | null;
        while ((m = TARGET_CONNECTOR_REGEX.exec(cursor)) !== null) {
          const rhs = cursor.slice(m.index + m[0].length);
          const qty = parseTargetQuantityExpression(rhs, { allowHomophones: true });
          if (!qty) continue;
          const rest = qty.rest;
          if (
            rest &&
            !/^(?:in|inside|at|from|out\s+of)\s+/i.test(rest) &&
            hasTargetQtyExpression(rest)
          ) {
            splitAt = cursor.length - rest.length;
            break;
          }
        }
        if (splitAt !== null && splitAt > 0 && splitAt < cursor.length) {
          const piece = cursor.slice(0, splitAt).replace(/[,;\s]+$/, '').trim();
          if (piece) result.push(piece);
          cursor = cursor.slice(splitAt).trim();
        } else {
          if (cursor) result.push(cursor);
          break;
        }
      }
    }
  }

  return result.filter(Boolean);
}

/**
 * Parse a single command segment into 1 or more evaluated clauses.
 */
function parseCommandSegment(
  segmentRaw: string,
  segIndex: number,
  state: InventoryState,
  overrides: Record<string, VoiceSelectionOverrides>
): ParsedVoiceClause[] {
  const segment = stripPoliteLeadIn(segmentRaw.trim());
  const lower = segment.toLowerCase();

  let clauseCounter = 0;
  const nextClauseId = () => `clause-${segIndex}-${clauseCounter++}`;

  const expandItemWithBundles = (
    params: {
      rawText: string;
      intent: 'remove' | 'add' | 'move' | 'set_quantity' | 'restock_display' | 'manage_list';
      quantity: number;
      isAllQuantity?: boolean;
      productQuery: string;
      sourceLocationQuery?: string;
      destLocationQuery?: string;
      adjustDirection?: 'up' | 'down' | 'neutral';
      missingTargetQuantity?: boolean;
      newContainerGroupKey?: string;
      newContainerNameQuery?: string;
      newContainerFreezerQuery?: string;
      newContainerIcon?: string;
      explicitTemplateRequested?: boolean;
      listAction?: 'add' | 'remove' | 'set_threshold' | 'enable_notify' | 'disable_notify';
      listQueryText?: string;
      listThreshold?: number;
    }
  ): ParsedVoiceClause[] => {
    const cleanQuery = params.productQuery.trim();
    const scopedLocQuery =
      params.intent === 'remove' || params.intent === 'move' || params.intent === 'set_quantity'
        ? params.sourceLocationQuery
        : undefined;
    const scopedLocCands = scopedLocQuery
      ? resolveOnSiteLocationCandidates(
          scopedLocQuery,
          state,
          params.intent === 'set_quantity' ? 'any' : 'source'
        )
      : [];
    const scopedIds =
      scopedLocCands.length > 0
        ? new Set(scopedLocCands.map(l => l.containerId))
        : undefined;

    const bundleHit = cleanQuery
      ? resolveVoiceDictionaryBundles(cleanQuery, state, { scopedContainerIds: scopedIds })
      : null;

    if (!bundleHit) {
      const id = nextClauseId();
      return [
        evaluateParsedClause(
          {
            id,
            ...params,
          },
          state,
          overrides[id]
        ),
      ];
    }

    if (bundleHit.isAmbiguous) {
      const id = nextClauseId();
      const matchedNames = bundleHit.matches.map(m => `"${m.entry.spokenPhrase}"`).join(', ');
      return [
        {
          id,
          rawText: params.rawText,
          intent: params.intent,
          quantity: params.quantity,
          isAllQuantity: params.isAllQuantity,
          productQuery: params.productQuery,
          sourceLocationQuery: params.sourceLocationQuery,
          destLocationQuery: params.destLocationQuery,
          productCandidates: [],
          selectedProductId: null,
          requiresProductSelection: false,
          sourceLocationCandidates: [],
          selectedSourceContainerId: null,
          requiresSourceLocationSelection: false,
          destLocationCandidates: [],
          selectedDestContainerId: null,
          requiresDestLocationSelection: false,
          cutCandidates: [],
          selectedMeatCutId: null,
          requiresCutSelection: false,
          isValid: false,
          excluded: Boolean(overrides[id]?.excluded),
          errorMessage: `Multiple voice pack rules matched "${cleanQuery}" (${matchedNames}). Use distinct spoken phrases in Voice Dictionary.`,
        },
      ];
    }

    const bundleEntry = bundleHit.best.entry;
    const bundleItems = bundleEntry.bundleItems || [];
    const prodMap = new Map((state.products || []).map(p => [p.id, p]));

    return bundleItems.map(bi => {
      const id = nextClauseId();
      const prod = prodMap.get(bi.productId);
      const perPackQty = Math.max(1, Math.round(Number(bi.quantity) || 1));
      let expandedQty = params.quantity;
      if (params.intent !== 'manage_list') {
        if (params.isAllQuantity || params.missingTargetQuantity) {
          expandedQty = 1;
        } else if (params.intent === 'set_quantity' && params.quantity === 0) {
          expandedQty = 0;
        } else {
          expandedQty = Math.max(1, params.quantity) * perPackQty;
        }
      }

      return evaluateParsedClause(
        {
          id,
          ...params,
          quantity: expandedQty,
          productQuery: prod?.name || bi.productId,
          pinnedProductId: bi.productId,
          bundlePhrase: bundleEntry.spokenPhrase,
        },
        state,
        overrides[id]
      );
    });
  };

  // 0. Check QUICK UNDO intent:
  //    "undo", "undo that", "undo last command", "take that back", "roll back last change"
  if (
    /^(?:undo(?:\s+(?:that|it|everything|this|(?:(?:the|my|our)\s+)?(?:last|previous|most\s+recent)(?:\s+(?:voice\s+)?(?:command|action|change|edit|move|removal|addition))?|last|previous))?|roll\s*back(?:\s+(?:that|it|(?:(?:the|my|our)\s+)?(?:last|previous|most\s+recent)(?:\s+(?:voice\s+)?(?:command|action|change|edit|move|removal|addition))?))?|revert(?:\s+(?:that|it|(?:(?:the|my|our)\s+)?(?:last|previous|most\s+recent)(?:\s+(?:voice\s+)?(?:command|action|change|edit|move|removal|addition))?))?|take\s+that\s+back|cancel\s+(?:the\s+|my\s+)?last\s+(?:command|action|change|edit|move|removal|addition)|go\s+back(?:\s+one\s+step)?)\s*[?!.]*$/i.test(
      segment
    )
  ) {
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'undo_last',
          quantity: 1,
          productQuery: '',
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 0-list-a. Check CUSTOM LIST QUERIES:
  //           "check a list", "check my lists", "what's on my restock list?", "show need to pack list", "is ribeye on the restock list?", "list custom lists"
  if (
    /^(?:(?:list|show(?:\s+(?:me|us))?|check|view|open|read)\s+(?:(?:a|the|my|our|all|any)\s+)?(?:custom\s+)?lists?(?:\s+(?:for\s+(?:low\s+stock|restock(?:ing)?|alerts?)|to\s+see\s+what\s+(?:is\s+low|needs?\s+restock(?:ing)?)))?|(?:what|which)\s+(?:custom\s+)?lists?\s+(?:do\s+(?:we|i|you)\s+have|are\s+there|exist))(?:\s+right\s+now)?\s*[?!.]*$/i.test(
      segment
    )
  ) {
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'list_query',
          quantity: 1,
          productQuery: '',
          listQueryText: '',
        },
        state,
        overrides[id]
      ),
    ];
  }

  const isProductOnListMatch =
    segment.match(/^is\s+(.+?)\s+(?:currently\s+)?(?:listed\s+)?on\s+(?:(?:the|my|our|a)\s+)?(.+?)\s*[?!.]*$/i) ||
    segment.match(/^(?:check|see)\s+if\s+(.+?)\s+is\s+(?:listed\s+)?on\s+(?:(?:the|my|our|a)\s+)?(.+?)\s*[?!.]*$/i) ||
    segment.match(/^(?:do\s+(?:we|i)\s+have|is\s+there)\s+(.+?)\s+on\s+(?:(?:the|my|our|a)\s+)?(.+?)\s*[?!.]*$/i);
  const doesListHaveProdMatch = !isProductOnListMatch
    ? segment.match(/^does\s+(?:(?:the|my|our)\s+)?(.+?)\s+(?:have|include|contain)\s+(.+?)\s*[?!.]*$/i)
    : null;
  if (isProductOnListMatch || doesListHaveProdMatch) {
    const candProd = (isProductOnListMatch ? isProductOnListMatch[1] : doesListHaveProdMatch![2]).trim();
    const candList = cleanLocationFragment(isProductOnListMatch ? isProductOnListMatch[2] : doesListHaveProdMatch![1]);
    if (
      /\blist\b/i.test(candList) ||
      (resolveCustomListCandidates(candList, state).length > 0 &&
        resolveOnSiteLocationCandidates(candList, state, 'any').length === 0)
    ) {
      const id = `clause-${segIndex}-0`;
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: 'list_query',
            quantity: 1,
            productQuery: candProd,
            listQueryText: candList,
          },
          state,
          overrides[id]
        ),
      ];
    }
  }

  const whatsOnListMatch = segment.match(
    /^(?:what(?:'s|s|\s+is|\s+are)?\s+(?:currently\s+|low\s+)?(?:on|in)|show(?:\s+(?:me|us))?(?:\s+(?:what(?:'s|s)\s+low\s+)?on)?|list(?:\s+(?:all\s+)?items\s+(?:on|in))?|read|check(?:\s+(?:what(?:'s|s)\s+low\s+)?on)?|open|view)\s+(?:(?:the|my|our|a)\s+)?(.+?)(?:\s+for\s+(?:low\s+stock|restock(?:ing)?|alerts?))?\s*[?!.]*$/i
  );
  if (whatsOnListMatch) {
    const rawListCand = cleanLocationFragment(whatsOnListMatch[1]);
    const isGenericListWord = /^(?:(?:a|the|my|our|all|custom)\s+)*lists?$/i.test(rawListCand);
    const candList = isGenericListWord ? '' : rawListCand;
    if (
      isGenericListWord ||
      /\blists?\b$/i.test(rawListCand) ||
      (resolveCustomListCandidates(rawListCand, state).length > 0 &&
        resolveOnSiteLocationCandidates(rawListCand, state, 'any').length === 0)
    ) {
      const id = `clause-${segIndex}-0`;
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: 'list_query',
            quantity: 1,
            productQuery: '',
            listQueryText: candList,
          },
          state,
          overrides[id]
        ),
      ];
    }
  }

  // 0-list-b. Check CUSTOM LIST THRESHOLD / ALERT MUTATIONS:
  const setThresholdMatch = segment.match(
    /^(?:set|change|update|adjust|make)\s+(?:the\s+)?(?:(.+?)\s+)?(?:(?:list|low[- ]stock|min(?:imum)?)\s+)?(?:threshold|min(?:imum)?)\s+(?:for|on|of)\s+(.+?)\s+(?:to|at)\s+(.+)$/i
  );
  if (setThresholdMatch) {
    const rawListName = setThresholdMatch[1]?.trim() || '';
    const prodRaw = setThresholdMatch[2].trim();
    const parsedQty = parseTargetQuantityExpression(setThresholdMatch[3].trim(), { allowHomophones: true });
    if (parsedQty) {
      const id = `clause-${segIndex}-0`;
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: 'manage_list',
            listAction: 'set_threshold',
            quantity: parsedQty.value,
            listThreshold: parsedQty.value,
            productQuery: prodRaw,
            listQueryText: rawListName,
          },
          state,
          overrides[id]
        ),
      ];
    }
  }

  const alertWhenMatch = segment.match(
    /^(?:alert|notify|warn)\s+(?:me|us)\s+when\s+(.+?)\s+(?:drops?|falls?|goes?|gets?)\s+(?:below|under)\s+(.+?)(?:\s+(?:on|in)\s+(?:the\s+|my\s+|our\s+)?(.+?))?\s*[?!.]*$/i
  );
  if (alertWhenMatch) {
    const prodRaw = alertWhenMatch[1].trim();
    const parsedQty = parseTargetQuantityExpression(alertWhenMatch[2].trim(), { allowHomophones: true });
    const listRaw = alertWhenMatch[3] ? cleanLocationFragment(alertWhenMatch[3]) : '';
    if (parsedQty) {
      const id = `clause-${segIndex}-0`;
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: 'manage_list',
            listAction: 'set_threshold',
            quantity: parsedQty.value,
            listThreshold: parsedQty.value,
            productQuery: prodRaw,
            listQueryText: listRaw,
          },
          state,
          overrides[id]
        ),
      ];
    }
  }

  const toggleAlertMatch = segment.match(
    /^(stop|disable|mute|silence|pause|turn\s+off|enable|unmute|resume|turn\s+on)\s+(?:low[- ]stock\s+)?(?:alert(?:s|ing)?|notification(?:s)?)\s+(?:for|on)\s+(.+?)(?:\s+(?:on|in)\s+(?:the\s+|my\s+|our\s+)?(.+?))?\s*[?!.]*$/i
  );
  if (toggleAlertMatch) {
    const isDisable = /^(?:stop|disable|mute|silence|pause|turn\s+off)/i.test(toggleAlertMatch[1]);
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'manage_list',
          listAction: isDisable ? 'disable_notify' : 'enable_notify',
          quantity: 1,
          productQuery: toggleAlertMatch[2].trim(),
          listQueryText: toggleAlertMatch[3] ? cleanLocationFragment(toggleAlertMatch[3]) : '',
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 0-list-c. Check CUSTOM LIST ADD / REMOVE ITEMS:
  //           "add brats and hot dogs to the restock list", "remove pork chops from need to pack"
  const listAddMatch = segment.match(
    /^(?:add|put|include|append)\s+(.+?)\s+\b(?:on|onto|to|into)\s+(?:the\s+|my\s+|our\s+)?(.+?)(?:\s+(?:with|at)\s+(?:a\s+)?(?:threshold|min(?:imum)?)\s+(?:of\s+)?(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten))?\s*[?!.]*$/i
  );
  if (listAddMatch) {
    const itemsRaw = listAddMatch[1].trim();
    const listCandRaw = cleanLocationFragment(listAddMatch[2]);
    const threshParsed = listAddMatch[3]
      ? parseTargetQuantityExpression(listAddMatch[3], { allowHomophones: true })
      : null;
    const isExplicitList =
      /\blist\b$/i.test(listCandRaw) ||
      (resolveCustomListCandidates(listCandRaw, state).length > 0 &&
        resolveOnSiteLocationCandidates(listCandRaw, state, 'dest').length === 0);
    if (isExplicitList) {
      const productsList = splitPlainProductList(itemsRaw);
      const outClauses: ParsedVoiceClause[] = [];
      for (const prodRaw of productsList) {
        const strippedLeadingQty = extractLeadingQuantity(prodRaw, { allowToAsTwo: false, defaultQty: 1 });
        const cleanProd = strippedLeadingQty.hasExplicitQuantity
          ? strippedLeadingQty.rest || prodRaw
          : prodRaw;
        outClauses.push(
          ...expandItemWithBundles({
            rawText: prodRaw,
            intent: 'manage_list',
            listAction: 'add',
            quantity: threshParsed ? threshParsed.value : 1,
            listThreshold: threshParsed ? threshParsed.value : undefined,
            productQuery: cleanProd,
            listQueryText: listCandRaw,
          })
        );
      }
      return outClauses;
    }
  }

  const listRemoveMatch = segment.match(
    /^(?:remove|take|delete|clear|drop)\s+(.+?)\s+\b(?:from|off(?:\s+of)?)\s+(?:the\s+|my\s+|our\s+)?(.+?)\s*[?!.]*$/i
  );
  if (listRemoveMatch) {
    const itemsRaw = listRemoveMatch[1].trim();
    const listCandRaw = cleanLocationFragment(listRemoveMatch[2]);
    const isExplicitList =
      /\blist\b$/i.test(listCandRaw) ||
      (resolveCustomListCandidates(listCandRaw, state).length > 0 &&
        resolveOnSiteLocationCandidates(listCandRaw, state, 'source').length === 0);
    if (isExplicitList) {
      const productsList = splitPlainProductList(itemsRaw);
      const outClauses: ParsedVoiceClause[] = [];
      for (const prodRaw of productsList) {
        outClauses.push(
          ...expandItemWithBundles({
            rawText: prodRaw,
            intent: 'manage_list',
            listAction: 'remove',
            quantity: 1,
            productQuery: prodRaw,
            listQueryText: listCandRaw,
          })
        );
      }
      return outClauses;
    }
  }

  // 0-tag. Check TAG QUERIES & ITEM TAG MUTATIONS:
  const tagQueryMatch = segment.match(
    /^(?:(?:what(?:'s|s|\s+is|\s+are)?|which\s+items?|show(?:\s+(?:me|us))?(?:\s+(?:all|the|everything))?(?:\s+items?)?|list(?:\s+(?:all|the))?(?:\s+items?)?|how\s+many(?:\s+items?)?(?:\s+are)?|find(?:\s+(?:all|the))?(?:\s+items?)?)\s+tagged(?:\s+(?:as|with))?\s+|(?:show(?:\s+(?:me|us))?|list|find|what(?:'s|s|\s+is|\s+are)?|which\s+items?)\s+(?:all\s+)?(?:items?\s+)?(?:with|have|has)\s+(?:the\s+)?tag\s+)(.+)$/i
  );
  if (tagQueryMatch) {
    let tagPart = cleanLocationFragment(tagQueryMatch[1]);
    let locPart: string | undefined;
    const locTail = tagPart.match(/^(.+?)\s+\b(?:in|inside|at)\s+(.+)$/i);
    if (locTail && resolveOnSiteLocationCandidates(locTail[2], state, 'any').length > 0) {
      tagPart = locTail[1].trim();
      locPart = cleanLocationFragment(locTail[2]);
    }
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'query',
          quantity: 1,
          productQuery: tagPart,
          tagQueryText: tagPart,
          sourceLocationQuery: locPart,
        },
        state,
        overrides[id]
      ),
    ];
  }

  const tagApplyVerbMatch = segment.match(
    /^tag\s+(.+?)\s+(?:as|with)\s+(?:the\s+)?(.+?)(?:\s+tag)?\s*[?!.]*$/i
  );
  const tagAddExplicitMatch = !tagApplyVerbMatch
    ? segment.match(/^(?:add|put|apply|label)\s+(?:the\s+)?(.+?)\s+tag\s+(?:on|to|onto)\s+(.+?)\s*[?!.]*$/i)
    : null;
  const tagRemoveExplicitMatch = !tagApplyVerbMatch && !tagAddExplicitMatch
    ? segment.match(/^(?:remove|take\s+off|clear|strip|drop)\s+(?:the\s+)?(.+?)\s+tag\s+(?:from|off(?:\s+of)?|on)\s+(.+?)\s*[?!.]*$/i)
    : null;
  const untagMatch = !tagApplyVerbMatch && !tagAddExplicitMatch && !tagRemoveExplicitMatch
    ? segment.match(/^untag\s+(.+?)\s+(?:from|with|as)\s+(?:the\s+)?(.+?)(?:\s+tag)?\s*[?!.]*$/i)
    : null;

  if (tagApplyVerbMatch || tagAddExplicitMatch || tagRemoveExplicitMatch || untagMatch) {
    const isRemoveTag = Boolean(tagRemoveExplicitMatch || untagMatch);
    let itemAndLoc = tagApplyVerbMatch
      ? tagApplyVerbMatch[1].trim()
      : untagMatch
      ? untagMatch[1].trim()
      : (tagAddExplicitMatch || tagRemoveExplicitMatch)![2].trim();
    const tagRaw = tagApplyVerbMatch
      ? tagApplyVerbMatch[2].trim()
      : untagMatch
      ? untagMatch[2].trim()
      : (tagAddExplicitMatch || tagRemoveExplicitMatch)![1].trim();

    let locQuery: string | undefined;
    const inLoc = extractInLocationFromBody(itemAndLoc, state);
    if (inLoc) {
      itemAndLoc = inLoc.itemBody;
      locQuery = inLoc.locQuery;
    }
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'manage_tag',
          tagAction: isRemoveTag ? 'remove' : 'add',
          tagQueryText: tagRaw,
          quantity: 1,
          productQuery: itemAndLoc,
          sourceLocationQuery: locQuery,
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 0-label. Check WRONG-LABEL / RELABEL intent:
  //          "correct label on chuck roast in box 2 to arm roast", "relabel pork roast in box 2 as shoulder roast", "mark chuck roast in box 2 as wrong label"
  const correctLabelMatch = segment.match(
    /^(?:(?:correct|fix|change|update|replace)\s+(?:the\s+)?(?:wrong\s+|incorrect\s+)?label\s+(?:on|for|of)|relabel|re-label)\s+(.+?)(?:\s+(?:to|as|with)\s+(.+))?\s*[?!.]*$/i
  );
  const markWrongLabelMatch = !correctLabelMatch
    ? segment.match(/^(?:mark|flag|report)\s+(.+?)\s+as\s+(?:a\s+)?(?:wrong\s+label|wrongly\s+labeled|mislabeled|mislabelled|incorrect\s+label)\s*[?!.]*$/i) ||
      segment.match(/^(.+?)\s+is\s+(?:mislabeled|mislabelled|labeled\s+wrong|wrongly\s+labeled|a\s+wrong\s+label)\s*[?!.]*$/i)
    : null;
  if (correctLabelMatch || markWrongLabelMatch) {
    let itemAndLoc = (correctLabelMatch ? correctLabelMatch[1] : markWrongLabelMatch![1]).trim();
    const replacementQuery = correctLabelMatch?.[2] ? correctLabelMatch[2].trim() : '';
    let locQuery: string | undefined;
    const inLoc = extractInLocationFromBody(itemAndLoc, state);
    if (inLoc) {
      itemAndLoc = inLoc.itemBody;
      locQuery = inLoc.locQuery;
    }
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'correct_label',
          quantity: 1,
          productQuery: itemAndLoc,
          sourceLocationQuery: locQuery,
          replacementProductQuery: replacementQuery,
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 0-lifecycle. Check SWAP / RENAME / ARCHIVE / DELETE / UNPLACE CONTAINER intents:
  const swapMatch = segment.match(
    new RegExp(
      `^(?:swap|trade|switch|exchange)(?:\\s+(?:the\\s+)?${PLURAL_CONTAINER_GROUP_PREFIX_PATTERN})?\\s+(.+?)\\s+\\b(?:and|with|&|for)\\s+(.+?)\\s*[?!.]*$`,
      'i'
    )
  );
  if (swapMatch) {
    const slotA = cleanLocationFragment(swapMatch[1].replace(/^(?:the\s+)?containers?\s+/i, ''));
    const slotB = cleanLocationFragment(swapMatch[2].replace(/^(?:the\s+)?containers?\s+/i, ''));
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'swap_containers',
          quantity: 1,
          productQuery: '',
          combineSlots: [
            { slotIndex: 0, query: slotA, candidates: [], selectedContainerId: null, requiresSelection: false },
            { slotIndex: 1, query: slotB, candidates: [], selectedContainerId: null, requiresSelection: false },
          ],
        },
        state,
        overrides[id]
      ),
    ];
  }

  const renameMatch =
    segment.match(/^(?:rename|re-name|change\s+(?:the\s+)?name\s+of|retitle)(?:\s+(?:the\s+)?container)?\s+(.+?)\s+\b(?:to|as|into)\s+(.+?)\s*[?!.]*$/i) ||
    segment.match(
      new RegExp(
        `^change\\s+(?:the\\s+)?(?:container\\s+|(?=${SPECIFIC_CONTAINER_NOUN_PATTERN}\\b\\s))(.+?)\\s+name\\s+(?:to|into|as)\\s+(.+?)\\s*[?!.]*$`,
        'i'
      )
    );
  if (renameMatch) {
    const srcCont = cleanLocationFragment(renameMatch[1] || '');
    const newName = cleanLocationFragment((renameMatch[2] || '').replace(/^(?:the\s+)?container\s+/i, ''));
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'rename_container',
          quantity: 1,
          productQuery: '',
          sourceLocationQuery: srcCont,
          newContainerNameInput: newName,
        },
        state,
        overrides[id]
      ),
    ];
  }

  const archiveMatch = segment.match(
    /^(archive|unarchive|restore)\s+(?:(?:the\s+)?container\s+)?(.+?)(?:\s+from\s+archive)?\s*[?!.]*$/i
  );
  if (archiveMatch) {
    const isUnarchive = /^(?:unarchive|restore)$/i.test(archiveMatch[1]);
    const targetCont = cleanLocationFragment(archiveMatch[2].replace(/^(?:the\s+)?container\s+/i, ''));
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'archive_container',
          archiveState: !isUnarchive,
          quantity: 1,
          productQuery: '',
          sourceLocationQuery: targetCont,
        },
        state,
        overrides[id]
      ),
    ];
  }

  const deleteContainerMatch = segment.match(
    new RegExp(
      `^(?:(?:delete|retire)\\s+(?:the\\s+)?(?:empty\\s+)?(?:container\\s+)?|(?:remove|discard)\\s+(?:the\\s+)?(?:empty\\s+(?=${ALL_CONTAINER_NOUN_PATTERN}\\b)|container\\s+))(.+?)\\s*[?!.]*$`,
      'i'
    )
  );
  if (deleteContainerMatch) {
    const targetCont = cleanLocationFragment(deleteContainerMatch[1].replace(/^(?:the\s+)?container\s+/i, ''));
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'delete_container',
          quantity: 1,
          productQuery: '',
          sourceLocationQuery: targetCont,
        },
        state,
        overrides[id]
      ),
    ];
  }

  const unplaceStageMatch = segment.match(
    /^(?:unplace|un-place|stage|(?:move|put|send)\s+to\s+(?:the\s+)?staging(?:\s+area)?)\s+(?:(?:the\s+)?container\s+)?(.+?)\s*[?!.]*$/i
  );
  if (unplaceStageMatch) {
    const targetCont = cleanLocationFragment(unplaceStageMatch[1]);
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'move_container',
          quantity: 1,
          productQuery: '',
          sourceLocationQuery: targetCont,
          destLocationQuery: 'staging',
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 0-alerts. Check EMPTY CONTAINERS, STAGING CONTAINERS, and OUT-OF-STOCK / LOW-STOCK / NEEDS-RESTOCK QUERIES:
  const emptyContainersQueryMatch = segment.match(
    new RegExp(
      `^(?:(?:what|which|show(?:\\s+(?:me|us))?|list(?:\\s+all)?|count|how\\s+many)\\s+(?:are\\s+(?:the\\s+)?)?empty\\s+${ALL_CONTAINER_NOUN_PLURAL_PATTERN}(?:\\s+(?:are\\s+)?(?:in|inside|at)\\s+(.+?))?|(?:what|which|any)\\s+${ALL_CONTAINER_NOUN_PLURAL_PATTERN}\\s+(?:are|is)\\s+empty(?:\\s+(?:in|inside|at)\\s+(.+?))?|any\\s+empty\\s+${ALL_CONTAINER_NOUN_PLURAL_PATTERN}(?:\\s+(?:in|inside|at)\\s+(.+?))?)\\s*[?!.]*$`,
      'i'
    )
  );
  if (emptyContainersQueryMatch) {
    const freezerFilter = cleanLocationFragment(
      emptyContainersQueryMatch[1] || emptyContainersQueryMatch[2] || emptyContainersQueryMatch[3] || ''
    );
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'container_query',
          containerQueryMode: 'empty',
          quantity: 1,
          productQuery: '__empty_containers__',
          sourceLocationQuery: '',
          queryLocationFilter: freezerFilter || undefined,
        },
        state,
        overrides[id]
      ),
    ];
  }

  if (
    new RegExp(
      `^(?:what(?:'s|s|\\s+is|\\s+are)?|show(?:\\s+(?:me|us))?|list(?:\\s+all)?|check|which\\s+${ALL_CONTAINER_NOUN_PLURAL_PATTERN}\\s+are)\\s+(?:(?:currently\\s+)?(?:in|on)\\s+(?:the\\s+)?(?:staging(?:\\s+area)?|sorting\\s+table)|unplaced\\s+${ALL_CONTAINER_NOUN_PLURAL_PATTERN})(?:\\s+are\\s+there)?\\s*[?!.]*$`,
      'i'
    ).test(segment)
  ) {
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'container_query',
          containerQueryMode: 'staging',
          quantity: 1,
          productQuery: '__staging_containers__',
          sourceLocationQuery: 'staging',
          queryLocationFilter: 'Staging Area',
        },
        state,
        overrides[id]
      ),
    ];
  }

  const underLimitMatch = segment.match(
    /^(?:what(?:\s+items?)?(?:'s|s|\s+is|\s+are)?|show(?:\s+(?:me|us))?(?:\s+items?)?|list(?:\s+items?)?|check|which\s+items?(?:\s+are)?)\s+(?:in\s+(.+?)\s+)?(?:(?:at\s+or\s+)?(?:under|below)|less\s+than|fewer\s+than|at\s+most)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+(?:packs?|pieces?|items?|left|remaining))?(?:\s+(?:in|inside|at)\s+(.+?))?\s*[?!.]*$/i
  );
  if (underLimitMatch) {
    const thresholdParsed = parseTargetQuantityExpression(underLimitMatch[2], { allowHomophones: true });
    const locRaw = cleanLocationFragment(underLimitMatch[1] || underLimitMatch[3] || '');
    const isGlobal = !locRaw || /\b(?:all\s+freezers?|everywhere|on[- ]site)\b/i.test(locRaw);
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'inventory_alert_query',
          alertQueryMode: isGlobal ? 'global_low_stock' : 'display_low_stock',
          alertThreshold: thresholdParsed?.value ?? 3,
          quantity: 1,
          productQuery: '',
          sourceLocationQuery: isGlobal ? undefined : locRaw,
        },
        state,
        overrides[id]
      ),
    ];
  }

  const restockAlertMatch = segment.match(
    /^(?:(?:what(?:'s|s|\s+is|\s+are)?(?:\s+items?)?\s+(?:need(?:ing|\s+to\s+be)?\s+(?:to\s+)?restock(?:ed|ing)?|should\s+(?:we|i)\s+restock|missing)|what\s+(?:do|should|can)\s+(?:we|i)\s+(?:need\s+to\s+)?restock|which\s+items?\s+(?:need\s+(?:to\s+be\s+)?restock(?:ed|ing)?|should\s+(?:we|i)\s+restock)|(?:check|show(?:\s+(?:me|us))?|list|find)\s+(?:what\s+(?:needs?\s+(?:to\s+be\s+)?restock(?:ed|ing)?|(?:we|i)\s+need\s+to\s+restock)|items?\s+(?:to|that\s+need)\s+restock(?:ing)?|restock\s+needs?)|(?:does\s+)?anything\s+needs?\s+(?:to\s+be\s+)?restock(?:ed|ing)?)(?:\s+(?:in|inside|for|on|at)\s+(.+?))?(?:\s+(?:from|with)\s+backstock)?|needs?\s+restock(?:ing)?(?:\s+(?:in|inside|for|at)\s+(.+?))?)\s*[?!.]*$/i
  );
  if (restockAlertMatch) {
    const rawLoc = cleanLocationFragment(restockAlertMatch[1] || restockAlertMatch[2] || '')
      .replace(/\s+(?:that\s+(?:we|i)\s+have\s+in\s+backstock|with\s+backstock|from\s+backstock|across\s+all\s+freezers?).*$/i, '')
      .trim();
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'inventory_alert_query',
          alertQueryMode: 'needs_restock',
          alertThreshold: 0,
          quantity: 1,
          productQuery: '',
          sourceLocationQuery: rawLoc || 'display',
        },
        state,
        overrides[id]
      ),
    ];
  }

  const alertQueryMatch = segment.match(
    /^(?:what(?:'s|s|\s+is|\s+are)?(?:\s+(?:currently|running|getting))?|show(?:\s+(?:me|us))?|list(?:\s+all)?|check|find|which\s+items?(?:\s+are)?|anything(?:\s+that'?s|\s+is)?|is\s+anything)\s+(?:(?:we|are\s+we|am\s+i|items?)\s+)?(?:(?:completely\s+|totally\s+|all\s+)?(?:out\s+of\s+stock|oos|sold\s+out|out\s+of)|running\s+low(?:\s+(?:on|in)\s+stock)?|getting\s+low(?:\s+(?:on|in)\s+stock)?|low\s+(?:on\s+|in\s+)?stock|low\s+items?|low(?=\s+(?:in|inside|at|everywhere|across)|\s*[?!.]*$)|short\s+on(?:\s+stock)?|missing|needs?\s+(?:to\s+be\s+)?restock(?:ed|ing)?)(?:\s+(?:in|inside|at)\s+(.+?))?(?:\s+(?:that\s+(?:we|i)\s+have\s+in\s+backstock|with\s+backstock|from\s+backstock|across\s+all\s+freezers?))?\s*[?!.]*$/i
  );
  const outOfWhatMatch = !alertQueryMatch
    ? segment.match(
        /^(?:what|which\s+items?)\s+(?:are\s+we|am\s+i|is)\s+(?:completely\s+|totally\s+|all\s+)?(?:out\s+of|running\s+low\s+on|getting\s+low\s+on|low\s+on|short\s+on)(?:\s+(?:in|inside|at)\s+(.+?))?\s*[?!.]*$/i
      )
    : null;
  const bareLowOrOosMatch = !alertQueryMatch && !outOfWhatMatch
    ? segment.match(/^(?:low\s+stock|low\s+items?|out\s+of\s+stock|oos)(?:\s+(?:in|inside|at)\s+(.+?))?\s*[?!.]*$/i)
    : null;
  if (alertQueryMatch || outOfWhatMatch || bareLowOrOosMatch) {
    let rawLoc = cleanLocationFragment(
      (alertQueryMatch ? alertQueryMatch[1] : outOfWhatMatch ? outOfWhatMatch[1] : bareLowOrOosMatch?.[1]) || ''
    );
    const hasBackstockFilter = /\bbackstock\b/i.test(segment);
    if (rawLoc) {
      rawLoc = rawLoc
        .replace(/\s+(?:that\s+(?:we|i)\s+have\s+in\s+backstock|with\s+backstock|from\s+backstock|across\s+all\s+freezers?).*$/i, '')
        .trim();
    }
    const isGlobal =
      Boolean(outOfWhatMatch && !rawLoc) ||
      Boolean(/\b(?:all\s+freezers?|everywhere|completely|totally)\b/i.test(segment) && !rawLoc);
    const isLow =
      /\b(?:running\s+low|getting\s+low|low\s+(?:on\s+|in\s+)?stock|low\s+items?|short\s+on)\b/i.test(segment) ||
      /\blow\b(?=\s+(?:on|in|inside|at|everywhere|across)|\s*[?!.]*$)/i.test(segment);
    const isNeedsRestock = /\brestock/i.test(segment) || hasBackstockFilter;
    const mode: ParsedVoiceClause['alertQueryMode'] = isNeedsRestock
      ? 'needs_restock'
      : isGlobal
      ? isLow
        ? 'global_low_stock'
        : 'global_out_of_stock'
      : isLow
      ? 'display_low_stock'
      : 'display_out_of_stock';

    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'inventory_alert_query',
          alertQueryMode: mode,
          alertThreshold: isLow ? 3 : 0,
          quantity: 1,
          productQuery: '',
          sourceLocationQuery: isGlobal ? undefined : rawLoc || 'display',
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 0-restock. Check GUIDED RESTOCK DISPLAY FROM BACKSTOCK intent:
  //            "restock display with 4 brats", "top off display with 6 hot dogs", "pull 4 brats from backstock to display",
  //            "restock 4 brats to display", "restock 4 brats into display"
  const restockWithMatch = segment.match(
    /^(?:restock|replenish|fill(?:\s+up)?|top\s+(?:off|up)|refill|stock)\s+(?:the\s+)?(.+?)\s+\bwith\s+(.+)$/i
  );
  const pullBackstockMatch = !restockWithMatch
    ? segment.match(
        /^(?:pull|grab|take|bring|move|restock|replenish|transfer)\s+(.+?)\s+\bfrom\s+(?:the\s+)?backstock(?:\s+(?:to|into)\s+(.+?))?\s*$/i
      )
    : null;
  const restockItemsToDisplayMatch =
    !restockWithMatch && !pullBackstockMatch
      ? segment.match(
          /^(?:restock|replenish|fill(?:\s+up)?|top\s+(?:off|up)|refill)\s+(.+?)\s+\b(?:to|into|for)\s+(?:the\s+)?(.+?)\s*$/i
        )
      : null;

  if (restockWithMatch || pullBackstockMatch || restockItemsToDisplayMatch) {
    const destLocRaw = restockWithMatch
      ? cleanLocationFragment(restockWithMatch[1])
      : pullBackstockMatch
      ? cleanLocationFragment(pullBackstockMatch[2] || 'display')
      : cleanLocationFragment(restockItemsToDisplayMatch![2]);
    const itemsBody = (
      restockWithMatch
        ? restockWithMatch[2]
        : pullBackstockMatch
        ? pullBackstockMatch[1]
        : restockItemsToDisplayMatch![1]
    ).trim();
    const destHits = resolveOnSiteLocationCandidates(destLocRaw, state, 'dest');
    const isExplicitBackstockOrDisplay =
      Boolean(pullBackstockMatch) ||
      /\bdisplay\b/i.test(destLocRaw) ||
      destHits.some(l => l.isDisplay);
    if (isExplicitBackstockOrDisplay && itemsBody) {
      const subItems = splitItemClauses(itemsBody);
      const outClauses: ParsedVoiceClause[] = [];
      for (const sub of subItems) {
        const qtyExtracted = extractLeadingQuantity(sub, { allowToAsTwo: true, defaultQty: 1 });
        outClauses.push(
          ...expandItemWithBundles({
            rawText: sub,
            intent: 'restock_display',
            quantity: qtyExtracted.quantity,
            productQuery: qtyExtracted.rest || sub,
            destLocationQuery: destLocRaw,
          })
        );
      }
      return outClauses;
    }
  }

  // 0a. Check general ALL-CONTAINERS LIST / COUNT in an optional freezer:
  //     "what containers are in freezer 1", "what boxes are in freezer 1", "how many bags are in freezer 1", "list all bins"
  const allContainersMatch = segment.match(
    new RegExp(
      `^(?:how\\s+many|count(?:\\s+the)?|what|which|list(?:\\s+all)?|show(?:\\s+(?:me|us))?(?:\\s+all)?)\\s+(?:all\\s+)?(${ALL_CONTAINER_NOUN_PLURAL_PATTERN})(?:\\s+(?:are|do\\s+(?:we|i|you)\\s+have|on\\s*site|stored))?(?:\\s+(?:in|inside|at)\\s+(.+))?\\s*[?!.]*$`,
      'i'
    )
  );
  if (allContainersMatch) {
    const isCount = /^(?:how\s+many|count)/i.test(segment);
    const matchedNoun = allContainersMatch[1].trim();
    const isGenericContainersWord = /^containers?$/i.test(matchedNoun);
    const freezerFilter = allContainersMatch[2]
      ? cleanLocationFragment(allContainersMatch[2])
      : undefined;
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'container_query',
          containerQueryMode: isCount ? 'count' : 'contents',
          quantity: 1,
          productQuery: isGenericContainersWord ? '__all_containers__' : '',
          sourceLocationQuery: isGenericContainersWord ? '' : singularizeSpecificContainerNoun(matchedNoun),
          queryLocationFilter: freezerFilter || undefined,
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 0b. Check CONTAINER CONTENTS QUERY:
  //     "what's in container orange in canada", "what is inside display", "list blue tote", "open orange in canada", "show container orange"
  const whatsInMatch = segment.match(
    /^(?:what(?:'s|s|\s+is|\s+are)?\s+(?:inside|in)|what\s+(?:do\s+(?:we|i)\s+have|items?\s+(?:are|do\s+we\s+have)|is\s+stored|is\s+left)\s+(?:inside|in)|list\s+(?:the\s+)?(?:contents\s+of\s+|items\s+in\s+)?|inspect\s+(?:the\s+)?|(?:look|see\s+what(?:'s|s))\s+inside\s+(?:the\s+)?)(.+)$/i
  );
  const explicitContainerInspectMatch = !whatsInMatch
    ? segment.match(
        /^(?:show(?:\s+(?:me|us))?|check|open|view)\s+(?:the\s+)?(?:(?:contents|items)\s+(?:of|in)\s+(?:the\s+)?(?:container\s+)?(.+)|(?:the\s+)?container\s+(.+)|(.+))$/i
      )
    : null;

  if (whatsInMatch) {
    const locQuery = cleanLocationFragment(
      whatsInMatch[1].replace(/^(?:the\s+)?container\s+/i, '').trim()
    );
    if (locQuery) {
      const id = `clause-${segIndex}-0`;
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: 'container_query',
            containerQueryMode: 'contents',
            quantity: 1,
            productQuery: '',
            sourceLocationQuery: locQuery,
          },
          state,
          overrides[id]
        ),
      ];
    }
  }

  if (explicitContainerInspectMatch) {
    const explicitTarget =
      explicitContainerInspectMatch[1] || explicitContainerInspectMatch[2];
    const implicitTarget = explicitContainerInspectMatch[3];
    const candidateRaw = cleanLocationFragment(explicitTarget || implicitTarget || '');
    const isExplicit = Boolean(explicitTarget);

    if (candidateRaw) {
      const locMatches = resolveOnSiteLocationCandidates(candidateRaw, state, 'any');
      const prodMatches = resolveOnSiteProductCandidates(candidateRaw, state);
      const topLocScore = locMatches[0]?.score ?? 0;
      const topProdScore = prodMatches[0]?.score ?? 0;
      if (isExplicit || (locMatches.length > 0 && topLocScore >= topProdScore)) {
        const id = `clause-${segIndex}-0`;
        return [
          evaluateParsedClause(
            {
              id,
              rawText: segmentRaw.trim(),
              intent: 'container_query',
              containerQueryMode: 'contents',
              quantity: 1,
              productQuery: '',
              sourceLocationQuery: candidateRaw,
            },
            state,
            overrides[id]
          ),
        ];
      }
    }
  }

  // 1. Check STOCK QUERY OR CONTAINER LOCATION/COUNT QUERY intent:
  //    - Product query: "how many pork liver do I have?", "do we still have brats?", "got any ribeye?", "any brats left?"
  //    - Container location lookup: "where is red bag", "where's orange in canada", "locate container blue tote"
  //    - Container count query: "how many green bags are in freezer 1"
  const whereInFirstMatch = segment.match(
    /^where\s+(?:in|inside|at)\s+(.+?)\s+(?:do\s+(?:i|we|you)\s+(?:have|keep|store)|have\s+(?:i|we)\s+got|did\s+(?:i|we)\s+(?:put|store|keep)|is|are)\s+(.+)$/i
  );
  const anyLeftMatch = !whereInFirstMatch
    ? segment.match(
        /^(?:(?:do\s+(?:we|i|you)\s+(?:still\s+)?have|have\s+(?:we|i)\s+got|are\s+there|is\s+there)\s+)?any\s+(.+?)\s+(?:left|remaining|available)(?:\s+(?:in|inside|at)\s+(.+?))?\s*[?!.]*$/i
      )
    : null;
  const queryRegex = /^(?:how\s+many|how\s+much|how(?:'s|\s+is|\s+are)(?:\s+(?:our|my|the))?\s+(?:stock|inventory|supply)(?:\s+(?:of|on|for))?|what(?:'s|\s+is)\s+(?:the\s+)?(?:count|stock|inventory)(?:\s+of)?|count(?:\s+of)?|check(?:\s+(?:stock|count|inventory)(?:\s+of)?)?|total(?:\s+of)?|do\s+(?:we|i|you)\s+(?:still\s+)?have(?:\s+any)?|have\s+(?:we|i)\s+got(?:\s+any)?|got\s+(?:any|some)|are\s+(?:there(?:\s+any)?|we\s+out\s+of)|is\s+there(?:\s+any)?|where(?:'s|s|\s+is|\s+are|\s+do\s+(?:i|we|you)\s+(?:have|keep|store)(?:\s+any)?|\s+have\s+(?:i|we)\s+got(?:\s+any)?|\s+did\s+(?:i|we)\s+(?:put|store|keep)|\s+can\s+(?:i|we)\s+(?:find|get))|find(?:\s+(?:me|us))?|locate(?:\s+(?:me|us))?|show(?:\s+(?:me|us))?|search(?:\s+for)?|look\s+up)\s+(.+)$/i;
  const isExplicitCountSet =
    /^count\b/i.test(segment) &&
    (hasTargetQtyExpression(segment) ||
      /\s+by\s+[+-]?(?:\d+|zero|one|two|too|three|four|for|five|six|seven|eight|ate|nine|ten)\b/i.test(
        segment
      ));
  const queryMatch = !whereInFirstMatch && !anyLeftMatch && !isExplicitCountSet ? segment.match(queryRegex) : null;
  if (whereInFirstMatch || anyLeftMatch || queryMatch) {
    const prefixLower = whereInFirstMatch
      ? 'where'
      : anyLeftMatch
      ? 'how many'
      : segment
          .slice(0, segment.length - queryMatch![1].length)
          .trim()
          .toLowerCase();
    const isWhereOrLocate = /^(?:where|locate|find)/i.test(prefixLower);
    const isCountPhrase = /^(?:how\s+many|count|total|are\s+there|is\s+there|do\s+(?:we|i|you)\s+(?:still\s+)?have|have\s+(?:we|i)\s+got|got\s+)/i.test(
      prefixLower
    );

    const body = cleanQueryProductPhrase(
      whereInFirstMatch ? whereInFirstMatch[2] : anyLeftMatch ? anyLeftMatch[1] : queryMatch![1]
    );
    let productQuery = body;
    let locationQuery: string | undefined = whereInFirstMatch
      ? cleanLocationFragment(whereInFirstMatch[1])
      : anyLeftMatch?.[2]
      ? cleanLocationFragment(anyLeftMatch[2])
      : undefined;

    // Optional location filter inside query: "brats in display" / "pork liver are in display" / "green bags are in freezer 1"
    const locInQuery = !locationQuery ? body.match(/^(.+?)\s+(?:in|inside|at|from)\s+(.+)$/i) : null;
    let matchedFreezersInLoc: VoiceFreezerCandidate[] = locationQuery
      ? resolveOnSiteFreezerCandidates(locationQuery, state)
      : [];
    if (locInQuery) {
      const trailLocRaw = cleanLocationFragment(locInQuery[2]);
      const candidateLocs = resolveOnSiteLocationCandidates(trailLocRaw, state, 'any');
      matchedFreezersInLoc = resolveOnSiteFreezerCandidates(trailLocRaw, state);
      if (candidateLocs.length > 0 || matchedFreezersInLoc.length > 0) {
        productQuery = cleanQueryProductPhrase(locInQuery[1]);
        locationQuery = trailLocRaw;
      }
    }

    const subjectRaw = productQuery || body;
    const explicitContainerWord = /^(?:the\s+)?containers?\s+|\s+containers?$/i.test(subjectRaw);
    const contSubjectCleaned =
      subjectRaw
        .replace(/^(?:the\s+)?containers?\s+/i, '')
        .replace(/\s+containers?$/i, '')
        .trim() || subjectRaw;
    const looksLikeContainerNoun =
      explicitContainerWord ||
      new RegExp(`\\b${ALL_CONTAINER_NOUN_PLURAL_PATTERN}\\b`, 'i').test(contSubjectCleaned);

    // Check product/bundle candidates vs non-loose container candidates to pick the best target type
    const prodCandidates = resolveOnSiteProductCandidates(subjectRaw, state);
    const bundleQueryMatch = resolveVoiceDictionaryBundles(subjectRaw, state);
    const topProdScore = Math.max(
      prodCandidates[0]?.score ?? 0,
      bundleQueryMatch ? bundleQueryMatch.best.score : 0
    );

    const fullLocQuery = locationQuery ? `${contSubjectCleaned} in ${locationQuery}` : contSubjectCleaned;
    const rawContCandidates = resolveOnSiteLocationCandidates(fullLocQuery, state, 'source').filter(
      c => !c.isLoose || /\b(?:loose|display|staging)\b/i.test(contSubjectCleaned)
    );
    const globalContCandidates = locationQuery
      ? resolveOnSiteLocationCandidates(contSubjectCleaned, state, 'source').filter(c => !c.isLoose)
      : rawContCandidates;
    const topContScore = rawContCandidates[0]?.score ?? 0;

    const shouldTreatAsContainerQuery =
      explicitContainerWord ||
      (rawContCandidates.length > 0 &&
        ((prodCandidates.length === 0 && !bundleQueryMatch) || topContScore > topProdScore)) ||
      (isCountPhrase &&
        Boolean(locationQuery) &&
        matchedFreezersInLoc.length > 0 &&
        prodCandidates.length === 0 &&
        !bundleQueryMatch &&
        (globalContCandidates.length > 0 || looksLikeContainerNoun));

    if (shouldTreatAsContainerQuery) {
      const id = `clause-${segIndex}-0`;
      const contMode: ParsedVoiceClause['containerQueryMode'] = isWhereOrLocate
        ? 'location'
        : isCountPhrase
        ? 'count'
        : 'contents';
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: 'container_query',
            containerQueryMode: contMode,
            quantity: 1,
            productQuery: '',
            sourceLocationQuery: contSubjectCleaned,
            queryLocationFilter: locationQuery,
          },
          state,
          overrides[id]
        ),
      ];
    }

    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'query',
          quantity: 1,
          productQuery: subjectRaw,
          sourceLocationQuery: locationQuery,
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 1b. Check INVENTORY CHANGE / BULK ADJUSTMENT intent BEFORE fallback:
  //     "adjust quantity of brats in display to two", "reduce inventory of hot dogs in box green to three",
  //     "reduce inventory of hot dogs in box green by three", "change inventory", "set inventory in display: 2 brats, 3 hotdogs"
  const parsedNewContainerEarly = parseNewContainerStatement(segment, state);
  const isStrictNewContainer = Boolean(parsedNewContainerEarly);
  const invChangeRegex =
    /^(reduce|decrease|lower|drop|cut|trim|bring\s+down|knock\s+down|increase|raise|bump|boost|bring\s+up|adjust|change|update|edit|modify|reconcile|reset|correct|recount|fix|mark|set|make|count)(?:\s+(.*))?$/i;
  const invChangeMatch = !isStrictNewContainer ? segment.match(invChangeRegex) : null;
  if (invChangeMatch) {
    const verbRaw = invChangeMatch[1].toLowerCase().replace(/\s+/g, ' ').trim();
    const afterVerbRaw = (invChangeMatch[2] || '').trim().replace(/[?!.]+$/g, '').trim();

    const nounStrip = afterVerbRaw.match(
      /^(?:(?:the|my|our|all)\s+)?(quantity|quantities|qty|inventory|stock(?:\s+levels?)?|count|counts|amount|amounts|level|levels)(?:\s+(?:of|for|on))?(?:\s+(.*))?$/i
    );
    const hasExplicitInvNoun = Boolean(nounStrip);
    let body = (nounStrip ? nounStrip[2] || '' : afterVerbRaw.replace(/^(?:on|for)\s+/i, '')).trim();
    if (!hasExplicitInvNoun && body) {
      // Strip optional leading "of " if someone says "change of brats in display to 2"
      body = body.replace(/^of\s+/i, '').trim();
    }

    const ambiguousVerbsRequireCue = new Set(['cut', 'trim', 'make', 'mark', 'fix', 'count']);
    const hasExplicitChangeCue =
      hasExplicitInvNoun ||
      /:/.test(body) ||
      hasTargetQtyExpression(body) ||
      /\s+by\s+[+-]?(?:\d+|zero|one|two|too|three|four|for|five|six|seven|eight|ate|nine|ten)\b/i.test(body);

    const isBareAmbiguousVerb = ambiguousVerbsRequireCue.has(verbRaw) && !hasExplicitChangeCue;

    if (!isBareAmbiguousVerb && (hasExplicitChangeCue || ['adjust', 'reduce', 'decrease', 'lower', 'drop', 'increase', 'raise', 'bump', 'boost', 'change', 'update', 'edit', 'modify', 'reconcile', 'reset', 'correct', 'set'].includes(verbRaw))) {
      const verbDirection: 'up' | 'down' | 'neutral' = [
        'reduce', 'decrease', 'lower', 'drop', 'cut', 'trim', 'bring down', 'knock down',
      ].includes(verbRaw)
        ? 'down'
        : ['increase', 'raise', 'bump', 'boost', 'bring up'].includes(verbRaw)
        ? 'up'
        : 'neutral';

      // Extract optional leading location ("adjust inventory in display: 2 brats, 3 hotdogs" or "change inventory in display to 2 brats, 3 hotdogs")
      let sharedLoc: string | undefined;
      const inlineColonMatch = body.match(/^(.+?)\s*:\s*(.*)$/);
      if (inlineColonMatch) {
        const leftColon = inlineColonMatch[1]
          .replace(/^(?:in|inside|at|from|for|on)\s+/i, '')
          .trim();
        const rightColon = inlineColonMatch[2].trim();
        if (leftColon && resolveOnSiteLocationCandidates(leftColon, state, 'any').length > 0) {
          sharedLoc = leftColon;
          body = rightColon;
        }
      }

      if (!sharedLoc && body) {
        const leadingLoc = tryExtractLeadingLocation(
          body,
          ['in', 'inside', 'at', 'from'],
          state,
          'source',
          { allowProductAfterLoc: true }
        );
        if (leadingLoc) {
          sharedLoc = leadingLoc.locQuery;
          // Handle "in display to 2 brats, 3 hotdogs" where "to" was the connector into items
          body = leadingLoc.remainingBody.replace(/^to\s+(?=\d|zero\b|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b)/i, '').trim();
        }
      }

      // If bare "change inventory" or "change inventory in display" (no items provided)
      if (!body || /^(?:in|inside|at|from)\s+.+$/i.test(body)) {
        const bareLocMatch = body.match(/^(?:in|inside|at|from)\s+(.+)$/i);
        const onlyLoc = sharedLoc || (bareLocMatch ? cleanLocationFragment(bareLocMatch[1]) : undefined);
        const id = `clause-${segIndex}-0`;
        return [
          evaluateParsedClause(
            {
              id,
              rawText: segmentRaw.trim(),
              intent: 'set_quantity',
              quantity: 0,
              adjustDirection: verbDirection,
              productQuery: '',
              sourceLocationQuery: onlyLoc,
            },
            state,
            overrides[id]
          ),
        ];
      }

      // Extract shared trailing location ONLY if it trails the final target/delta ("adjust brats to 2 and hotdogs to 3 in display")
      // or trails a multi-item shorthand list ("change inventory 2 brats, 0 ground pork in display")
      if (!sharedLoc) {
        const overallTarget = extractTargetQtyAndLoc(body, false);
        if (overallTarget.keyword !== 'none' && overallTarget.trailingLoc) {
          const trailingLocCandidate = overallTarget.trailingLoc;
          if (resolveOnSiteLocationCandidates(trailingLocCandidate, state, 'any').length > 0) {
            sharedLoc = trailingLocCandidate;
            const locSuffixRegex = new RegExp(
              `\\s+(?:in|inside|at|from|out\\s+of)\\s+${escapeRegExp(trailingLocCandidate)}\\s*$`,
              'i'
            );
            body = body.replace(locSuffixRegex, '').trim();
          }
        } else if (overallTarget.keyword === 'none') {
          const tailLoc = extractInLocationFromBody(body, state);
          if (tailLoc && tailLoc.itemBody && tailLoc.locQuery) {
            sharedLoc = tailLoc.locQuery;
            body = tailLoc.itemBody;
          }
        }
      }

      const allowBareOrLeadingQty =
        hasExplicitInvNoun ||
        ['set', 'reset', 'reconcile', 'recount', 'adjust', 'change', 'update', 'correct'].includes(verbRaw);

      const subItems = splitInventoryChangeItems(body);
      if (subItems.length === 0) {
        const id = `clause-${segIndex}-0`;
        return [
          evaluateParsedClause(
            {
              id,
              rawText: segmentRaw.trim(),
              intent: 'set_quantity',
              quantity: 0,
              adjustDirection: verbDirection,
              productQuery: '',
              sourceLocationQuery: sharedLoc,
            },
            state,
            overrides[id]
          ),
        ];
      }

      const outClauses: ParsedVoiceClause[] = [];
      for (const sub of subItems) {
        const parsed = extractTargetQtyAndLoc(sub, allowBareOrLeadingQty);
        let itemText = parsed.itemBody || sub;
        let localLoc = parsed.trailingLoc || sharedLoc;

        // Check for "from <loc>" or "in/at <loc>" inside itemText
        const fromLocMatch = itemText.match(/^(.+?)\s+\bfrom\s+(.+)$/i);
        if (fromLocMatch) {
          itemText = fromLocMatch[1].trim();
          localLoc = cleanLocationFragment(fromLocMatch[2]);
        } else {
          const inLoc = extractInLocationFromBody(itemText, state);
          if (inLoc) {
            itemText = inLoc.itemBody;
            localLoc = inLoc.locQuery;
          }
        }

        // Clean leftover descriptor noise like "quantity of ..." inside chained/split items
        itemText = itemText
          .replace(/^(?:(?:the|my|our)\s+)?(?:quantity|qty|inventory|stock|count|amount|level)\s+(?:of|for|on)\s+/i, '')
          .trim();

        // Route relative deltas ("by N", "by -N", "by +N", or directional reduce/increase + leading qty) to remove/add
        let clauseIntent: 'set_quantity' | 'remove' | 'add' = 'set_quantity';
        let clauseQty = parsed.quantity;
        let missingTargetQuantity = false;

        if (parsed.keyword === 'by') {
          if (parsed.isNegative) {
            clauseIntent = 'remove';
          } else if (parsed.isSigned && !parsed.isNegative) {
            clauseIntent = 'add';
          } else if (verbDirection === 'down') {
            clauseIntent = 'remove';
          } else {
            clauseIntent = 'add';
          }
          clauseQty = Math.max(1, parsed.quantity);
        } else if (parsed.keyword === 'leading' && verbDirection === 'down') {
          clauseIntent = 'remove';
          clauseQty = Math.max(1, parsed.quantity);
        } else if (parsed.keyword === 'leading' && verbDirection === 'up') {
          clauseIntent = 'add';
          clauseQty = Math.max(1, parsed.quantity);
        } else if (parsed.keyword === 'none') {
          clauseIntent = 'set_quantity';
          clauseQty = 1;
          missingTargetQuantity = true;
        }

        outClauses.push(
          ...expandItemWithBundles({
            rawText: sub,
            intent: clauseIntent,
            quantity: clauseQty,
            adjustDirection:
              clauseIntent === 'set_quantity' || clauseIntent === 'add' ? verbDirection : undefined,
            missingTargetQuantity,
            productQuery: itemText,
            sourceLocationQuery: clauseIntent === 'add' ? undefined : localLoc,
            destLocationQuery: clauseIntent === 'add' ? localLoc : undefined,
          })
        );
      }
      return outClauses;
    }
  }

  // 1c. Check CONVERSATIONAL PHYSICAL COUNT STATEMENTS ("there are 4 brats left in display", "we have 0 ground pork in display", "only 2 brats left in display"):
  const countStatementMatch = segment.match(
    /^(?:there(?:'s|s|\s+is|\s+are)(?:\s+only)?|we(?:'ve|\s+have)?(?:\s+got)?(?:\s+only)?|i(?:'ve|\s+have)?(?:\s+got)?(?:\s+only)?|i\s+(?:count|counted|see|found)(?:\s+only)?|only)\s+(.+?)\s+\b(?:in|inside|at)\s+(.+?)\s*[?!.]*$/i
  );
  if (countStatementMatch) {
    const rawCountBody = countStatementMatch[1]
      .replace(/\s+(?:left|remaining|on\s+hand|available|total)$/i, '')
      .trim();
    const rawCountLoc = cleanLocationFragment(countStatementMatch[2]);
    if (resolveOnSiteLocationCandidates(rawCountLoc, state, 'any').length > 0) {
      const zeroPrefixMatch = rawCountBody.match(/^(?:no|zero|0|none(?:\s+of)?(?:\s+the)?)\s+(.+)$/i);
      const qtyExtracted = zeroPrefixMatch
        ? { quantity: 0, hasExplicitQuantity: true, rest: zeroPrefixMatch[1].trim() }
        : extractLeadingQuantity(rawCountBody, { allowToAsTwo: false, defaultQty: 1 });
      if (qtyExtracted.hasExplicitQuantity && qtyExtracted.rest) {
        const id = `clause-${segIndex}-0`;
        return [
          evaluateParsedClause(
            {
              id,
              rawText: segmentRaw.trim(),
              intent: 'set_quantity',
              quantity: qtyExtracted.quantity,
              adjustDirection: 'neutral',
              productQuery: qtyExtracted.rest,
              sourceLocationQuery: rawCountLoc,
            },
            state,
            overrides[id]
          ),
        ];
      }
    }
  }

  // Helper to evaluate item/category removals (used by both "Empty Broths from display" & standard Remove intents)
  const buildRemoveClauses = (
    bodyInput: string,
    options?: { forceAllQuantity?: boolean; explicitSourceLoc?: string }
  ): ParsedVoiceClause[] => {
    let body = bodyInput.trim();
    let sharedSourceLoc: string | undefined = options?.explicitSourceLoc;
    const forceAllQuantity = Boolean(options?.forceAllQuantity);

    if (!sharedSourceLoc) {
      const fromLocMatch = body.match(/^(.+?)\s+\b(?:from|out\s+of)\s+(.+)$/i);
      if (fromLocMatch) {
        body = fromLocMatch[1].trim();
        sharedSourceLoc = fromLocMatch[2].trim();
      } else {
        const leadingLoc = tryExtractLeadingLocation(body, ['from', 'in', 'at'], state, 'source');
        if (leadingLoc) {
          sharedSourceLoc = leadingLoc.locQuery;
          body = leadingLoc.remainingBody;
        } else {
          const inLoc = extractInLocationFromBody(body, state);
          if (inLoc && !/,\s*[^,]+\b(?:from|in|inside|at|out\s+of)\b/i.test(inLoc.itemBody)) {
            body = inLoc.itemBody;
            sharedSourceLoc = inLoc.locQuery;
          }
        }
      }
    }

    const subItems = splitItemClauses(body);
    const outClauses: ParsedVoiceClause[] = [];

    for (const sub of subItems) {
      let itemText = sub;
      let localSrc = sharedSourceLoc;

      if (!options?.explicitSourceLoc) {
        const subFrom = itemText.match(/^(.+?)\s+\b(?:from|out\s+of)\s+(.+)$/i);
        if (subFrom) {
          itemText = subFrom[1].trim();
          localSrc = subFrom[2].trim();
        } else {
          const subIn = extractInLocationFromBody(itemText, state);
          if (subIn) {
            itemText = subIn.itemBody;
            localSrc = subIn.locQuery;
          }
        }
      }

      const qtyExtracted = extractLeadingQuantity(itemText, { allowToAsTwo: true, defaultQty: 1 });
      const cleanProdQuery = (qtyExtracted.rest || itemText).trim();
      const isAll = forceAllQuantity || Boolean(qtyExtracted.isAllQuantity);

      // Category-wide removal expansion when "all" / "empty" / "zero out" is spoken for a category/subcategory
      // e.g. "Empty Broths from display" or "remove all pork from display"
      if (isAll && cleanProdQuery) {
        const srcLocCands = localSrc ? resolveOnSiteLocationCandidates(localSrc, state, 'source') : [];
        if (!localSrc || srcLocCands.length > 0) {
          const scopedIds =
            srcLocCands.length > 0 ? new Set(srcLocCands.map(l => l.containerId)) : undefined;
          const bundleMatchForAll = resolveVoiceDictionaryBundles(cleanProdQuery, state, {
            scopedContainerIds: scopedIds,
          });
          const prodMatches = resolveOnSiteProductCandidates(cleanProdQuery, state, scopedIds);
          const catMatches = resolveCategoryCandidates(cleanProdQuery, state);
          const topProdScore = prodMatches[0]?.score ?? 0;
          const topCat = catMatches[0];
          const hasExactProd = prodMatches.some(p => p.isExact);
          const preferCategory =
            !bundleMatchForAll &&
            Boolean(topCat) &&
            !hasExactProd &&
            (topCat!.isExact || topCat!.score > topProdScore);

          if (preferCategory && topCat) {
            const matchingCats = catMatches.filter(c => c.score >= topCat.score - 5);
            const activeContainerIds = new Set(
              (state.containers || []).filter(c => !c.isArchived).map(c => c.id)
            );
            const matchedProductsInCat: Product[] = [];
            const seenProdIds = new Set<string>();

            for (const prod of (state.products || []).filter(p => !p.isArchived)) {
              const belongsToCat = matchingCats.some(cat =>
                cat.type === 'primary'
                  ? normalizeText(prod.primaryCategory) === normalizeText(cat.name)
                  : normalizeText(prod.subCategory) === normalizeText(cat.name)
              );
              if (!belongsToCat || seenProdIds.has(prod.id)) continue;

              const hasStockInScope = (state.meatCuts || []).some(
                mc =>
                  mc.quantity > 0 &&
                  mc.productId === prod.id &&
                  activeContainerIds.has(mc.containerId) &&
                  (!scopedIds || scopedIds.has(mc.containerId))
              );
              if (hasStockInScope) {
                seenProdIds.add(prod.id);
                matchedProductsInCat.push(prod);
              }
            }

            if (matchedProductsInCat.length > 0) {
              for (const prod of matchedProductsInCat) {
                const id = nextClauseId();
                outClauses.push(
                  evaluateParsedClause(
                    {
                      id,
                      rawText: sub,
                      intent: 'remove',
                      quantity: 1,
                      isAllQuantity: true,
                      productQuery: prod.name,
                      sourceLocationQuery: localSrc,
                    },
                    state,
                    overrides[id]
                  )
                );
              }
              continue;
            } else {
              const id = nextClauseId();
              const locLabel = srcLocCands[0]?.label || localSrc || 'on-site storage';
              outClauses.push({
                id,
                rawText: sub,
                intent: 'remove',
                quantity: 1,
                isAllQuantity: true,
                productQuery: cleanProdQuery,
                sourceLocationQuery: localSrc,
                excluded: false,
                productCandidates: [],
                selectedProductId: null,
                requiresProductSelection: false,
                sourceLocationCandidates: srcLocCands,
                selectedSourceContainerId: srcLocCands.length === 1 ? srcLocCands[0].containerId : null,
                requiresSourceLocationSelection: false,
                destLocationCandidates: [],
                selectedDestContainerId: null,
                requiresDestLocationSelection: false,
                cutCandidates: [],
                selectedMeatCutId: null,
                requiresCutSelection: false,
                isValid: false,
                errorMessage: `No ${topCat.name} stock available in ${locLabel}.`,
              });
              continue;
            }
          }
        }
      }

      outClauses.push(
        ...expandItemWithBundles({
          rawText: sub,
          intent: 'remove',
          quantity: qtyExtracted.quantity,
          isAllQuantity: isAll,
          productQuery: cleanProdQuery,
          sourceLocationQuery: localSrc,
        })
      );
    }

    return outClauses;
  };

  // 2. Check ITEM/CATEGORY EMPTYING BEFORE EMPTY CONTAINER intent:
  //    e.g. "Empty Broths from display", "clear chicken broth out of display", "wipe out ground pork in display"
  //    Never intercepts container-prefixed phrases ("empty container orange"), "to/into/except" transfers, or actual named containers ("empty orange in canada").
  const emptyItemOrContainerMatch = segment.match(
    /^(?:empty(?:\s+out)?|clear(?:\s+out)?|wipe(?:\s+out)?|clean(?:\s+out)?|unload|unpack|dump)\s+(.+)$/i
  );
  if (emptyItemOrContainerMatch) {
    const candidateBody = cleanLocationFragment(emptyItemOrContainerMatch[1]);
    const isContainerKeywordLead = new RegExp(
      `^(?:the\\s+)?${ALL_CONTAINER_NOUN_PLURAL_PATTERN}\\b`,
      'i'
    ).test(candidateBody);
    const hasContainerTransferClause = /\b(?:to|into|except(?:\s+for)?|excluding|other\s+than)\b/i.test(candidateBody);
    const matchesWholeNonLooseContainer =
      resolveOnSiteLocationCandidates(candidateBody, state, 'source').some(l => !l.isLoose);

    if (!isContainerKeywordLead && !hasContainerTransferClause && !matchesWholeNonLooseContainer) {
      const prepSplit = candidateBody.match(/^(.+?)\s+\b(from|out\s+of|in|inside|at)\s+(.+)$/i);
      if (prepSplit) {
        const subjectPart = prepSplit[1].trim();
        const prep = prepSplit[2].toLowerCase();
        const locPart = cleanLocationFragment(prepSplit[3]);
        const locMatches = resolveOnSiteLocationCandidates(locPart, state, 'source');
        if (locMatches.length > 0 && subjectPart) {
          if (prep === 'from' || prep === 'out of') {
            return buildRemoveClauses(subjectPart, { forceAllQuantity: true, explicitSourceLoc: locPart });
          }
          const scopedIds = new Set(locMatches.map(l => l.containerId));
          const hasProdOrCat =
            resolveOnSiteProductCandidates(subjectPart, state, scopedIds).length > 0 ||
            Boolean(resolveVoiceDictionaryBundles(subjectPart, state, { scopedContainerIds: scopedIds })) ||
            resolveCategoryCandidates(subjectPart, state).length > 0;
          if (hasProdOrCat) {
            return buildRemoveClauses(subjectPart, { forceAllQuantity: true, explicitSourceLoc: locPart });
          }
        }
      } else if (/^(?:wipe\s+out|clean\s+out)\b/i.test(segment)) {
        const hasProdOrCat =
          resolveOnSiteProductCandidates(candidateBody, state).length > 0 ||
          Boolean(resolveVoiceDictionaryBundles(candidateBody, state)) ||
          resolveCategoryCandidates(candidateBody, state).length > 0;
        if (hasProdOrCat) {
          return buildRemoveClauses(candidateBody, { forceAllQuantity: true });
        }
      }
    }
  }

  // 2b. Check EMPTY CONTAINER intent:
  //     "empty container orange in canada", "empty out orange", "clear out blue tote", "unload orange in canada to display except liver"
  const emptyMatch = segment.match(
    /^(?:empty(?:\s+out)?|clear(?:\s+out)?|unload|unpack|dump)\s+(.+)$/i
  );
  if (emptyMatch) {
    let rawBody = cleanLocationFragment(emptyMatch[1]);
    let exceptProductQueries: string[] | undefined;
    const exceptTail = rawBody.match(/^(.+?)\s+\b(?:except(?:\s+for)?|excluding|other\s+than)\s+(.+)$/i);
    if (exceptTail) {
      rawBody = cleanLocationFragment(exceptTail[1]);
      exceptProductQueries = splitPlainProductList(exceptTail[2]);
    }
    let destLocQuery: string | undefined;
    const toDestMatch = rawBody.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
    if (toDestMatch) {
      rawBody = cleanLocationFragment(toDestMatch[1]);
      destLocQuery = cleanLocationFragment(toDestMatch[2]);
    }
    const srcLocQuery = rawBody.replace(/^(?:the\s+)?container\s+/i, '').trim();
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'empty_container',
          quantity: 1,
          productQuery: '',
          sourceLocationQuery: srcLocQuery,
          destLocationQuery: destLocQuery,
          exceptProductQueries,
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 3. Check COMBINE / MERGE / CONSOLIDATE CONTAINERS intent:
  //    "combine containers x and y", "combine x and y into z", "merge container x into container y", "put x and y together"
  const combineMatch =
    segment.match(
      new RegExp(
        `^(?:combine|merge|consolidate|group)(?:\\s+(?:the\\s+)?${PLURAL_CONTAINER_GROUP_PREFIX_PATTERN})?\\s+(.+)$`,
        'i'
      )
    ) ||
    segment.match(/^put\s+(?:the\s+)?(?:containers?\s+)?(.+?\s+(?:and|with|&)\s+.+?)\s+together(?:\s+(?:in|into)\s+(.+?))?\s*[?!.]*$/i);
  if (combineMatch) {
    const rawBody = cleanLocationFragment(combineMatch[1]);
    const putTogetherDest = combineMatch[2] ? cleanLocationFragment(combineMatch[2]) : undefined;
    let combineExplicitTarget = false;
    let combineTargetQuery: string | undefined;
    let slotQueries: string[] = [];

    // Check trailing "into <target>" or "to <target>"
    const intoMatch = !putTogetherDest ? rawBody.match(/^(.+?)\s+\b(?:into|to)\s+(.+)$/i) : null;
    if (putTogetherDest) {
      slotQueries = splitCombineContainerNames(rawBody);
      combineExplicitTarget = true;
      combineTargetQuery = putTogetherDest.replace(/^(?:the\s+)?containers?\s+/i, '').trim();
    } else if (intoMatch) {
      const leftPart = intoMatch[1].trim();
      const rightPart = cleanLocationFragment(
        intoMatch[2].replace(/^(?:the\s+)?containers?\s+/i, '').trim()
      );
      const leftSlots = splitCombineContainerNames(leftPart);
      if (leftSlots.length >= 2) {
        // Multi-source + separate target: "combine X and Y into Z"
        slotQueries = leftSlots;
        combineExplicitTarget = true;
        combineTargetQuery = rightPart;
      } else {
        // Directional 2-container merge: "merge X into Y"
        slotQueries = [leftSlots[0] || leftPart, rightPart];
        combineExplicitTarget = true;
      }
    } else {
      slotQueries = splitCombineContainerNames(rawBody);
      combineExplicitTarget = false;
    }

    const id = `clause-${segIndex}-0`;
    const combineSlots: VoiceCombineSlot[] = slotQueries.map((q, slotIndex) => ({
      slotIndex,
      query: q,
      candidates: [],
      selectedContainerId: null,
      requiresSelection: false,
    }));

    return [
      evaluateParsedClause(
        {
          id,
          rawText: segmentRaw.trim(),
          intent: 'combine_containers',
          quantity: 1,
          productQuery: '',
          combineSlots,
          combineExplicitTarget,
          combineTargetQuery,
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 4. Check MOVE ALL CONTENTS of a container/location OR MOVE WHOLE CONTAINER:
  const moveVerbMatch = segment.match(/^(?:move|transfer|relocate|shift|put|bring|carry|transport|haul)\s+(.+)$/i);
  if (moveVerbMatch) {
    const moveBody = moveVerbMatch[1].trim();
    const isPutOrBring = /^(?:put|bring)\b/i.test(segment);

    // 4a. MOVE ALL CONTENTS of container/location Y to Z:
    const moveAllExplicit = moveBody.match(
      /^(?:all\s+(?:of\s+)?(?:the\s+)?(?:items|contents|stock|everything)\s+(?:in|inside|from|out\s+of|of)|everything\s+(?:in|inside|from|out\s+of|of)|all\s+(?:of\s+)?(?:the\s+)?container|all\s+(?:in|inside|from|out\s+of)|(?:the\s+)?contents\s+of)\s+(.+)$/i
    );
    const moveAllOfMatchRaw =
      !moveAllExplicit && !/\s+\bfrom\s+/i.test(moveBody)
        ? moveBody.match(/^all\s+of\s+(.+)$/i)
        : null;
    // Do not intercept "move all of the <product> in <loc> to <dest>" as whole-container move_all unless source actually matches a container/location and NOT a product
    const moveAllOfIsContainer = (() => {
      if (!moveAllOfMatchRaw) return false;
      const cand = cleanLocationFragment(moveAllOfMatchRaw[1]);
      const preDest = cand.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i)?.[1]?.trim() || cand;
      const cleanedSrc = preDest.replace(/^(?:the\s+)?container\s+/i, '').trim();
      const locHits = resolveOnSiteLocationCandidates(cleanedSrc, state, 'source');
      if (locHits.length > 0) return true;
      return !extractInLocationFromBody(preDest, state);
    })();
    const moveAllOfMatch = moveAllOfIsContainer ? moveAllOfMatchRaw : null;

    if (!isPutOrBring && (moveAllExplicit || moveAllOfMatch)) {
      let rest = cleanLocationFragment((moveAllExplicit || moveAllOfMatch)![1]);
      let exceptProductQueries: string[] | undefined;
      const exceptTail = rest.match(/^(.+?)\s+\b(?:except(?:\s+for)?|excluding|other\s+than)\s+(.+)$/i);
      if (exceptTail) {
        rest = cleanLocationFragment(exceptTail[1]);
        exceptProductQueries = splitPlainProductList(exceptTail[2]);
      }
      let srcLoc = rest;
      let destLoc: string | undefined;
      const toMatch = rest.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
      if (toMatch) {
        srcLoc = cleanLocationFragment(toMatch[1]);
        destLoc = cleanLocationFragment(toMatch[2]);
      }
      srcLoc = srcLoc.replace(/^(?:the\s+)?container\s+/i, '').trim();
      const id = `clause-${segIndex}-0`;
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: 'move_all',
            quantity: 1,
            productQuery: '',
            sourceLocationQuery: srcLoc,
            destLocationQuery: destLoc,
            exceptProductQueries,
          },
          state,
          overrides[id]
        ),
      ];
    }

    // 4b. MOVE WHOLE CONTAINER X to Freezer/Staging Z ("move container orange in canada to chest freezer", "move box yellow to chest freezer", "put bag green in freezer 1"):
    const explicitWholeContGeneric = moveBody.match(/^(?:the\s+)?container\s+(.+)$/i);
    const typedWholeContMatch = !explicitWholeContGeneric
      ? moveBody.match(new RegExp(`^(?:the\\s+)?((?:${SPECIFIC_CONTAINER_NOUN_PATTERN})\\s+.+)$`, 'i'))
      : null;
    const typedWholeContIsContainer = (() => {
      if (!typedWholeContMatch) return false;
      const bodyCand = cleanLocationFragment(typedWholeContMatch[1]);
      if (/\s+\bfrom\s+/i.test(bodyCand)) return false;
      const destSplit =
        bodyCand.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i) ||
        (isPutOrBring ? bodyCand.match(/^(.+?)\s+\b(?:in|inside)\s+(.+)$/i) : null);
      if (!destSplit) return false;
      const srcPart = cleanLocationFragment(destSplit[1]);
      const matchingProds = resolveOnSiteProductCandidates(srcPart, state);
      const matchingContainers = resolveOnSiteLocationCandidates(srcPart, state, 'source').filter(
        l => !l.isLoose
      );
      return matchingProds.length === 0 && matchingContainers.length > 0;
    })();

    if (explicitWholeContGeneric || typedWholeContIsContainer) {
      const rest = cleanLocationFragment(
        (explicitWholeContGeneric ? explicitWholeContGeneric[1] : typedWholeContMatch![1])
      );
      let srcContQuery = rest;
      let destQuery: string | undefined;

      const toDest = rest.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
      if (toDest) {
        srcContQuery = cleanLocationFragment(toDest[1]);
        destQuery = cleanLocationFragment(toDest[2]);
      } else if (isPutOrBring) {
        // Handle "put container yellow bag in chest freezer" / "put bag green in freezer 1"
        const inDest = rest.match(/^(.+?)\s+\b(?:in|inside)\s+(.+)$/i);
        if (inDest && resolveOnSiteFreezerCandidates(inDest[2], state).length > 0) {
          srcContQuery = cleanLocationFragment(inDest[1]);
          destQuery = cleanLocationFragment(inDest[2]);
        }
      }

      // If destination matches a non-loose named container (and not a freezer), treat seamlessly as move_all items into that container!
      const destFreezers = destQuery ? resolveOnSiteFreezerCandidates(destQuery, state) : [];
      const destContainers = destQuery ? resolveOnSiteLocationCandidates(destQuery, state, 'dest') : [];
      const destIsNamedContainerOnly =
        destFreezers.length === 0 && destContainers.some(c => !c.isLoose);

      const id = `clause-${segIndex}-0`;
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: destIsNamedContainerOnly ? 'move_all' : 'move_container',
            quantity: 1,
            productQuery: '',
            sourceLocationQuery: srcContQuery,
            destLocationQuery: destQuery,
          },
          state,
          overrides[id]
        ),
      ];
    }

    // 4c. Smart fallback for unprefixed whole-container move without quantity:
    //     e.g. "relocate orange in canada to chest freezer" (only when left side matches a non-loose container and NO product!)
    const noQtyToDest = moveBody.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
    if (
      noQtyToDest &&
      !isPutOrBring &&
      !extractLeadingQuantity(noQtyToDest[1].trim(), { allowToAsTwo: false }).hasExplicitQuantity &&
      !/\s+\bfrom\s+/i.test(noQtyToDest[1])
    ) {
      const candSrc = cleanLocationFragment(noQtyToDest[1]);
      const candDest = cleanLocationFragment(noQtyToDest[2]);
      const matchingProds = resolveOnSiteProductCandidates(candSrc, state);
      const matchingContainers = resolveOnSiteLocationCandidates(candSrc, state, 'source').filter(
        l => !l.isLoose
      );
      if (matchingProds.length === 0 && matchingContainers.length > 0) {
        const destFreezers = resolveOnSiteFreezerCandidates(candDest, state);
        const id = `clause-${segIndex}-0`;
        return [
          evaluateParsedClause(
            {
              id,
              rawText: segmentRaw.trim(),
              intent: destFreezers.length > 0 ? 'move_container' : 'move_all',
              quantity: 1,
              productQuery: '',
              sourceLocationQuery: candSrc,
              destLocationQuery: candDest,
            },
            state,
            overrides[id]
          ),
        ];
      }
    }
  }

  // 5. Check standard ITEM MOVE intent: "move/transfer/relocate/shift/bring/carry <items> from <src> to <dest>"
  //    Also supports "take/pull/grab/put <items> from <src> to|into <dest>" ONLY when both source and destination are present.
  const moveRegex = /^(?:move|transfer|relocate|shift|bring|carry|transport|haul)\s+(.+)$/i;
  const moveFromToWithTakeMatch = !segment.match(moveRegex)
    ? segment.match(
        /^(?:take|pull|grab|put)\s+(.+?\s+(?:\bfrom\s+.+?\s+\b(?:to|into)\s+.+|\b(?:to|into)\s+.+?\s+\bfrom\s+.+))$/i
      )
    : null;
  const moveMatch = segment.match(moveRegex) || moveFromToWithTakeMatch;
  if (moveMatch) {
    let body = moveMatch[1].trim();
    let sharedSourceLoc: string | undefined;
    let sharedDestLoc: string | undefined;

    // Extract "from <src> to <dest>" or "to <dest> from <src>" at the tail
    const fromToMatch = body.match(/^(.+?)\s+\b(?:from|out\s+of)\s+(.+?)\s+\b(?:to|into)\s+(.+)$/i);
    const toFromMatch = body.match(/^(.+?)\s+\b(?:to|into)\s+(.+?)\s+\b(?:from|out\s+of)\s+(.+)$/i);
    const onlyToMatch = body.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
    const onlyFromMatch = body.match(/^(.+?)\s+\b(?:from|out\s+of)\s+(.+)$/i);

    if (fromToMatch) {
      body = fromToMatch[1].trim();
      sharedSourceLoc = fromToMatch[2].trim();
      sharedDestLoc = fromToMatch[3].trim();
    } else if (toFromMatch) {
      body = toFromMatch[1].trim();
      sharedDestLoc = toFromMatch[2].trim();
      sharedSourceLoc = toFromMatch[3].trim();
    } else if (onlyToMatch) {
      body = onlyToMatch[1].trim();
      sharedDestLoc = onlyToMatch[2].trim();
      const leadingLoc = tryExtractLeadingLocation(body, ['from', 'in', 'at'], state, 'source');
      if (leadingLoc) {
        sharedSourceLoc = leadingLoc.locQuery;
        body = leadingLoc.remainingBody;
      } else {
        const inLoc = extractInLocationFromBody(body, state);
        if (inLoc && !/,\s*[^,]+\b(?:from|in|inside|at|out\s+of)\b/i.test(inLoc.itemBody)) {
          body = inLoc.itemBody;
          sharedSourceLoc = inLoc.locQuery;
        }
      }
    } else if (onlyFromMatch) {
      body = onlyFromMatch[1].trim();
      sharedSourceLoc = onlyFromMatch[2].trim();
    } else {
      const leadingLoc = tryExtractLeadingLocation(body, ['from', 'in', 'at'], state, 'source');
      if (leadingLoc) {
        sharedSourceLoc = leadingLoc.locQuery;
        body = leadingLoc.remainingBody;
      } else {
        const inLoc = extractInLocationFromBody(body, state);
        if (inLoc && !/,\s*[^,]+\b(?:from|in|inside|at|out\s+of)\b/i.test(inLoc.itemBody)) {
          body = inLoc.itemBody;
          sharedSourceLoc = inLoc.locQuery;
        }
      }
    }

    const subItems = splitItemClauses(body);
    const outClauses: ParsedVoiceClause[] = [];
    for (const sub of subItems) {
      let itemText = sub;
      let localSrc = sharedSourceLoc;
      let localDest = sharedDestLoc;

      const subFromTo = itemText.match(/^(.+?)\s+\b(?:from|out\s+of)\s+(.+?)\s+\b(?:to|into)\s+(.+)$/i);
      if (subFromTo) {
        itemText = subFromTo[1].trim();
        localSrc = subFromTo[2].trim();
        localDest = subFromTo[3].trim();
      } else {
        const subFrom = itemText.match(/^(.+?)\s+\b(?:from|out\s+of)\s+(.+)$/i);
        if (subFrom) {
          itemText = subFrom[1].trim();
          localSrc = subFrom[2].trim();
        } else {
          const subIn = extractInLocationFromBody(itemText, state);
          if (subIn) {
            itemText = subIn.itemBody;
            localSrc = subIn.locQuery;
          }
        }
      }

      const qtyExtracted = extractLeadingQuantity(itemText, { allowToAsTwo: true, defaultQty: 1 });
      outClauses.push(
        ...expandItemWithBundles({
          rawText: sub,
          intent: 'move',
          quantity: qtyExtracted.quantity,
          isAllQuantity: qtyExtracted.isAllQuantity,
          productQuery: qtyExtracted.rest || itemText,
          sourceLocationQuery: localSrc,
          destLocationQuery: localDest,
        })
      );
    }
    return outClauses;
  }

  // 6. Check REMOVE intent: "remove/take/deduct/sell/sold/pull/grab/consume/discard/write off/zero out/sold out of <items> [from <src>]"
  const allRemovalMatch = segment.match(
    /^(?:zero\s+out|sold\s+out\s+of|ran\s+out\s+of|(?:we(?:'re|\s+are)|i(?:'m|\s+am))\s+out\s+of)\s+(.+)$/i
  );
  const finishedOrUsedUpMatch = !allRemovalMatch
    ? segment.match(/^(?:finished|used\s+up)\s+(.+)$/i)
    : null;
  const removeRegex =
    /^(?:remove|take|took|deduct|subtract|minus|sell|sold|pull|pulled|grab|grabbed|check\s*out|checkout|use|used|consume|consumed|cook|cooked|discard|write\s+off|wrote\s+off)\s+(.+)$/i;
  const removeMatch = !allRemovalMatch && !finishedOrUsedUpMatch ? segment.match(removeRegex) : null;
  if (allRemovalMatch || finishedOrUsedUpMatch || removeMatch) {
    if (allRemovalMatch) {
      return buildRemoveClauses(allRemovalMatch[1], { forceAllQuantity: true });
    }
    if (finishedOrUsedUpMatch) {
      const fBody = finishedOrUsedUpMatch[1].trim();
      const hasExplicitCount = startsWithNumberToken(fBody);
      return buildRemoveClauses(fBody, { forceAllQuantity: !hasExplicitCount });
    }
    return buildRemoveClauses(removeMatch![1]);
  }

  // Check STRICT NEW CONTAINER CREATION (container-first, adjective-before-noun, or items-first "to/into new ...")
  const parsedNewContainer = parsedNewContainerEarly || parseNewContainerStatement(segment, state);
  if (parsedNewContainer) {
    const {
      containerNameQuery,
      freezerQuery,
      itemsPart,
      explicitTemplateRequested,
      inferredIcon,
    } = parsedNewContainer;
    const groupKey = `newcont-${segIndex}`;

    if (!itemsPart) {
      const id = `clause-${segIndex}-0`;
      return [
        evaluateParsedClause(
          {
            id,
            rawText: segment,
            intent: 'add_container',
            quantity: 1,
            productQuery: '',
            newContainerGroupKey: groupKey,
            newContainerNameQuery: containerNameQuery,
            newContainerFreezerQuery: freezerQuery,
            newContainerIcon: inferredIcon,
            explicitTemplateRequested,
          },
          state,
          overrides[id]
        ),
      ];
    }

    const subItems = splitItemClauses(itemsPart);
    const outClauses: ParsedVoiceClause[] = [];
    for (const sub of subItems) {
      const qtyExtracted = extractLeadingQuantity(sub, { allowToAsTwo: true, defaultQty: 1 });
      outClauses.push(
        ...expandItemWithBundles({
          rawText: sub,
          intent: 'add',
          quantity: qtyExtracted.quantity,
          productQuery: qtyExtracted.rest || sub,
          newContainerGroupKey: groupKey,
          newContainerNameQuery: containerNameQuery,
          newContainerFreezerQuery: freezerQuery,
          newContainerIcon: inferredIcon,
          explicitTemplateRequested,
        })
      );
    }
    return outClauses;
  }

  // Check ADD intent: "add/put/restock/plus/pack/receive/inbound/stock/toss/load/store/stash <items> [to/into/in <dest>]"
  const addRegex =
    /^(?:please\s+)?(?:add|put|restock|plus|pack|packed|receive|received|inbound|inbounded|stock|toss|place|load|store|stash|enter|log)\s+(.+)$/i;
  const addMatch = segment.match(addRegex);
  if (addMatch) {
    let body = addMatch[1].trim();
    let sharedDestLoc: string | undefined;

    const toLocMatch = body.match(/^(.+?)\s+\b(?:to|into|in|at)\s+(.+)$/i);
    if (toLocMatch) {
      const candidateDest = toLocMatch[2].trim();
      const destHasNestedFreezer = /\b(?:in|into|inside|at)\s+.+$/i.test(candidateDest);
      // Ensure "to" isn't part of a trailing item name unless it matches a location, uses to/into, or encodes "<container> in <freezer>"
      if (
        /\s+(?:to|into)\s+/i.test(body) ||
        resolveOnSiteLocationCandidates(candidateDest, state, 'dest').length > 0 ||
        destHasNestedFreezer
      ) {
        body = toLocMatch[1].trim();
        sharedDestLoc = candidateDest;
      }
    } else {
      const leadingLoc = tryExtractLeadingLocation(body, ['to', 'into', 'in', 'at'], state, 'dest');
      if (leadingLoc) {
        sharedDestLoc = leadingLoc.locQuery;
        body = leadingLoc.remainingBody;
      }
    }

    const subItems = splitItemClauses(body);
    const outClauses: ParsedVoiceClause[] = [];
    for (const sub of subItems) {
      let itemText = sub;
      let localDest = sharedDestLoc;

      const subTo = itemText.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
      if (subTo) {
        itemText = subTo[1].trim();
        localDest = subTo[2].trim();
      }

      const qtyExtracted = extractLeadingQuantity(itemText, { allowToAsTwo: true, defaultQty: 1 });
      outClauses.push(
        ...expandItemWithBundles({
          rawText: sub,
          intent: 'add',
          quantity: qtyExtracted.quantity,
          productQuery: qtyExtracted.rest || itemText,
          destLocationQuery: localDest,
        })
      );
    }
    return outClauses;
  }

  // Fallback: Partial or unrecognized fragments — analyze for 1-tap intent conversion without retyping
  if (lower.length > 0) {
    const id = `clause-${segIndex}-0`;
    const ov = overrides[id];
    const analysis = analyzeUnknownSegment(segment, state);

    if (ov?.fallbackIntent) {
      const targetIntent = ov.fallbackIntent;
      const inferredProd =
        analysis.inferredProductQuery ||
        analysis.suggestedFallbackProducts[0]?.product.name ||
        segment;
      const inferredLoc =
        analysis.inferredLocationQuery && analysis.inferredFreezerQuery
          ? `${analysis.inferredLocationQuery} in ${analysis.inferredFreezerQuery}`
          : analysis.inferredLocationQuery || analysis.inferredFreezerQuery;

      if (targetIntent === 'move_container') {
        return [
          evaluateParsedClause(
            {
              id,
              rawText: segmentRaw.trim(),
              intent: 'move_container',
              quantity: 1,
              productQuery: '',
              sourceLocationQuery: analysis.inferredLocationQuery || segment,
              destLocationQuery: analysis.inferredFreezerQuery,
            },
            state,
            ov
          ),
        ];
      }

      if (targetIntent === 'query') {
        if (!analysis.inferredProductQuery && analysis.inferredLocationQuery) {
          return [
            evaluateParsedClause(
              {
                id,
                rawText: segmentRaw.trim(),
                intent: 'container_query',
                quantity: 1,
                productQuery: '',
                sourceLocationQuery: analysis.inferredLocationQuery,
                containerQueryMode: 'contents',
              },
              state,
              ov
            ),
          ];
        }
        return [
          evaluateParsedClause(
            {
              id,
              rawText: segmentRaw.trim(),
              intent: 'query',
              quantity: 1,
              productQuery: inferredProd,
              sourceLocationQuery: inferredLoc,
            },
            state,
            ov
          ),
        ];
      }

      return [
        evaluateParsedClause(
          {
            id,
            rawText: segmentRaw.trim(),
            intent: targetIntent,
            quantity: analysis.quantity,
            productQuery: inferredProd,
            sourceLocationQuery:
              targetIntent === 'remove' || targetIntent === 'move' ? inferredLoc : undefined,
            destLocationQuery: targetIntent === 'add' ? inferredLoc : undefined,
          },
          state,
          ov
        ),
      ];
    }

    return [
      evaluateParsedClause(
        {
          id,
          rawText: segment,
          intent: 'unknown',
          quantity: analysis.quantity,
          productQuery: segment,
        },
        state,
        ov
      ),
    ];
  }

  return [];
}

/**
 * Main entry point: locally and deterministically interpret a spoken/typed transcript
 * against On-Site inventory only (never mutates or reads off-site/butcher entities).
 */
export function parseVoiceTranscript(
  transcript: string,
  state: InventoryState,
  overrides: Record<string, VoiceSelectionOverrides> = {}
): ParsedVoiceResult {
  const rawTranscript = transcript || '';
  const expandedTranscript = applyCustomPhraseDictionary(rawTranscript, state);
  const commands = splitTopLevelCommands(expandedTranscript, state);

  const clauses: ParsedVoiceClause[] = [];
  commands.forEach((cmd, idx) => {
    clauses.push(...parseCommandSegment(cmd, idx, state, overrides));
  });

  const activeMutations = clauses.filter(
    c =>
      !c.excluded &&
      (c.intent === 'remove' ||
        c.intent === 'move' ||
        c.intent === 'add' ||
        c.intent === 'set_quantity' ||
        c.intent === 'add_container' ||
        c.intent === 'empty_container' ||
        c.intent === 'move_all' ||
        c.intent === 'move_container' ||
        c.intent === 'combine_containers' ||
        c.intent === 'swap_containers' ||
        c.intent === 'rename_container' ||
        c.intent === 'archive_container' ||
        c.intent === 'delete_container' ||
        c.intent === 'restock_display' ||
        c.intent === 'manage_list' ||
        c.intent === 'manage_tag' ||
        c.intent === 'correct_label' ||
        c.intent === 'undo_last')
  );
  const queries = clauses.filter(
    c =>
      !c.excluded &&
      (c.intent === 'query' ||
        c.intent === 'container_query' ||
        c.intent === 'list_query' ||
        c.intent === 'inventory_alert_query')
  );
  const readyMutationCount = activeMutations.filter(c => c.isValid).length;
  const pendingSelectionCount = activeMutations.filter(c => !c.isValid).length;

  return {
    rawTranscript,
    clauses,
    hasMutations: activeMutations.length > 0,
    hasQueries: queries.length > 0,
    readyMutationCount,
    pendingSelectionCount,
  };
}

function generateNewContainerId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `cont_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Convert validated, unambiguously resolved on-site mutation clauses
 * into standard Inventory Action payloads (never produces off-site or butcher actions).
 */
export function buildVoiceDispatchActions(
  clauses: ParsedVoiceClause[],
  state: InventoryState
): Action[] {
  const actions: Action[] = [];
  const removeDeltas: Record<string, number> = {};
  const setTargets: Record<string, number> = {};
  const batchListUpdates: Array<{
    listId: string;
    productId: string;
    notes?: string;
    forceState?: boolean;
    threshold?: number;
  }> = [];
  const createdGroupContainerIds = new Map<string, string>();

  // Safeguard: never create a container with zero valid items in its group
  const groupsWithValidItems = new Set<string>();
  for (const c of clauses) {
    if (
      !c.excluded &&
      c.isValid &&
      c.newContainerGroupKey &&
      c.intent === 'add' &&
      c.selectedProductId &&
      c.quantity > 0
    ) {
      groupsWithValidItems.add(c.newContainerGroupKey);
    }
  }

  for (const clause of clauses) {
    if (clause.excluded || !clause.isValid) continue;

    // Handle UNDO LAST COMMAND
    if (clause.intent === 'undo_last') {
      actions.push({ type: 'UNDO' });
      continue;
    }

    // Handle CUSTOM LIST ACTIONS
    if (clause.intent === 'manage_list' && clause.selectedListId && clause.selectedProductId) {
      const listAction = clause.listAction || 'add';
      const listObj = (state.customLists || []).find(l => l.id === clause.selectedListId);
      const isAlreadyOnList = Boolean(
        listObj?.items.some(it => it.productId === clause.selectedProductId)
      );

      if (listAction === 'add' || listAction === 'remove') {
        batchListUpdates.push({
          listId: clause.selectedListId,
          productId: clause.selectedProductId,
          forceState: listAction === 'add',
          ...(listAction === 'add' && clause.listThreshold !== undefined
            ? { threshold: clause.listThreshold }
            : {}),
        });
      } else if (listAction === 'set_threshold' && clause.listThreshold !== undefined) {
        if (!isAlreadyOnList) {
          batchListUpdates.push({
            listId: clause.selectedListId,
            productId: clause.selectedProductId,
            forceState: true,
            threshold: clause.listThreshold,
          });
        } else {
          actions.push({
            type: 'UPDATE_LIST_ITEM_THRESHOLD',
            payload: {
              listId: clause.selectedListId,
              productId: clause.selectedProductId,
              threshold: clause.listThreshold,
            },
          });
        }
      } else if (listAction === 'enable_notify' || listAction === 'disable_notify') {
        actions.push({
          type: 'TOGGLE_LIST_ITEM_NOTIFICATION',
          payload: {
            listId: clause.selectedListId,
            productId: clause.selectedProductId,
            notifyEnabled: listAction === 'enable_notify',
          },
        });
      }
      continue;
    }

    // Handle GUIDED RESTOCK DISPLAY FROM BACKSTOCK
    if (
      clause.intent === 'restock_display' &&
      clause.selectedDestContainerId &&
      clause.restockAllocations &&
      clause.restockAllocations.length > 0
    ) {
      for (const alloc of clause.restockAllocations) {
        actions.push({
          type: 'MOVE_MEAT_QUANTITY',
          payload: {
            meatCutId: alloc.meatCut.id,
            productId: alloc.product.id,
            sourceContainerId: alloc.container.id,
            newContainerId: clause.selectedDestContainerId,
            quantity: alloc.moveQty,
          },
        });
      }
      continue;
    }

    // Handle SWAP CONTAINERS
    if (
      clause.intent === 'swap_containers' &&
      clause.selectedSourceContainerId &&
      clause.selectedDestContainerId
    ) {
      const contA = (state.containers || []).find(c => c.id === clause.selectedSourceContainerId);
      const contB = (state.containers || []).find(c => c.id === clause.selectedDestContainerId);
      if (contA && contB) {
        actions.push(
          {
            type: 'MOVE_CONTAINER',
            payload: {
              containerId: contA.id,
              newFreezerId: contB.freezerId,
            },
          },
          {
            type: 'MOVE_CONTAINER',
            payload: {
              containerId: contB.id,
              newFreezerId: contA.freezerId,
            },
          }
        );
      }
      continue;
    }

    // Handle RENAME / ARCHIVE / DELETE CONTAINER
    if (clause.intent === 'rename_container' && clause.selectedSourceContainerId && clause.newContainerNameInput) {
      actions.push({
        type: 'EDIT_CONTAINER',
        payload: {
          containerId: clause.selectedSourceContainerId,
          updates: { name: clause.newContainerNameInput.trim() },
        },
      });
      continue;
    }

    if (clause.intent === 'archive_container' && clause.selectedSourceContainerId) {
      actions.push({
        type: 'TOGGLE_CONTAINER_ARCHIVED',
        payload: {
          containerId: clause.selectedSourceContainerId,
          isArchived: clause.archiveState !== false,
        },
      });
      continue;
    }

    if (clause.intent === 'delete_container' && clause.selectedSourceContainerId) {
      actions.push({
        type: 'DELETE_CONTAINER',
        payload: {
          containerId: clause.selectedSourceContainerId,
        },
      });
      continue;
    }

    // Handle MANAGE TAG (idempotent against current tagIds so TOGGLE_MEAT_TAG never flips backwards)
    if (clause.intent === 'manage_tag' && clause.selectedMeatCutId && clause.selectedTagId) {
      const cut = (state.meatCuts || []).find(m => m.id === clause.selectedMeatCutId);
      if (cut) {
        const hasTag = (cut.tagIds || []).includes(clause.selectedTagId);
        const wantAdd = (clause.tagAction || 'add') === 'add';
        if ((wantAdd && !hasTag) || (!wantAdd && hasTag)) {
          actions.push({
            type: 'TOGGLE_MEAT_TAG',
            payload: {
              meatCutId: cut.id,
              tagId: clause.selectedTagId,
            },
          });
        }
      }
      continue;
    }

    // Handle CORRECT LABEL
    if (
      clause.intent === 'correct_label' &&
      clause.selectedMeatCutId &&
      clause.selectedReplacementProductId
    ) {
      actions.push({
        type: 'CORRECT_MEAT_LABEL',
        payload: {
          meatCutId: clause.selectedMeatCutId,
          correctProductId: clause.selectedReplacementProductId,
        },
      });
      continue;
    }

    // Handle strict-keyword new container creation (creates once per groupKey ONLY if group has >= 1 valid item)
    if (clause.newContainerGroupKey && (clause.intent === 'add_container' || clause.intent === 'add')) {
      if (!groupsWithValidItems.has(clause.newContainerGroupKey)) {
        continue;
      }

      let targetContainerId = createdGroupContainerIds.get(clause.newContainerGroupKey);
      if (!targetContainerId) {
        const freezerId =
          clause.selectedFreezerId && clause.selectedFreezerId !== '__staging__'
            ? clause.selectedFreezerId
            : undefined;

        if (clause.selectedExistingSpareContainerId) {
          targetContainerId = clause.selectedExistingSpareContainerId;
          createdGroupContainerIds.set(clause.newContainerGroupKey, targetContainerId);
          const spare = (state.containers || []).find(c => c.id === targetContainerId);
          if (spare && (spare.freezerId || undefined) !== freezerId) {
            actions.push({
              type: 'MOVE_CONTAINER',
              payload: {
                containerId: targetContainerId,
                newFreezerId: freezerId,
              },
            });
          }
        } else {
          targetContainerId = generateNewContainerId();
          createdGroupContainerIds.set(clause.newContainerGroupKey, targetContainerId);

          const chosenTemplate = (clause.templateCandidates || []).find(
            t => t.templateId === clause.selectedTemplateId && !t.isCustom
          );
          const containerName =
            clause.resolvedNewContainerName ||
            chosenTemplate?.name ||
            formatSpokenContainerName(clause.newContainerNameQuery || 'New Container');
          const icon = clause.newContainerIcon || chosenTemplate?.icon || 'box';
          const imageUrl =
            clause.newContainerImageUrl !== undefined
              ? clause.newContainerImageUrl
              : chosenTemplate?.imageUrl;

          let finalTemplateId = chosenTemplate?.templateId;
          if (clause.newContainerSaveAsTemplate && !finalTemplateId) {
            const existingTpl = (state.containerTemplates || []).find(
              t => normalizeText(t.name) === normalizeText(containerName)
            );
            if (existingTpl) {
              finalTemplateId = existingTpl.id;
            } else {
              finalTemplateId = generateNewContainerId();
              actions.push({
                type: 'ADD_CONTAINER_TEMPLATE',
                payload: {
                  id: finalTemplateId,
                  name: containerName,
                  icon,
                  imageUrl,
                },
              });
            }
          }

          actions.push({
            type: 'ADD_CONTAINER',
            payload: {
              id: targetContainerId,
              name: containerName,
              freezerId,
              templateId: finalTemplateId,
              imageUrl,
              icon,
            },
          });
        }
      }

      if (clause.intent === 'add' && clause.selectedProductId && clause.quantity > 0) {
        actions.push({
          type: 'ADD_MEAT_CUT',
          payload: {
            productId: clause.selectedProductId,
            quantity: clause.quantity,
            containerId: targetContainerId,
          },
        });
      }
      continue;
    }

    if (
      (clause.intent === 'empty_container' || clause.intent === 'move_all') &&
      clause.selectedSourceContainerId &&
      clause.selectedDestContainerId
    ) {
      const excludedProdSet = new Set(clause.excludedProductIds || []);
      const cuts = (state.meatCuts || []).filter(
        mc =>
          mc.containerId === clause.selectedSourceContainerId &&
          mc.quantity > 0 &&
          !excludedProdSet.has(mc.productId)
      );
      for (const mc of cuts) {
        actions.push({
          type: 'MOVE_MEAT_QUANTITY',
          payload: {
            meatCutId: mc.id,
            productId: mc.productId,
            sourceContainerId: clause.selectedSourceContainerId,
            newContainerId: clause.selectedDestContainerId,
            quantity: mc.quantity,
          },
        });
      }
      continue;
    }

    if (
      clause.intent === 'move_container' &&
      clause.selectedSourceContainerId &&
      clause.selectedFreezerId
    ) {
      actions.push({
        type: 'MOVE_CONTAINER',
        payload: {
          containerId: clause.selectedSourceContainerId,
          newFreezerId:
            clause.selectedFreezerId === '__staging__' ? undefined : clause.selectedFreezerId,
        },
      });
      continue;
    }

    if (
      clause.intent === 'combine_containers' &&
      clause.combineSlots &&
      clause.selectedDestContainerId
    ) {
      const absorbedIds = Array.from(
        new Set(
          clause.combineSlots
            .map(s => s.selectedContainerId)
            .filter((id): id is string => Boolean(id) && id !== clause.selectedDestContainerId)
        )
      );
      for (const srcId of absorbedIds) {
        const cuts = (state.meatCuts || []).filter(
          mc => mc.containerId === srcId && mc.quantity > 0
        );
        for (const mc of cuts) {
          actions.push({
            type: 'MOVE_MEAT_QUANTITY',
            payload: {
              meatCutId: mc.id,
              productId: mc.productId,
              sourceContainerId: srcId,
              newContainerId: clause.selectedDestContainerId,
              quantity: mc.quantity,
            },
          });
        }
      }
      continue;
    }

    if (clause.intent === 'remove' && clause.selectedMeatCutId) {
      removeDeltas[clause.selectedMeatCutId] =
        (removeDeltas[clause.selectedMeatCutId] || 0) + clause.quantity;
    } else if (clause.intent === 'set_quantity') {
      if (clause.selectedMeatCutId) {
        setTargets[clause.selectedMeatCutId] = Math.max(0, clause.quantity);
      } else if (
        clause.quantity > 0 &&
        clause.selectedProductId &&
        clause.selectedSourceContainerId
      ) {
        actions.push({
          type: 'ADD_MEAT_CUT',
          payload: {
            productId: clause.selectedProductId,
            quantity: clause.quantity,
            containerId: clause.selectedSourceContainerId,
          },
        });
      }
    } else if (
      clause.intent === 'move' &&
      clause.selectedMeatCutId &&
      clause.selectedProductId &&
      clause.selectedSourceContainerId &&
      clause.selectedDestContainerId
    ) {
      actions.push({
        type: 'MOVE_MEAT_QUANTITY',
        payload: {
          meatCutId: clause.selectedMeatCutId,
          productId: clause.selectedProductId,
          sourceContainerId: clause.selectedSourceContainerId,
          newContainerId: clause.selectedDestContainerId,
          quantity: clause.quantity,
        },
      });
    } else if (
      clause.intent === 'add' &&
      clause.selectedProductId &&
      clause.selectedDestContainerId
    ) {
      actions.push({
        type: 'ADD_MEAT_CUT',
        payload: {
          productId: clause.selectedProductId,
          quantity: clause.quantity,
          containerId: clause.selectedDestContainerId,
        },
      });
    }
  }

  if (batchListUpdates.length > 0) {
    actions.push({
      type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST',
      payload: { updates: batchListUpdates },
    });
  }

  const batchUpdates: Record<string, number> = {};
  for (const [cutId, delta] of Object.entries(removeDeltas)) {
    const mc = (state.meatCuts || []).find(m => m.id === cutId);
    if (!mc) continue;
    const nextQty = Math.max(0, mc.quantity - delta);
    if (nextQty !== mc.quantity) {
      batchUpdates[cutId] = nextQty;
    }
  }

  for (const [cutId, targetQty] of Object.entries(setTargets)) {
    const mc = (state.meatCuts || []).find(m => m.id === cutId);
    if (!mc) continue;
    const nextQty = Math.max(0, targetQty);
    if (nextQty !== mc.quantity) {
      batchUpdates[cutId] = nextQty;
    }
  }

  if (Object.keys(batchUpdates).length > 0) {
    actions.unshift({
      type: 'BATCH_UPDATE_MEAT_QUANTITY',
      payload: { updates: batchUpdates },
    });
  }

  return actions;
}

