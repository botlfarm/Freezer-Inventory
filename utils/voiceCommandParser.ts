import { Action, Container, Freezer, InventoryState, MeatCut, Product, Tag } from '../types';

export type VoiceIntentType =
  | 'remove'
  | 'move'
  | 'add'
  | 'add_container'
  | 'empty_container'
  | 'move_all'
  | 'move_container'
  | 'combine_containers'
  | 'container_query'
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

export interface VoiceSelectionOverrides {
  productId?: string | null;
  sourceContainerId?: string | null;
  destContainerId?: string | null;
  meatCutId?: string | null;
  freezerId?: string | null;
  templateId?: string | null;
  customContainerName?: string;
  saveAsTemplate?: boolean;
  containerImageUrl?: string;
  containerIcon?: string;
  existingSpareContainerId?: string;
  combineSlotSelections?: Record<number, string>;
  quantity?: number;
  excluded?: boolean;
}

export interface ParsedVoiceClause {
  id: string;
  rawText: string;
  intent: VoiceIntentType;
  quantity: number;
  isAllQuantity?: boolean;
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

  // Flexible container-level operations (empty / move_all / move_container / combine_containers / container_query)
  containerCutPreviews?: VoiceContainerCutSummary[];
  combineSlots?: VoiceCombineSlot[];
  combineExplicitTarget?: boolean;
  combineTargetQuery?: string;
  containerQueryResults?: VoiceContainerQueryResult[];
  containerQueryMode?: 'contents' | 'location' | 'count';
  containerQueryTargetLabel?: string;

  // Strict-keyword new container creation fields
  newContainerGroupKey?: string;
  newContainerNameQuery?: string;
  newContainerFreezerQuery?: string;
  explicitTemplateRequested?: boolean;
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

  queryResults?: VoiceQueryProductResult[];
  queryLocationFilter?: string;

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

const ACTION_VERBS = [
  'remove', 'take', 'deduct', 'subtract', 'minus', 'sell', 'sold', 'pull', 'checkout', 'use', 'used', 'zero\\s+out',
  'move', 'transfer', 'relocate', 'shift',
  'empty', 'clear', 'unload', 'unpack', 'dump',
  'combine', 'merge', 'consolidate',
  'add', 'put', 'restock', 'plus', 'pack', 'receive', 'inbound',
  'create\\s+(?:a\\s+)?(?:new\\s+)?container', 'make\\s+(?:a\\s+)?(?:new\\s+)?container', 'new\\s+container',
];

const QUERY_TRIGGERS = [
  'how many', 'how much', 'do we have', 'do i have', 'have we got', 'are there', 'is there',
  'what(?:\'|\\s)?s\\s+in', 'what\\s+is\\s+in', 'what\\s+are\\s+in', 'what(?:\'|\\s)?s\\s+inside',
  'what\\s+containers?', 'which\\s+containers?',
  'check stock', 'check count', 'check', 'count', 'total', 'list', 'inspect',
  'where is', 'where are', "where's", 'wheres', 'where can i find', 'where can we find',
  'find me', 'find', 'locate', 'show me', 'search for', 'look up',
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
        const dist = editDistance(qCanon, tCanon);
        const maxLen = Math.max(qCanon.length, tCanon.length);
        if (dist <= 1 || (maxLen >= 6 && dist <= 2)) {
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
    const dist = editDistance(compactQuery, compactTarget);
    if (dist <= 2 && compactQuery.length >= 5) {
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
        /^(?:please|can\s+you|could\s+you|would\s+you|go\s+ahead\s+and|let'?s|i\s+need\s+to|i\s+want\s+to|i'?d\s+like\s+to|just)\s+/i,
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

/**
 * Split multi-item lists like "2 brats, 1 belly, 3 ground pork and 1 chicken broth"
 * without splitting product names containing "and" (e.g. "2 mac and cheese and 1 broth").
 */
function splitItemClauses(body: string): string[] {
  const commaParts = body
    .split(/\s*,\s*/)
    .map(p => p.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const part of commaParts) {
    // Split on " & " or " and " ONLY when followed by a quantity token
    const tokens = part.split(/\s+/);
    let current: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i].toLowerCase();
      if ((tok === 'and' || tok === '&') && i + 1 < tokens.length) {
        const remaining = tokens.slice(i + 1).join(' ');
        if (startsWithNumberToken(remaining) && current.length > 0) {
          result.push(current.join(' ').trim());
          current = [];
          continue;
        }
      }
      current.push(tokens[i]);
    }
    if (current.length > 0) {
      result.push(current.join(' ').trim());
    }
  }
  return result.filter(Boolean);
}

const HEADER_VERB_PATTERN =
  '(?:move|transfer|relocate|shift|remove|take|deduct|subtract|minus|sell|sold|pull|check\\s*out|checkout|use|used|add|put|restock|plus|pack|receive|inbound|(?:create|make)(?=\\s+(?:a\\s+)?(?:new\\s+)?container\\b)|new(?=\\s+container\\b))';

interface ParsedLineHeader {
  verbPrefix: string;
  locSuffix: string;
  intentType: 'remove' | 'move' | 'add' | 'add_container';
  foldItemsIntoSingleCommand?: boolean;
}

const STRICT_NEW_CONTAINER_START_REGEX =
  /^(?:please\s+)?(?:(?:add|create|make)\s+(?:a\s+)?(?:new\s+)?container|new\s+container)(?:\s+(?:from\s+)?template)?\s+(.+)$/i;

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

function parseHeaderPhrase(rawHeader: string): ParsedLineHeader | null {
  const cleaned = rawHeader
    .replace(/^(?:please\s+)?/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  // Strict new-container header (e.g. "Add container yellow bag in freezer canada:")
  if (STRICT_NEW_CONTAINER_START_REGEX.test(cleaned)) {
    const split = splitContainerWithItems(cleaned);
    if (!split.itemsPart) {
      return {
        verbPrefix: cleaned,
        locSuffix: '',
        intentType: 'add_container',
        foldItemsIntoSingleCommand: true,
      };
    }
    return null;
  }

  const verbMatch = cleaned.match(new RegExp(`^(${HEADER_VERB_PATTERN})(?:\\s+(.*))?$`, 'i'));
  if (!verbMatch) {
    const prepFirst = cleaned.match(
      /^(?:from|in|at)\s+(.+?)[,\s]+(remove|take|deduct|subtract|minus|sell|sold|pull|check\s*out|checkout|use|used)$/i
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

  const isMove = ['move', 'transfer', 'relocate', 'shift'].includes(lowerVerb);
  const isAdd = ['add', 'put', 'restock', 'plus', 'pack', 'receive', 'inbound'].includes(lowerVerb);
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
  if (STRICT_NEW_CONTAINER_START_REGEX.test(cleaned)) return true;
  const actionRegex = new RegExp(
    `^(?:${HEADER_VERB_PATTERN}|empty|clear|unload|unpack|dump|combine|merge|consolidate|zero\\s+out)\\b`,
    'i'
  );
  if (actionRegex.test(cleaned)) return true;
  const queryStartRegex =
    /^(?:how\s+many|how\s+much|what(?:'s|s|\s+is|\s+are)?\s+(?:(?:the\s+)?(?:count|stock)|inside|in|do\s+(?:we|i)|items)\b|count\b|check\b|total\b|list\b|inspect\b|do\s+(?:we|i|you)\s+have\b|have\s+(?:we|i)\s+got\b|are\s+there\b|is\s+there\b|where(?:'s|s|\s+is|\s+are|\s+can\s+(?:i|we)\s+find)\b|find\b|locate\b|show\s+(?:me|us)\b|search\s+for\b|look\s+up\b)/i;
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
  mode: 'source' | 'dest'
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
    if (!startsWithNumberToken(remaining)) continue;

    const locMatches = resolveOnSiteLocationCandidates(candidateLoc, state, mode);
    if (locMatches.length > 0) {
      const topScore = locMatches[0].score;
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
            (header.intentType === 'move' && /\bfrom\s+\S+/i.test(cleanRight) && /\b(?:to|into)\s+\S+/i.test(cleanRight));
          expandedLines.push(
            `${header.verbPrefix} ${cleanRight}${header.locSuffix && !hasOwnLoc ? ' ' + header.locSuffix : ''}`
          );
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
            noColonHeader.intentType === 'add' ? 'dest' : 'source'
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
          (/^[-*•·]+\s+/.test(nextNonEmpty!) || startsWithNumberToken(nextCleaned));

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
            (activeHeader.intentType === 'move' && /\bfrom\s+\S+/i.test(cleanItem) && /\b(?:to|into)\s+\S+/i.test(cleanItem));

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
    if (/^(?:combine|merge|consolidate)\b/i.test(cleanedPart)) {
      // Do not split "combine containers Orange and Clear Bin" on "and Clear"
      finalSegments.push(part);
      continue;
    }
    const subParts = part
      .split(andCommandSplitRegex)
      .map(s => s.trim())
      .filter(Boolean);
    finalSegments.push(...subParts);
  }
  return finalSegments;
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

    const matchingFreezers = freezers
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
      .filter((x): x is { f: Freezer; m: NonNullable<ReturnType<typeof scoreNameMatch>> } => x.m !== null);

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

      const contMatch = scoreNameWithAliases(
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
          label: `${target.container.name} (${target.freezerName})`,
        });
      }
    }

    if (candidates.length > 0) {
      return candidates.sort((a, b) => b.score - a.score);
    }
  }

  // 2. Special shortcut: "display" / "display case" / "store display"
  const isDisplayQuery =
    query === 'display' ||
    query === 'display case' ||
    query === 'display freezer' ||
    query === 'the display' ||
    query === 'front display';

  if (isDisplayQuery) {
    const displayFreezers = freezers.filter(
      f => f.isSpecial || normalizeText(f.name).includes('display')
    );
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
  const resultsByContainerId = new Map<string, VoiceLocationCandidate>();

  for (const target of allTargets) {
    const customContainerAliases = containerAliasesMap.get(target.container.id) || [];
    // Match container name or custom container alias
    if (!target.isLoose || customContainerAliases.length > 0) {
      const cMatch = !target.isLoose
        ? scoreNameWithAliases(query, target.container.name, customContainerAliases, { keepUnitTokens: true })
        : scoreNameWithAliases(query, '', customContainerAliases, { keepUnitTokens: true });
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

  const isDisplayQuery = variants.some(
    v => v === 'display' || v === 'display case' || v === 'display freezer' || v === 'front display'
  );

  for (const f of freezers) {
    if (isDisplayQuery && (f.isSpecial || normalizeText(f.name).includes('display'))) {
      matches.push({
        freezerId: f.id,
        freezerName: f.name,
        isDisplay: true,
        isStaging: false,
        score: 100,
        matchReason: 'exact',
        isExact: true,
      });
      continue;
    }

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
  explicitTemplateRequested = false
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
    icon: 'box',
    isCustom: true,
    score: 50,
    matchReason: 'exact',
    isExact: false,
  };

  const templates = state.containerTemplates || [];
  const matchedTemplates: VoiceContainerTemplateCandidate[] = [];

  for (const tpl of templates) {
    const m = scoreNameMatch(containerNameQuery, tpl.name);
    if (m && m.score >= 65) {
      matchedTemplates.push({
        templateId: tpl.id,
        name: tpl.name,
        icon: tpl.icon || 'box',
        imageUrl: tpl.imageUrl,
        isCustom: false,
        score: m.score,
        matchReason: m.reason,
        isExact: m.isExact,
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
  let quantity = override?.quantity !== undefined ? Math.max(1, override.quantity) : baseClause.quantity;
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
      if (!(mode === 'count' && freezerResolved) && !(explicitAllContainers && freezerResolved)) {
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
    const sourceLocationCandidates = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'source')
      : [];

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

    const containerCutPreviews = selectedSourceContainerId
      ? getContainerCutSummaries(selectedSourceContainerId, state)
      : [];

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
    } else if (selectedSourceContainerId && containerCutPreviews.length === 0) {
      const srcLabel =
        effectiveSourceCandidates.find(l => l.containerId === selectedSourceContainerId)?.label ||
        baseClause.sourceLocationQuery ||
        'container';
      errorMessage = `${srcLabel} is already empty.`;
    }

    const hasUnresolvedSelection =
      requiresSourceLocationSelection || requiresDestLocationSelection;

    const isValid =
      !errorMessage &&
      !hasUnresolvedSelection &&
      Boolean(selectedSourceContainerId) &&
      Boolean(selectedDestContainerId) &&
      containerCutPreviews.length > 0;

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
      isValid,
      errorMessage,
    };
  }

  // Handle MOVE CONTAINER (relocate whole container intact to another freezer or Staging Area)
  if (baseClause.intent === 'move_container') {
    const rawMatchedSources = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'source').filter(
          l => !l.isLoose
        )
      : [];

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

  // Handle QUERY intent
  if (baseClause.intent === 'query') {
    const locCandidates = baseClause.sourceLocationQuery
      ? resolveOnSiteLocationCandidates(baseClause.sourceLocationQuery, state, 'any')
      : [];
    const scopedContainerIds =
      locCandidates.length > 0 ? new Set(locCandidates.map(l => l.containerId)) : undefined;

    const prodMatches = resolveOnSiteProductCandidates(baseClause.productQuery, state);
    const containerMap = new Map((state.containers || []).filter(c => !c.isArchived).map(c => [c.id, c]));
    const freezerMap = new Map((state.freezers || []).map(f => [f.id, f]));
    const tagMap = new Map((state.tags || []).map(t => [t.id, t]));

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
      isValid: queryResults.length > 0,
      errorMessage:
        queryResults.length === 0
          ? `No on-site products matched "${baseClause.productQuery}".`
          : undefined,
    };
  }

  if (baseClause.intent === 'unknown') {
    return {
      ...baseClause,
      quantity,
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
      isValid: false,
      errorMessage: `Could not understand command: "${baseClause.rawText}". Try "remove 2 brats from display", "move 4 hotdogs from orange in canada to display", "add 3 ribeye to chest freezer", "add container yellow bag in freezer canada with 4 liverwurst", or "how many belly fresh do we have".`,
    };
  }

  // Handle STRICT NEW CONTAINER CREATION (empty container or items added into a new container)
  if (baseClause.newContainerGroupKey && baseClause.newContainerNameQuery) {
    const isEmptyContainerOnly = baseClause.intent === 'add_container';
    const hasFreezerQuery = Boolean(baseClause.newContainerFreezerQuery?.trim());
    const matchedFreezers = hasFreezerQuery
      ? resolveOnSiteFreezerCandidates(baseClause.newContainerFreezerQuery, state)
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
      selectedFreezerId = '__staging__';
      requiresFreezerSelection = false;
    } else if (matchedFreezers.length === 0) {
      selectedFreezerId = null;
      requiresFreezerSelection = true;
      freezerError = `No on-site freezer matched "${baseClause.newContainerFreezerQuery}".`;
    } else {
      const fPick = pickSingleOrRequireSelection(
        matchedFreezers,
        f => f.freezerId,
        override?.freezerId
      );
      selectedFreezerId = fPick.selectedId;
      requiresFreezerSelection = fPick.requiresSelection;
    }

    const templateResolution = resolveNewContainerTemplates(
      baseClause.newContainerNameQuery,
      state,
      Boolean(baseClause.explicitTemplateRequested)
    );
    let selectedTemplateId = templateResolution.selectedTemplateId;
    let requiresTemplateSelection = templateResolution.requiresSelection;
    if (
      override?.templateId &&
      templateResolution.candidates.some(t => t.templateId === override.templateId)
    ) {
      selectedTemplateId = override.templateId;
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
      formatSpokenContainerName(baseClause.newContainerNameQuery);

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
      override?.containerIcon || existingSpare?.icon || chosenTemplateObj?.icon || 'box';

    let productCandidates: VoiceProductMatch[] = [];
    let selectedProductId: string | null = null;
    let requiresProductSelection = false;
    let productError: string | undefined;

    if (!isEmptyContainerOnly) {
      productCandidates = resolveOnSiteProductCandidates(baseClause.productQuery, state);
      const prodPick = pickSingleOrRequireSelection(
        productCandidates,
        p => p.product.id,
        override?.productId
      );
      selectedProductId = prodPick.selectedId;
      requiresProductSelection = prodPick.requiresSelection;
      if (productCandidates.length === 0) {
        productError = `No on-site product matched "${baseClause.productQuery}".`;
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

  if (baseClause.intent === 'remove' || baseClause.intent === 'move') {
    if (baseClause.sourceLocationQuery) {
      sourceLocationCandidates = resolveOnSiteLocationCandidates(
        baseClause.sourceLocationQuery,
        state,
        'source'
      );
    } else {
      // No source location spoken: populate later from containers holding the matched product
      sourceLocationCandidates = [];
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
      const destPick = pickSingleOrRequireSelection(
        destLocationCandidates,
        l => l.containerId,
        override?.destContainerId
      );
      selectedDestContainerId = destPick.selectedId;
      requiresDestLocationSelection = destPick.requiresSelection;
    } else {
      // No destination specified: provide all active on-site loose/container options and require selection
      destLocationCandidates = (state.containers || [])
        .filter(c => !c.isArchived)
        .map(c => {
          const freezer = c.freezerId ? (state.freezers || []).find(f => f.id === c.freezerId) : undefined;
          const freezerName = freezer ? freezer.name : 'Staging Area';
          return {
            containerId: c.id,
            containerName: c.name,
            freezerId: freezer?.id,
            freezerName,
            isDisplay: Boolean(freezer?.isSpecial),
            isLoose: c.id === 'staging_loose' || c.id.endsWith('_loose'),
            isStaging: !c.freezerId,
            score: 50,
            matchReason: 'fuzzy' as MatchReason,
            isExact: false,
            label: c.id.endsWith('_loose') ? `${freezerName} (Loose)` : `${c.name} (${freezerName})`,
          };
        });
      const destPick = pickSingleOrRequireSelection(
        destLocationCandidates,
        l => l.containerId,
        override?.destContainerId
      );
      selectedDestContainerId = destPick.selectedId;
      requiresDestLocationSelection = destLocationCandidates.length > 1 && !selectedDestContainerId;
    }
  }

  // 2. Resolve Product Candidates (scoped to source containers if remove/move has source location)
  const scopedSourceIds =
    sourceLocationCandidates.length > 0
      ? new Set(sourceLocationCandidates.map(l => l.containerId))
      : undefined;

  const productCandidates = resolveOnSiteProductCandidates(
    baseClause.productQuery,
    state,
    baseClause.intent === 'remove' || baseClause.intent === 'move' ? scopedSourceIds : undefined
  );

  const prodPick = pickSingleOrRequireSelection(
    productCandidates,
    p => p.product.id,
    override?.productId
  );
  const selectedProductId = prodPick.selectedId;
  const requiresProductSelection = prodPick.requiresSelection;

  // 3. Narrow / resolve source locations & MeatCuts for REMOVE and MOVE
  let cutCandidates: VoiceCutCandidate[] = [];
  let selectedMeatCutId: string | null = null;
  let requiresCutSelection = false;

  if (baseClause.intent === 'remove' || baseClause.intent === 'move') {
    // Filter sourceLocationCandidates to containers that actually hold the selected product (when product is known)
    if (selectedProductId && sourceLocationCandidates.length > 0) {
      const cutsInMatchedLocs = resolveCutCandidates(
        selectedProductId,
        sourceLocationCandidates.map(l => l.containerId),
        state
      );
      if (cutsInMatchedLocs.length > 0) {
        const containerIdsWithStock = new Set(cutsInMatchedLocs.map(c => c.container.id));
        const filteredLocs = sourceLocationCandidates.filter(l => containerIdsWithStock.has(l.containerId));
        if (filteredLocs.length > 0) {
          sourceLocationCandidates = filteredLocs;
        }
      }
    } else if (selectedProductId && !baseClause.sourceLocationQuery) {
      // No source location was spoken, discover all on-site containers holding this product
      const allCutsForProd = resolveCutCandidates(selectedProductId, [], state);
      const freezerMap = new Map((state.freezers || []).map(f => [f.id, f]));
      const seenContainers = new Set<string>();
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
        });
      }
    }

    const srcPick = pickSingleOrRequireSelection(
      sourceLocationCandidates,
      l => l.containerId,
      override?.sourceContainerId
    );
    selectedSourceContainerId = srcPick.selectedId;
    requiresSourceLocationSelection = srcPick.requiresSelection;

    // Resolve concrete MeatCut stack(s)
    const targetContainerIdsForCut = selectedSourceContainerId
      ? [selectedSourceContainerId]
      : sourceLocationCandidates.map(l => l.containerId);

    if (selectedProductId) {
      cutCandidates = resolveCutCandidates(selectedProductId, targetContainerIdsForCut, state);
      if (override?.meatCutId && cutCandidates.some(c => c.meatCut.id === override.meatCutId)) {
        selectedMeatCutId = override.meatCutId;
        requiresCutSelection = false;
      } else if (cutCandidates.length === 1) {
        selectedMeatCutId = cutCandidates[0].meatCut.id;
        requiresCutSelection = false;
      } else if (cutCandidates.length > 1) {
        // Multiple stacks/variants (e.g., different notes or tags, or multiple containers) -> require selection!
        selectedMeatCutId = null;
        requiresCutSelection = true;
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

  // 5. Validate Readiness & Errors/Warnings
  let errorMessage: string | undefined;
  let warningMessage: string | undefined;

  if (productCandidates.length === 0) {
    errorMessage = `No on-site product matched "${baseClause.productQuery}".`;
  } else if ((baseClause.intent === 'remove' || baseClause.intent === 'move') && baseClause.sourceLocationQuery && sourceLocationCandidates.length === 0) {
    errorMessage = `No on-site location matched "${baseClause.sourceLocationQuery}".`;
  } else if ((baseClause.intent === 'move' || baseClause.intent === 'add') && baseClause.destLocationQuery && destLocationCandidates.length === 0) {
    errorMessage = `No on-site destination matched "${baseClause.destLocationQuery}".`;
  } else if ((baseClause.intent === 'remove' || baseClause.intent === 'move') && selectedProductId && cutCandidates.length === 0) {
    const locLabel = selectedSourceContainerId
      ? sourceLocationCandidates.find(l => l.containerId === selectedSourceContainerId)?.label || 'selected location'
      : baseClause.sourceLocationQuery || 'on-site storage';
    errorMessage = `No stock available in ${locLabel}.`;
  } else if ((baseClause.intent === 'remove' || baseClause.intent === 'move') && selectedMeatCutId) {
    const chosenCut = cutCandidates.find(c => c.meatCut.id === selectedMeatCutId);
    if (chosenCut && quantity > chosenCut.meatCut.quantity) {
      warningMessage = `Requested ${quantity}, but only ${chosenCut.meatCut.quantity} in stock at ${chosenCut.locationLabel}.`;
      errorMessage = `Insufficient stock (available: ${chosenCut.meatCut.quantity}). Adjust quantity to ${chosenCut.meatCut.quantity} or less.`;
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
      : baseClause.intent === 'remove'
      ? Boolean(selectedMeatCutId)
      : Boolean(selectedMeatCutId) && Boolean(selectedDestContainerId));

  return {
    ...baseClause,
    quantity,
    excluded,
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
    isValid,
    errorMessage,
    warningMessage,
  };
}

function cleanQueryProductPhrase(raw: string): string {
  return raw
    .replace(/[?!.]+$/g, '')
    .replace(/\b(?:do\s+(?:we|i|you)\s+have|have\s+(?:we|i)\s+got|are\s+there|is\s+there|in\s+stock|on\s+site|on-site|located|stored|kept|available|remaining|left|right\s+now|currently|please)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:me|us|the|my|our|any|some|is|are)\s+/i, '')
    .replace(/\s+(?:is|are|have|has|located|at)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
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

  // 0a. Check general ALL-CONTAINERS LIST / COUNT in an optional freezer:
  //     "what containers are in freezer 1", "how many containers are in freezer 1", "list all containers", "show containers in canada"
  const allContainersMatch = segment.match(
    /^(?:how\s+many|count(?:\s+the)?|what|which|list(?:\s+all)?|show(?:\s+(?:me|us))?(?:\s+all)?)\s+containers(?:\s+(?:are|do\s+(?:we|i|you)\s+have|on\s*site|stored))?(?:\s+(?:in|inside|at)\s+(.+))?\s*[?!.]*$/i
  );
  if (allContainersMatch) {
    const isCount = /^(?:how\s+many|count)/i.test(segment);
    const freezerFilter = allContainersMatch[1]
      ? cleanLocationFragment(allContainersMatch[1])
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
          productQuery: '__all_containers__',
          sourceLocationQuery: '',
          queryLocationFilter: freezerFilter || undefined,
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 0b. Check CONTAINER CONTENTS QUERY:
  //     "what's in container orange in canada", "what is inside display", "list blue tote", "inspect orange in canada", "show container orange"
  const whatsInMatch = segment.match(
    /^(?:what(?:'s|s|\s+is|\s+are)?\s+(?:inside|in)|what\s+(?:do\s+(?:we|i)\s+have|items?\s+(?:are|do\s+we\s+have)|is\s+stored|is\s+left)\s+(?:inside|in)|list\s+(?:the\s+)?(?:contents\s+of\s+|items\s+in\s+)?|inspect\s+(?:the\s+)?)(.+)$/i
  );
  const explicitContainerInspectMatch = !whatsInMatch
    ? segment.match(
        /^(?:show(?:\s+(?:me|us))?|check)\s+(?:the\s+)?(?:(?:contents|items)\s+(?:of|in)\s+(?:the\s+)?(?:container\s+)?(.+)|(?:the\s+)?container\s+(.+)|(.+))$/i
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
  //    - Product query: "how many pork liver do I have?", "where are pork liver", "how many brats are in display?"
  //    - Container location lookup: "where is red bag", "where's orange in canada", "locate container blue tote"
  //    - Container count query: "how many green bags are in freezer 1", "how many green bags"
  const queryRegex = /^(?:how\s+many|how\s+much|what(?:'s|\s+is)\s+(?:the\s+)?(?:count|stock)(?:\s+of)?|count(?:\s+of)?|check(?:\s+(?:stock|count)(?:\s+of)?)?|total(?:\s+of)?|do\s+(?:we|i|you)\s+have(?:\s+any)?|have\s+(?:we|i)\s+got(?:\s+any)?|are\s+there(?:\s+any)?|is\s+there(?:\s+any)?|where(?:'s|s|\s+is|\s+are|\s+can\s+(?:i|we)\s+find)|find(?:\s+(?:me|us))?|locate(?:\s+(?:me|us))?|show(?:\s+(?:me|us))?|search(?:\s+for)?|look\s+up)\s+(.+)$/i;
  const queryMatch = segment.match(queryRegex);
  if (queryMatch) {
    const prefixLower = segment
      .slice(0, segment.length - queryMatch[1].length)
      .trim()
      .toLowerCase();
    const isWhereOrLocate = /^(?:where|locate|find)/i.test(prefixLower);
    const isCountPhrase = /^(?:how\s+many|count|total|are\s+there|is\s+there|do\s+(?:we|i|you)\s+have|have\s+(?:we|i)\s+got)/i.test(
      prefixLower
    );

    const body = cleanQueryProductPhrase(queryMatch[1]);
    let productQuery = body;
    let locationQuery: string | undefined;

    // Optional location filter inside query: "brats in display" / "pork liver are in display" / "green bags are in freezer 1"
    const locInQuery = body.match(/^(.+?)\s+(?:in|inside|at|from)\s+(.+)$/i);
    let matchedFreezersInLoc: VoiceFreezerCandidate[] = [];
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
      /\b(?:bag|bags|tote|totes|bin|bins|box|boxes|bucket|buckets|crate|crates|tray|trays)\b/i.test(
        contSubjectCleaned
      );

    // Check product candidates vs non-loose container candidates to pick the best target type
    const prodCandidates = resolveOnSiteProductCandidates(subjectRaw, state);
    const topProdScore = prodCandidates[0]?.score ?? 0;

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
      (rawContCandidates.length > 0 && (prodCandidates.length === 0 || topContScore > topProdScore)) ||
      (isCountPhrase &&
        Boolean(locationQuery) &&
        matchedFreezersInLoc.length > 0 &&
        prodCandidates.length === 0 &&
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

  // 2. Check EMPTY CONTAINER intent:
  //    "empty container orange in canada", "empty out orange", "clear out blue tote", "unload orange in canada to display"
  const emptyMatch = segment.match(
    /^(?:empty(?:\s+out)?|clear(?:\s+out)?|unload|unpack|dump)\s+(.+)$/i
  );
  if (emptyMatch) {
    let rawBody = cleanLocationFragment(emptyMatch[1]);
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
        },
        state,
        overrides[id]
      ),
    ];
  }

  // 3. Check COMBINE / MERGE / CONSOLIDATE CONTAINERS intent:
  //    "combine containers x and y", "combine x and y into z", "merge container x into container y", "consolidate x and y"
  const combineMatch = segment.match(
    /^(?:combine|merge|consolidate)(?:\s+(?:the\s+)?containers?)?\s+(.+)$/i
  );
  if (combineMatch) {
    const rawBody = cleanLocationFragment(combineMatch[1]);
    let combineExplicitTarget = false;
    let combineTargetQuery: string | undefined;
    let slotQueries: string[] = [];

    // Check trailing "into <target>" or "to <target>"
    const intoMatch = rawBody.match(/^(.+?)\s+\b(?:into|to)\s+(.+)$/i);
    if (intoMatch) {
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
  const moveVerbMatch = segment.match(/^(?:move|transfer|relocate|shift|put|bring)\s+(.+)$/i);
  if (moveVerbMatch) {
    const moveBody = moveVerbMatch[1].trim();
    const isPutOrBring = /^(?:put|bring)\b/i.test(segment);

    // 4a. MOVE ALL CONTENTS of container/location Y to Z:
    //     - "move all [of] [the] container Y to Z"
    //     - "move all [the] (items|contents|stock|everything) (in|inside|from|out of|of) [container] Y to Z"
    //     - "move everything (in|inside|from|out of|of) [container] Y to Z"
    //     - "move all (in|inside|from|out of) [container] Y to Z"
    //     - "move all of Y to Z" (when no "from" product filter)
    const moveAllExplicit = moveBody.match(
      /^(?:all\s+(?:of\s+)?(?:the\s+)?(?:items|contents|stock|everything)\s+(?:in|inside|from|out\s+of|of)|everything\s+(?:in|inside|from|out\s+of|of)|all\s+(?:of\s+)?(?:the\s+)?container|all\s+(?:in|inside|from|out\s+of)|the\s+contents\s+of|contents\s+of)\s+(.+)$/i
    );
    const moveAllOfMatch =
      !moveAllExplicit && !/\s+\bfrom\s+/i.test(moveBody)
        ? moveBody.match(/^all\s+of\s+(.+)$/i)
        : null;

    if (!isPutOrBring && (moveAllExplicit || moveAllOfMatch)) {
      const rest = cleanLocationFragment((moveAllExplicit || moveAllOfMatch)![1]);
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
          },
          state,
          overrides[id]
        ),
      ];
    }

    // 4b. MOVE WHOLE CONTAINER X to Freezer/Staging Z ("move container orange in canada to chest freezer"):
    const explicitWholeCont = moveBody.match(/^(?:the\s+)?container\s+(.+)$/i);
    if (explicitWholeCont) {
      const rest = cleanLocationFragment(explicitWholeCont[1]);
      let srcContQuery = rest;
      let destQuery: string | undefined;

      const toDest = rest.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
      if (toDest) {
        srcContQuery = cleanLocationFragment(toDest[1]);
        destQuery = cleanLocationFragment(toDest[2]);
      } else if (isPutOrBring) {
        // Handle "put container yellow bag in chest freezer"
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

  // 5. Check standard ITEM MOVE intent: "move/transfer/relocate <items> from <src> to <dest>"
  const moveRegex = /^(?:move|transfer|relocate|shift)\s+(.+)$/i;
  const moveMatch = segment.match(moveRegex);
  if (moveMatch) {
    let body = moveMatch[1].trim();
    let sharedSourceLoc: string | undefined;
    let sharedDestLoc: string | undefined;

    // Extract "from <src> to <dest>" or "to <dest> from <src>" at the tail
    const fromToMatch = body.match(/^(.+?)\s+\bfrom\s+(.+?)\s+\b(?:to|into)\s+(.+)$/i);
    const toFromMatch = body.match(/^(.+?)\s+\b(?:to|into)\s+(.+?)\s+\bfrom\s+(.+)$/i);
    const onlyToMatch = body.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
    const onlyFromMatch = body.match(/^(.+?)\s+\bfrom\s+(.+)$/i);

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
    } else if (onlyFromMatch) {
      body = onlyFromMatch[1].trim();
      sharedSourceLoc = onlyFromMatch[2].trim();
    }

    const subItems = splitItemClauses(body);
    return subItems.map((sub, subIdx) => {
      let itemText = sub;
      let localSrc = sharedSourceLoc;
      let localDest = sharedDestLoc;

      const subFromTo = itemText.match(/^(.+?)\s+\bfrom\s+(.+?)\s+\b(?:to|into)\s+(.+)$/i);
      if (subFromTo) {
        itemText = subFromTo[1].trim();
        localSrc = subFromTo[2].trim();
        localDest = subFromTo[3].trim();
      } else {
        const subFrom = itemText.match(/^(.+?)\s+\bfrom\s+(.+)$/i);
        if (subFrom) {
          itemText = subFrom[1].trim();
          localSrc = subFrom[2].trim();
        }
      }

      const qtyExtracted = extractLeadingQuantity(itemText, { allowToAsTwo: true, defaultQty: 1 });
      const id = `clause-${segIndex}-${subIdx}`;
      return evaluateParsedClause(
        {
          id,
          rawText: sub,
          intent: 'move',
          quantity: qtyExtracted.quantity,
          isAllQuantity: qtyExtracted.isAllQuantity,
          productQuery: qtyExtracted.rest || itemText,
          sourceLocationQuery: localSrc,
          destLocationQuery: localDest,
        },
        state,
        overrides[id]
      );
    });
  }

  // 6. Check REMOVE intent: "remove/take/deduct/sell/sold/pull/zero out <items> [from <src>]"
  const zeroOutMatch = segment.match(/^zero\s+out\s+(.+)$/i);
  const removeRegex = /^(?:remove|take|deduct|subtract|minus|sell|sold|pull|check\s*out|checkout|use|used)\s+(.+)$/i;
  const removeMatch = zeroOutMatch ? null : segment.match(removeRegex);
  if (zeroOutMatch || removeMatch) {
    let body = (zeroOutMatch ? zeroOutMatch[1] : removeMatch![1]).trim();
    const forceAllQuantity = Boolean(zeroOutMatch);
    let sharedSourceLoc: string | undefined;

    // Extract trailing "from <location>" (or "in/at <location>" if it matches an on-site location)
    // or leading "from <location> <items>" (e.g. "remove from display 2 brats, 1 belly")
    const fromLocMatch = body.match(/^(.+?)\s+\bfrom\s+(.+)$/i);
    if (fromLocMatch) {
      body = fromLocMatch[1].trim();
      sharedSourceLoc = fromLocMatch[2].trim();
    } else {
      const leadingLoc = tryExtractLeadingLocation(body, ['from', 'in', 'at'], state, 'source');
      if (leadingLoc) {
        sharedSourceLoc = leadingLoc.locQuery;
        body = leadingLoc.remainingBody;
      } else {
        const inAtMatch = body.match(/^(.+?)\s+\b(?:in|at)\s+(.+)$/i);
        if (inAtMatch && resolveOnSiteLocationCandidates(inAtMatch[2].trim(), state, 'source').length > 0) {
          body = inAtMatch[1].trim();
          sharedSourceLoc = inAtMatch[2].trim();
        }
      }
    }

    const subItems = splitItemClauses(body);
    return subItems.map((sub, subIdx) => {
      let itemText = sub;
      let localSrc = sharedSourceLoc;

      const subFrom = itemText.match(/^(.+?)\s+\bfrom\s+(.+)$/i);
      if (subFrom) {
        itemText = subFrom[1].trim();
        localSrc = subFrom[2].trim();
      }

      const qtyExtracted = extractLeadingQuantity(itemText, { allowToAsTwo: true, defaultQty: 1 });
      const id = `clause-${segIndex}-${subIdx}`;
      return evaluateParsedClause(
        {
          id,
          rawText: sub,
          intent: 'remove',
          quantity: qtyExtracted.quantity,
          isAllQuantity: forceAllQuantity || qtyExtracted.isAllQuantity,
          productQuery: qtyExtracted.rest || itemText,
          sourceLocationQuery: localSrc,
        },
        state,
        overrides[id]
      );
    });
  }

  // Check STRICT NEW CONTAINER CREATION (container-first or items-first "to/into new container ...")
  const containerFirstMatch = segment.match(
    /^(?:please\s+)?(?:(?:add|create|make)\s+(?:a\s+)?(?:new\s+)?container|new\s+container)(?:\s+(from\s+template|template))?\s+(.+)$/i
  );
  const itemsFirstNewContainerMatch = !containerFirstMatch
    ? segment.match(
        /^(?:please\s+)?(?:add|put|restock|plus|pack|receive|inbound)\s+(.+?)\s+\b(?:to|into|in)\s+(?:a\s+)?new\s+container(?:\s+(from\s+template|template))?\s+(.+)$/i
      )
    : null;

  if (containerFirstMatch || itemsFirstNewContainerMatch) {
    let explicitTemplateRequested = false;
    let containerAndFreezer = '';
    let itemsPart: string | undefined;

    if (containerFirstMatch) {
      explicitTemplateRequested = Boolean(containerFirstMatch[1]);
      const rawBody = containerFirstMatch[2].trim();
      const split = splitContainerWithItems(rawBody);
      containerAndFreezer = split.left;
      itemsPart = split.itemsPart;
    } else if (itemsFirstNewContainerMatch) {
      itemsPart = itemsFirstNewContainerMatch[1].trim();
      explicitTemplateRequested = Boolean(itemsFirstNewContainerMatch[2]);
      containerAndFreezer = itemsFirstNewContainerMatch[3].trim();
    }

    let containerNameQuery = containerAndFreezer.trim();
    let freezerQuery: string | undefined;

    const freezerInContainerMatch = containerNameQuery.match(
      /^(.+)\s+\b(?:in|into|to|inside|at)\s+(.+)$/i
    );
    if (freezerInContainerMatch) {
      containerNameQuery = freezerInContainerMatch[1].trim();
      freezerQuery = freezerInContainerMatch[2].trim();
    } else if (itemsPart) {
      // Allow trailing "in <freezer>" after items when none was placed after container name,
      // e.g. "add container yellow bag with 4 liverwurst in freezer canada"
      const trailingFreezerMatch = itemsPart.match(/^(.+?)\s+\b(?:in|into|to|inside|at)\s+(.+)$/i);
      if (trailingFreezerMatch) {
        const candFreezer = trailingFreezerMatch[2].trim();
        if (resolveOnSiteFreezerCandidates(candFreezer, state).length > 0) {
          itemsPart = trailingFreezerMatch[1].trim();
          freezerQuery = candFreezer;
        }
      }
    }

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
            explicitTemplateRequested,
          },
          state,
          overrides[id]
        ),
      ];
    }

    const subItems = splitItemClauses(itemsPart);
    return subItems.map((sub, subIdx) => {
      const qtyExtracted = extractLeadingQuantity(sub, { allowToAsTwo: true, defaultQty: 1 });
      const id = `clause-${segIndex}-${subIdx}`;
      return evaluateParsedClause(
        {
          id,
          rawText: sub,
          intent: 'add',
          quantity: qtyExtracted.quantity,
          productQuery: qtyExtracted.rest || sub,
          newContainerGroupKey: groupKey,
          newContainerNameQuery: containerNameQuery,
          newContainerFreezerQuery: freezerQuery,
          explicitTemplateRequested,
        },
        state,
        overrides[id]
      );
    });
  }

  // Check ADD intent: "add/put/restock/plus/pack/receive/inbound <items> [to/into/in <dest>]"
  const addRegex = /^(?:please\s+)?(?:add|put|restock|plus|pack|receive|inbound)\s+(.+)$/i;
  const addMatch = segment.match(addRegex);
  if (addMatch) {
    let body = addMatch[1].trim();
    let sharedDestLoc: string | undefined;

    const toLocMatch = body.match(/^(.+?)\s+\b(?:to|into|in|at)\s+(.+)$/i);
    if (toLocMatch) {
      const candidateDest = toLocMatch[2].trim();
      // Ensure "to" isn't part of a trailing item name unless it matches a location or starts with to/into
      if (/\s+(?:to|into)\s+/i.test(body) || resolveOnSiteLocationCandidates(candidateDest, state, 'dest').length > 0) {
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
    return subItems.map((sub, subIdx) => {
      let itemText = sub;
      let localDest = sharedDestLoc;

      const subTo = itemText.match(/^(.+?)\s+\b(?:to|into)\s+(.+)$/i);
      if (subTo) {
        itemText = subTo[1].trim();
        localDest = subTo[2].trim();
      }

      const qtyExtracted = extractLeadingQuantity(itemText, { allowToAsTwo: true, defaultQty: 1 });
      const id = `clause-${segIndex}-${subIdx}`;
      return evaluateParsedClause(
        {
          id,
          rawText: sub,
          intent: 'add',
          quantity: qtyExtracted.quantity,
          productQuery: qtyExtracted.rest || itemText,
          destLocationQuery: localDest,
        },
        state,
        overrides[id]
      );
    });
  }

  // Fallback: If someone just typed/spoke a product name (e.g. "belly fresh") treat as unknown or query?
  // Let's keep explicit unknown unless it looks like a short product lookup
  if (lower.length > 0) {
    const id = `clause-${segIndex}-0`;
    return [
      evaluateParsedClause(
        {
          id,
          rawText: segment,
          intent: 'unknown',
          quantity: 1,
          productQuery: segment,
        },
        state,
        overrides[id]
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
        c.intent === 'add_container' ||
        c.intent === 'empty_container' ||
        c.intent === 'move_all' ||
        c.intent === 'move_container' ||
        c.intent === 'combine_containers')
  );
  const queries = clauses.filter(
    c => !c.excluded && (c.intent === 'query' || c.intent === 'container_query')
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
      const cuts = (state.meatCuts || []).filter(
        mc => mc.containerId === clause.selectedSourceContainerId && mc.quantity > 0
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

  const batchUpdates: Record<string, number> = {};
  for (const [cutId, delta] of Object.entries(removeDeltas)) {
    const mc = (state.meatCuts || []).find(m => m.id === cutId);
    if (!mc) continue;
    const nextQty = Math.max(0, mc.quantity - delta);
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

