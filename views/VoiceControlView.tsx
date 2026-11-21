import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Check,
  AlertTriangle,
  ArrowRight,
  Trash2,
  Plus,
  Minus,
  Search,
  RotateCcw,
  Sparkles,
  Package,
  MapPin,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  SlidersHorizontal,
  Image as ImageIcon,
  Tag as TagIcon,
  List as ListIcon,
  ArrowLeftRight,
  Archive,
  Edit2,
  Bell,
  BellOff,
  Layers,
} from 'lucide-react';
import { Action, InventoryState } from '../types';
import AddForms, { ContainerDraftValues } from '../components/AddForms';
import {
  parseVoiceTranscript,
  buildVoiceDispatchActions,
  ParsedVoiceClause,
  VoiceSelectionOverrides,
} from '../utils/voiceCommandParser';
// [TEMP] Temporary failed-prompt recorder (remove import & component tag when voice model is built out)
import { TempVoicePromptRecorder } from '../components/TempVoicePromptRecorder';

interface VoiceControlViewProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  onNavigateToProduct: (productId: string) => void;
  onNavigateToFreezer: (containerId: string) => void;
  onNavigateToFreezerUnit?: (freezerId: string) => void;
  onNavigateToDisplayCase?: (productId?: string) => void;
  onNavigateToProductsView?: () => void;
  onNavigateToCategory?: (
    categoryName: string,
    categoryType: 'primary' | 'sub',
    primaryCategory?: string
  ) => void;
  onNavigateToTag?: (tagId: string) => void;
  onNavigateToList?: (listId?: string) => void;
  onNavigateToHistory?: () => void;
  onTriggerUndo?: () => void;
  onOpenVoiceDictionary?: () => void;
}

interface AppliedSummaryItem {
  text: string;
  productId?: string;
  containerId?: string;
  freezerId?: string;
  listId?: string;
  tagId?: string;
  isDisplay?: boolean;
  isContainerOp?: boolean;
  isUndo?: boolean;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SamplePhraseItem {
  label: string;
  command: string;
}

interface SamplePhraseSection {
  id: string;
  title: string;
  description: string;
  badgeClass: string;
  headingClass: string;
  items: SamplePhraseItem[];
}

const SAMPLE_PHRASE_SECTIONS: SamplePhraseSection[] = [
  {
    id: 'remove',
    title: 'Removing & Selling Items',
    description: 'Deduct sold/used stock, zero out items, or dictate multi-line lists.',
    badgeClass: 'bg-red-950/60 text-red-300 border-red-500/35',
    headingClass: 'text-red-300',
    items: [
      { label: 'Single item deduct', command: 'remove 2 brats from display' },
      { label: 'Natural sell / grab verb', command: 'grabbed two brats from display' },
      { label: 'Empty category from Display', command: 'Empty Broths from display' },
      { label: 'Multi-item sale list', command: 'remove 2 brats, 1 belly, 3 ground pork and 1 chicken broth from display' },
      { label: 'Dictated list (no commas)', command: 'remove two brats one belly and one chicken broth from display' },
      { label: 'Remove all / sold out', command: 'sold out of brats in display' },
      { label: 'Remove from any special freezer', command: 'remove 2 brats from all displays' },
      { label: 'Zero out item in location', command: 'zero out ground pork from display' },
      { label: 'Multi-line bullet list', command: 'Remove from display:\n- 3 belly bacon\n- 2 pork liver' },
    ],
  },
  {
    id: 'move',
    title: 'Moving Items',
    description: 'Transfer specific quantities or remaining stock between on-site locations.',
    badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-500/35',
    headingClass: 'text-amber-300',
    items: [
      { label: 'Container in freezer to Display', command: 'Move 4 hotdogs from orange in canada to display' },
      { label: 'Move all of one item', command: 'move all hotdogs from orange in canada to display' },
      { label: 'Move from Display Loose shelf', command: 'move all hotdogs in display loose to orange in canada' },
      { label: 'Move to Staging Area', command: 'move 3 pork belly from chest freezer to staging' },
      { label: 'Same-line location header', command: 'Move to display: 2 hotdogs from orange in canada, 3 ribs from chest freezer' },
    ],
  },
  {
    id: 'add_create',
    title: 'Adding Items & New Containers',
    description: 'Restock existing bins or create new containers (box, bag, bin, tote, crate, tray, cooler, etc.) with items.',
    badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/35',
    headingClass: 'text-emerald-300',
    items: [
      { label: 'Restock existing location', command: 'add 5 pork chops to display' },
      { label: 'New box in freezer', command: 'create new box yellow in freezer canada with 4 brats' },
      { label: 'New bag in Staging', command: 'make new bag green with 6 hotdogs' },
      { label: 'New pillowcase in freezer', command: 'create new pillowcase blue in freezer canada with 4 brats' },
      { label: 'Add to bag & place in freezer', command: 'add 4 chicken broth to red bag and put it in chest freezer' },
      { label: 'New container + items', command: 'add container yellow bag in freezer canada with 4 liverwurst' },
      { label: 'New container from template', command: 'add container from template yellow bag in chest freezer with 3 ribeye' },
      { label: 'Inbound into new container', command: 'inbound 4 ribeye, 2 brisket into new red tote in canada' },
      { label: 'Multi-line new container', command: 'Create new bin blue in chest freezer:\n- 4 ribeye\n- 2 ground beef' },
      { label: 'Shorthand labels (w/, w/o, &)', command: 'add 2 boneless chicken breast to red tote with lid' },
    ],
  },
  {
    id: 'adjust',
    title: 'Bulk & Direct Inventory Changes',
    description: 'Set exact counts to a target number (including 0) or adjust up/down by a delta.',
    badgeClass: 'bg-sky-950/60 text-sky-300 border-sky-500/35',
    headingClass: 'text-sky-300',
    items: [
      { label: 'Adjust quantity to target', command: 'adjust quantity of brats in display to two' },
      { label: 'Reduce inventory to target', command: 'reduce inventory of hot dogs in box green to three' },
      { label: 'Reduce inventory by delta', command: 'reduce inventory of hot dogs in box green by three' },
      { label: 'Increase stock by delta', command: 'increase stock of brats in display by four' },
      { label: 'Set item count to zero', command: 'set pork liver in display to zero' },
      { label: 'Physical count statement', command: 'there are 4 brats left in display' },
      { label: 'Bulk list (same location)', command: 'adjust inventory of brats to 2 and hotdogs to 3 in display' },
      { label: 'Bulk list (multi-location)', command: 'reduce inventory of hot dogs in box green to 3, brats in display to 2' },
      { label: 'Multi-line bulk change', command: 'Adjust inventory in display:\n- brats to 2\n- hotdogs to 3\n- pork liver to zero' },
    ],
  },
  {
    id: 'containers',
    title: 'Container Moves, Lifecycle & Exclusions',
    description: 'Empty, move, swap, rename, archive, delete, or merge containers (with optional exclusions).',
    badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-500/35',
    headingClass: 'text-purple-300',
    items: [
      { label: 'Empty container to Staging', command: 'empty container orange in canada' },
      { label: 'Empty except specific items', command: 'empty container orange in canada except beef hot dogs' },
      { label: 'Unload container to Display', command: 'unload orange in canada to display' },
      { label: 'Move all contents (with exclusion)', command: 'move all of container orange in canada to blue tote excluding pork belly' },
      { label: 'Move whole container to freezer', command: 'move container blue tote to chest freezer' },
      { label: 'Unplace / stage container', command: 'stage blue tote' },
      { label: 'Swap two containers', command: 'swap orange in canada and orange in chest freezer' },
      { label: 'Rename a container', command: 'rename blue tote in canada to snack tote' },
      { label: 'Archive or restore container', command: 'archive orange in canada' },
      { label: 'Delete container (moves items to Staging)', command: 'delete container orange in canada' },
      { label: 'Combine (pick survivor)', command: 'combine containers orange in canada and blue tote' },
      { label: 'Merge directionally into target', command: 'merge orange in canada into blue tote' },
    ],
  },
  {
    id: 'restock_alerts',
    title: 'Guided Display Restock & Stock Alerts',
    description: 'Pull backstock into Display automatically or spot low and out-of-stock items.',
    badgeClass: 'bg-teal-950/60 text-teal-300 border-teal-500/35',
    headingClass: 'text-teal-300',
    items: [
      { label: 'Restock display from backstock', command: 'top off display with 4 hotdogs' },
      { label: 'Pull backstock to display', command: 'pull 3 pork belly from backstock to display' },
      { label: 'Out of stock in Display', command: "what's out of stock in display?" },
      { label: 'Low stock in Display', command: "what's low stock in display?" },
      { label: 'What to restock + check list', command: 'What do I need to restock? Check a list' },
      { label: 'Low stock under count', command: "what's under 4 in display?" },
      { label: 'Completely out of stock globally', command: 'what are we completely out of?' },
    ],
  },
  {
    id: 'custom_lists',
    title: 'Custom Lists & Item Thresholds',
    description: 'Manage custom restock or packing lists, low-stock thresholds, and item alerts.',
    badgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/35',
    headingClass: 'text-indigo-300',
    items: [
      { label: 'Add items to list', command: 'add ribeye and chicken broth to restock list' },
      { label: 'Add item with threshold', command: 'add hotdogs to restock list with threshold 6' },
      { label: 'Remove item from list', command: 'remove pork belly from restock list' },
      { label: 'Set list item threshold', command: 'set threshold for brats on restock list to 5' },
      { label: 'Alert when drops below count', command: 'alert me when brats drops below 4 on restock list' },
      { label: 'Turn off / on item alert', command: 'turn off alerts for brats on restock list' },
      { label: 'Check what is on a list', command: "what's on my restock list?" },
      { label: 'Check if product is listed', command: 'is ribeye on the restock list?' },
    ],
  },
  {
    id: 'tags_labels',
    title: 'Tags, Wrong-Label Fixes & Undo',
    description: 'Tag inventory stacks, fix mislabeled packages, or undo your last change.',
    badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-500/35',
    headingClass: 'text-amber-300',
    items: [
      { label: 'Tag an inventory stack', command: 'tag pork belly in display as vacuum sealed' },
      { label: 'Remove a tag', command: 'untag pork belly in display from vacuum sealed' },
      { label: 'Correct a wrong label directly', command: 'correct label on ground pork in display to chicken broth' },
      { label: 'Flag wrong label & pick product', command: 'mark ground pork in display as wrong label' },
      { label: 'Quick undo last command', command: 'undo last command' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Checks, Categories & Containers',
    description: 'Instant read-only queries across products, categories, tags, and containers.',
    badgeClass: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/35',
    headingClass: 'text-cyan-300',
    items: [
      { label: 'Product stock total', command: 'how many pork liver do I have?' },
      { label: 'Product stock in display', command: 'how many brats are in display?' },
      { label: 'Stock across all displays', command: 'how many brats are in all displays?' },
      { label: 'Category total stock', command: 'how much pork do I have?' },
      { label: 'Find items by tag', command: "what's tagged as vacuum sealed?" },
      { label: 'Locate product across freezers', command: 'where do I have pork belly?' },
      { label: 'Where is a container', command: 'where is red bag' },
      { label: 'Count matching containers', command: 'how many green bags are in freezer 1' },
      { label: 'List containers in freezer', command: 'what containers are in freezer 1' },
      { label: 'Which containers are empty', command: 'which containers are empty?' },
      { label: 'What is in Staging Area', command: "what's in staging?" },
      { label: 'Inspect container contents', command: "what's in orange in canada" },
    ],
  },
  {
    id: 'chaining',
    title: 'Chaining, Dictation & Shortcuts',
    description: 'Chain actions, speak naturally, or define custom shortcuts in Voice Dictionary.',
    badgeClass: 'bg-slate-800/80 text-slate-200 border-slate-500/35',
    headingClass: 'text-slate-200',
    items: [
      { label: 'Chain two commands with "and"', command: 'remove 2 brats from display and move 4 hotdogs from orange in canada to display' },
      { label: 'Chain steps with "then"', command: 'empty container orange in canada then move container orange in canada to chest freezer' },
      { label: 'Natural spoken lead-in', command: 'can you please empty out container orange in canada' },
      { label: 'Multi-line mixed operations', command: 'Remove from display:\n- 2 brats\nMove to display:\n- 4 hotdogs from orange in canada' },
    ],
  },
];

const RECENT_COMMANDS_STORAGE_KEY = 'freezer_voice_recent_commands_v1';

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function getIntentMeta(intent: ParsedVoiceClause['intent']) {
  switch (intent) {
    case 'remove':
      return {
        label: 'Remove',
        accentText: 'text-red-400',
      };
    case 'move':
      return {
        label: 'Move',
        accentText: 'text-amber-400',
      };
    case 'add':
      return {
        label: 'Add',
        accentText: 'text-emerald-400',
      };
    case 'set_quantity':
      return {
        label: 'Adjust Inventory',
        accentText: 'text-sky-400',
      };
    case 'add_container':
      return {
        label: 'New Container',
        accentText: 'text-emerald-400',
      };
    case 'empty_container':
      return {
        label: 'Empty Container',
        accentText: 'text-amber-400',
      };
    case 'move_all':
      return {
        label: 'Move All Contents',
        accentText: 'text-amber-400',
      };
    case 'move_container':
      return {
        label: 'Move Container',
        accentText: 'text-amber-400',
      };
    case 'combine_containers':
      return {
        label: 'Combine Containers',
        accentText: 'text-purple-400',
      };
    case 'swap_containers':
      return {
        label: 'Swap Containers',
        accentText: 'text-purple-400',
      };
    case 'rename_container':
      return {
        label: 'Rename Container',
        accentText: 'text-purple-400',
      };
    case 'archive_container':
      return {
        label: 'Archive Container',
        accentText: 'text-amber-400',
      };
    case 'delete_container':
      return {
        label: 'Delete Container',
        accentText: 'text-red-400',
      };
    case 'restock_display':
      return {
        label: 'Restock Display',
        accentText: 'text-emerald-400',
      };
    case 'manage_list':
      return {
        label: 'Custom List',
        accentText: 'text-indigo-400',
      };
    case 'manage_tag':
      return {
        label: 'Item Tag',
        accentText: 'text-teal-400',
      };
    case 'correct_label':
      return {
        label: 'Correct Label',
        accentText: 'text-amber-400',
      };
    case 'undo_last':
      return {
        label: 'Undo Last',
        accentText: 'text-amber-400',
      };
    case 'container_query':
      return {
        label: 'Container Contents',
        accentText: 'text-cyan-400',
      };
    case 'list_query':
      return {
        label: 'List Check',
        accentText: 'text-cyan-400',
      };
    case 'inventory_alert_query':
      return {
        label: 'Stock Alerts',
        accentText: 'text-cyan-400',
      };
    case 'query':
      return {
        label: 'Stock Check',
        accentText: 'text-cyan-400',
      };
    default:
      return {
        label: 'Unrecognized',
        accentText: 'text-cool-gray-400',
      };
  }
}

export const VoiceControlView: React.FC<VoiceControlViewProps> = ({
  state,
  dispatch,
  onNavigateToProduct,
  onNavigateToFreezer,
  onNavigateToFreezerUnit,
  onNavigateToDisplayCase,
  onNavigateToProductsView,
  onNavigateToCategory,
  onNavigateToTag,
  onNavigateToList,
  onNavigateToHistory,
  onTriggerUndo,
  onOpenVoiceDictionary,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, VoiceSelectionOverrides>>({});
  const [expandedSwitcherIds, setExpandedSwitcherIds] = useState<Record<string, boolean>>({});
  const [editingContainerGroupClauseId, setEditingContainerGroupClauseId] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [selectedExampleCategory, setSelectedExampleCategory] = useState<string>('all');
  const [isApplying, setIsApplying] = useState(false);
  const [appliedSummary, setAppliedSummary] = useState<{
    timestamp: string;
    items: AppliedSummaryItem[];
  } | null>(null);
  const [recentCommands, setRecentCommands] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_COMMANDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  const isDisplayContainerId = useCallback(
    (containerId?: string | null) => {
      if (!containerId) return false;
      const cont = (state.containers || []).find(c => c.id === containerId);
      const freezerId =
        cont?.freezerId ||
        (containerId.endsWith('_loose') ? containerId.slice(0, -'_loose'.length) : undefined);
      if (!freezerId) return false;
      const fz = (state.freezers || []).find(f => f.id === freezerId);
      return Boolean(fz?.isSpecial);
    },
    [state.containers, state.freezers]
  );

  const navigateToItem = useCallback(
    (productId: string, isDisplayItem?: boolean) => {
      if (isDisplayItem && onNavigateToDisplayCase) {
        onNavigateToDisplayCase(productId);
      } else {
        onNavigateToProduct(productId);
      }
    },
    [onNavigateToDisplayCase, onNavigateToProduct]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechError(
        'Browser mic is unavailable here — tap the text box and use your keyboard microphone.'
      );
      inputRef.current?.focus();
      return;
    }

    setSpeechError(null);
    setAppliedSummary(null);

    try {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      const basePrefix = commandInput.trim() ? `${commandInput.trim()} ` : '';
      let committedFinal = '';

      recognition.onresult = (event: any) => {
        let interim = '';
        let newlyFinal = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            newlyFinal += text;
          } else {
            interim += text;
          }
        }
        if (newlyFinal) {
          committedFinal = `${committedFinal} ${newlyFinal}`.replace(/\s+/g, ' ').trim();
          setCommandInput(`${basePrefix}${committedFinal}`.trim());
        }
        setInterimTranscript(interim.trim());
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error || 'unknown';
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          if (typeof window !== 'undefined' && !window.isSecureContext) {
            setSpeechError(
              'Browser mic requires HTTPS (or localhost). Tap the text box to use your keyboard microphone instead.'
            );
          } else {
            setSpeechError(
              'Mic permission was blocked by the browser or host frame. Allow Microphone in site settings (or open directly outside an embedded frame), or use your keyboard microphone in the text box.'
            );
          }
          // Focus the text box immediately so mobile keyboard dictation (e.g. Gboard mic) is ready
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (errCode === 'no-speech') {
          setSpeechError('No speech detected. Try again or dictate directly into the text box.');
        } else if (errCode !== 'aborted') {
          setSpeechError(
            `Speech capture stopped (${errCode}). Use your keyboard mic or edit the text directly.`
          );
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setSpeechError('Unable to start browser mic. Use the text box and keyboard microphone instead.');
      setIsListening(false);
    }
  }, [commandInput]);

  const effectiveTranscript = useMemo(() => {
    if (isListening && interimTranscript) {
      return `${commandInput} ${interimTranscript}`.trim();
    }
    return commandInput.trim();
  }, [commandInput, interimTranscript, isListening]);

  const parsedResult = useMemo(() => {
    if (!effectiveTranscript) {
      return {
        rawTranscript: '',
        clauses: [],
        hasMutations: false,
        hasQueries: false,
        readyMutationCount: 0,
        pendingSelectionCount: 0,
      };
    }
    return parseVoiceTranscript(effectiveTranscript, state, overrides);
  }, [effectiveTranscript, state, overrides]);

  const editingContainerClause = useMemo(
    () => parsedResult.clauses.find(c => c.id === editingContainerGroupClauseId) || null,
    [parsedResult.clauses, editingContainerGroupClauseId]
  );

  const updateOverride = useCallback(
    (clauseId: string, patch: Partial<VoiceSelectionOverrides>, groupKey?: string) => {
      setOverrides(prev => {
        const next = { ...prev };
        const isGroupPatch =
          patch.freezerId !== undefined ||
          patch.templateId !== undefined ||
          patch.customContainerName !== undefined ||
          patch.saveAsTemplate !== undefined ||
          patch.containerImageUrl !== undefined ||
          patch.containerIcon !== undefined ||
          patch.existingSpareContainerId !== undefined;
        if (groupKey && isGroupPatch) {
          for (const c of parsedResult.clauses) {
            if (c.newContainerGroupKey === groupKey) {
              next[c.id] = { ...(next[c.id] || {}), ...patch };
            }
          }
        }
        next[clauseId] = { ...(next[clauseId] || {}), ...patch };
        return next;
      });
    },
    [parsedResult.clauses]
  );

  const handleSelectExample = (text: string) => {
    stopListening();
    setOverrides({});
    setExpandedSwitcherIds({});
    setEditingContainerGroupClauseId(null);
    setAppliedSummary(null);
    setSpeechError(null);
    setCommandInput(text);
  };

  const handleClear = () => {
    stopListening();
    setCommandInput('');
    setInterimTranscript('');
    setOverrides({});
    setExpandedSwitcherIds({});
    setEditingContainerGroupClauseId(null);
    setSpeechError(null);
    inputRef.current?.focus();
  };

  const activeMutationClauses = useMemo(
    () =>
      parsedResult.clauses.filter(
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
      ),
    [parsedResult.clauses]
  );

  const firstActiveNewContainerClauseIds = useMemo(() => {
    const seen = new Set<string>();
    const ids = new Set<string>();
    for (const c of activeMutationClauses) {
      if (c.newContainerGroupKey && !seen.has(c.newContainerGroupKey)) {
        seen.add(c.newContainerGroupKey);
        ids.add(c.id);
      }
    }
    return ids;
  }, [activeMutationClauses]);

  const queryClauses = useMemo(
    () =>
      parsedResult.clauses.filter(
        c =>
          !c.excluded &&
          (c.intent === 'query' ||
            c.intent === 'container_query' ||
            c.intent === 'list_query' ||
            c.intent === 'inventory_alert_query')
      ),
    [parsedResult.clauses]
  );

  const unknownClauses = useMemo(
    () => parsedResult.clauses.filter(c => !c.excluded && c.intent === 'unknown'),
    [parsedResult.clauses]
  );

  // [TEMP] Compact parser status summary for temporary failed-prompt recording
  const tempPromptStatus = useMemo(() => {
    if (!effectiveTranscript) {
      return { hasIssue: false, summary: '' };
    }
    const failedQueries = queryClauses.filter(
      c =>
        Boolean(c.errorMessage) ||
        (c.intent === 'query' &&
          !c.categoryQueryResults &&
          !c.tagQueryResults &&
          (!c.queryResults || c.queryResults.length === 0)) ||
        (c.intent === 'container_query' && (!c.containerQueryResults || c.containerQueryResults.length === 0))
    );
    const failedMutations = activeMutationClauses.filter(c => Boolean(c.errorMessage));
    const hasIssue =
      unknownClauses.length > 0 ||
      failedQueries.length > 0 ||
      failedMutations.length > 0 ||
      parsedResult.pendingSelectionCount > 0;

    const parts: string[] = [];
    if (unknownClauses.length > 0) parts.push(`${unknownClauses.length} unrecognized`);
    if (failedQueries.length > 0) parts.push(`${failedQueries.length} empty/error query`);
    if (failedMutations.length > 0) parts.push(`${failedMutations.length} mutation error`);
    if (parsedResult.pendingSelectionCount > 0) parts.push(`${parsedResult.pendingSelectionCount} needs selection`);
    if (parts.length === 0 && parsedResult.clauses.length > 0) {
      parts.push(`parsed ${parsedResult.clauses.length} clause${parsedResult.clauses.length === 1 ? '' : 's'}`);
    }
    return { hasIssue, summary: parts.join(', ') };
  }, [effectiveTranscript, queryClauses, activeMutationClauses, unknownClauses, parsedResult]);

  const canConfirmApply =
    !isApplying &&
    activeMutationClauses.length > 0 &&
    parsedResult.pendingSelectionCount === 0 &&
    unknownClauses.length === 0;

  const saveRecentCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setRecentCommands(prev => {
      const next = [trimmed, ...prev.filter(c => c.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_COMMANDS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleConfirmApply = async () => {
    if (!canConfirmApply) return;
    stopListening();

    const actions = buildVoiceDispatchActions(parsedResult.clauses, state);
    if (actions.length === 0) return;

    const summaryLines: AppliedSummaryItem[] = [];
    const loggedNewContainerGroups = new Set<string>();
    for (const c of activeMutationClauses) {
      if (c.intent === 'empty_container' || c.intent === 'move_all') {
        const srcLabel =
          c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId)?.label ||
          c.sourceLocationQuery ||
          'source';
        const dstLabel =
          c.destLocationCandidates.find(l => l.containerId === c.selectedDestContainerId)?.label ||
          c.destLocationQuery ||
          'Staging Area (Loose)';
        const pieceTotal = (c.containerCutPreviews || []).reduce((s, item) => s + item.quantity, 0);
        const verb = c.intent === 'empty_container' ? 'Emptied' : 'Moved all contents of';
        const exclNote =
          (c.excludedProductIds?.length || 0) > 0
            ? ` (${c.excludedProductIds!.length} excluded)`
            : '';
        summaryLines.push({
          text: `${verb} ${srcLabel} (${pieceTotal} pcs${exclNote}) to ${dstLabel}`,
          containerId: c.selectedDestContainerId || c.selectedSourceContainerId || undefined,
          isContainerOp: true,
        });
        continue;
      }

      if (c.intent === 'move_container') {
        const srcLabel =
          c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId)?.label ||
          c.sourceLocationQuery ||
          'container';
        const freezerLabel =
          (c.freezerCandidates || []).find(f => f.freezerId === c.selectedFreezerId)?.freezerName ||
          'Staging Area';
        summaryLines.push({
          text: `Moved container ${srcLabel} to ${freezerLabel}`,
          containerId: c.selectedSourceContainerId || undefined,
          freezerId: c.selectedFreezerId || undefined,
          isContainerOp: true,
        });
        continue;
      }

      if (c.intent === 'combine_containers') {
        const dstLabel =
          c.destLocationCandidates.find(l => l.containerId === c.selectedDestContainerId)?.label ||
          'target container';
        const absorbedLabels = Array.from(
          new Set(
            (c.combineSlots || [])
              .filter(s => s.selectedContainerId && s.selectedContainerId !== c.selectedDestContainerId)
              .map(
                s =>
                  s.candidates.find(cand => cand.containerId === s.selectedContainerId)?.label ||
                  s.query
              )
          )
        );
        const pieceTotal = (c.containerCutPreviews || []).reduce((s, item) => s + item.quantity, 0);
        summaryLines.push({
          text: `Combined ${absorbedLabels.join(', ')} (${pieceTotal} pcs) into ${dstLabel}`,
          containerId: c.selectedDestContainerId || undefined,
          isContainerOp: true,
        });
        continue;
      }

      if (c.intent === 'swap_containers') {
        const slotA = c.combineSlots?.[0];
        const slotB = c.combineSlots?.[1];
        const labelA =
          slotA?.candidates.find(cand => cand.containerId === slotA.selectedContainerId)?.label ||
          slotA?.query ||
          'Container A';
        const labelB =
          slotB?.candidates.find(cand => cand.containerId === slotB.selectedContainerId)?.label ||
          slotB?.query ||
          'Container B';
        summaryLines.push({
          text: `Swapped ${labelA} ↔ ${labelB}`,
          containerId: slotA?.selectedContainerId || slotB?.selectedContainerId || undefined,
          isContainerOp: true,
        });
        continue;
      }

      if (c.intent === 'rename_container') {
        const srcLabel =
          c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId)?.label ||
          c.sourceLocationQuery ||
          'container';
        summaryLines.push({
          text: `Renamed ${srcLabel} to "${c.newContainerNameInput}"`,
          containerId: c.selectedSourceContainerId || undefined,
          isContainerOp: true,
        });
        continue;
      }

      if (c.intent === 'archive_container') {
        const srcLabel =
          c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId)?.label ||
          c.sourceLocationQuery ||
          'container';
        summaryLines.push({
          text: `${c.archiveState === false ? 'Restored' : 'Archived'} container ${srcLabel}`,
          containerId: c.selectedSourceContainerId || undefined,
          isContainerOp: true,
        });
        continue;
      }

      if (c.intent === 'delete_container') {
        const srcLabel =
          c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId)?.label ||
          c.sourceLocationQuery ||
          'container';
        const srcObj = c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId);
        summaryLines.push({
          text: `Deleted container ${srcLabel}`,
          freezerId: srcObj?.freezerId || '__staging__',
          isContainerOp: true,
        });
        continue;
      }

      if (c.intent === 'undo_last') {
        summaryLines.push({
          text: `Undid: ${c.undoTargetDescription || 'last action'}`,
          isUndo: true,
        });
        continue;
      }

      if (c.intent === 'restock_display') {
        const prodName =
          c.productCandidates.find(p => p.product.id === c.selectedProductId)?.product.name || c.productQuery;
        const dstLabel =
          c.destLocationCandidates.find(l => l.containerId === c.selectedDestContainerId)?.label ||
          c.destLocationQuery ||
          'Display';
        const sources = (c.restockAllocations || [])
          .map(a => `${a.moveQty}x from ${a.locationLabel}`)
          .join(', ');
        summaryLines.push({
          text: `Restocked ${c.quantity}x ${prodName} to ${dstLabel}${sources ? ` (${sources})` : ''}`,
          containerId: c.selectedDestContainerId || undefined,
          productId: c.selectedProductId || undefined,
          isDisplay: true,
        });
        continue;
      }

      if (c.intent === 'manage_list') {
        const prodName =
          c.productCandidates.find(p => p.product.id === c.selectedProductId)?.product.name || c.productQuery;
        const listName =
          (c.listCandidates || []).find(l => l.list.id === c.selectedListId)?.list.name ||
          c.listQueryText ||
          'list';
        let text: string;
        if (c.listAction === 'remove') {
          text = `Removed ${prodName} from "${listName}"`;
        } else if (c.listAction === 'set_threshold') {
          text = `Set threshold for ${prodName} on "${listName}" to ${c.listThreshold ?? 0}`;
        } else if (c.listAction === 'enable_notify') {
          text = `Enabled alerts for ${prodName} on "${listName}"`;
        } else if (c.listAction === 'disable_notify') {
          text = `Muted alerts for ${prodName} on "${listName}"`;
        } else {
          text = `Added ${prodName} to "${listName}"${
            c.listThreshold !== undefined ? ` (threshold: ${c.listThreshold})` : ''
          }`;
        }
        summaryLines.push({
          text,
          listId: c.selectedListId || undefined,
          productId: c.selectedProductId || undefined,
        });
        continue;
      }

      if (c.intent === 'manage_tag') {
        const prodName =
          c.productCandidates.find(p => p.product.id === c.selectedProductId)?.product.name || c.productQuery;
        const tagName =
          (c.tagCandidates || []).find(t => t.tag.id === c.selectedTagId)?.tag.name ||
          c.tagQueryText ||
          'tag';
        const selectedCutObj = c.cutCandidates.find(cc => cc.meatCut.id === c.selectedMeatCutId);
        const cutLabel = selectedCutObj?.locationLabel || 'on-site';
        summaryLines.push({
          text: `${c.tagAction === 'remove' ? 'Removed' : 'Added'} tag "${tagName}" on ${prodName} (${cutLabel})`,
          containerId: selectedCutObj?.container.id,
          productId: c.selectedProductId || undefined,
          tagId: c.selectedTagId || undefined,
          isDisplay: Boolean(
            selectedCutObj?.freezer?.isSpecial || isDisplayContainerId(selectedCutObj?.container.id)
          ),
        });
        continue;
      }

      if (c.intent === 'correct_label') {
        const oldName =
          c.productCandidates.find(p => p.product.id === c.selectedProductId)?.product.name || c.productQuery;
        const newName =
          (c.replacementProductCandidates || []).find(
            p => p.product.id === c.selectedReplacementProductId
          )?.product.name || 'new label';
        const selectedCutObj = c.cutCandidates.find(cc => cc.meatCut.id === c.selectedMeatCutId);
        const cutLabel = selectedCutObj?.locationLabel || 'on-site';
        summaryLines.push({
          text: `Corrected label on ${oldName} → ${newName} (${cutLabel})`,
          productId: c.selectedReplacementProductId || c.selectedProductId || undefined,
          containerId: selectedCutObj?.container.id,
          isDisplay: Boolean(
            selectedCutObj?.freezer?.isSpecial || isDisplayContainerId(selectedCutObj?.container.id)
          ),
        });
        continue;
      }

      if (c.newContainerGroupKey) {
        const contName = c.resolvedNewContainerName || c.newContainerNameQuery || 'New Container';
        const selectedFreezerObj = (c.freezerCandidates || []).find(f => f.freezerId === c.selectedFreezerId);
        const freezerLabel = selectedFreezerObj?.freezerName || 'Staging Area';
        if (!loggedNewContainerGroups.has(c.newContainerGroupKey)) {
          loggedNewContainerGroups.add(c.newContainerGroupKey);
          const chosenTpl = (c.templateCandidates || []).find(
            t => t.templateId === c.selectedTemplateId && !t.isCustom
          );
          if (c.selectedExistingSpareContainerId) {
            summaryLines.push({
              text: `Placed existing container ${contName} in ${freezerLabel}`,
              containerId: c.selectedExistingSpareContainerId,
              freezerId: c.selectedFreezerId || undefined,
              isContainerOp: true,
            });
          } else if (c.newContainerSaveAsTemplate) {
            summaryLines.push({
              text: `Created container & template ${contName} in ${freezerLabel}`,
              freezerId: c.selectedFreezerId || undefined,
              isContainerOp: true,
            });
          } else {
            summaryLines.push({
              text: `Created container ${contName}${chosenTpl ? ' (from template)' : ''} in ${freezerLabel}`,
              freezerId: c.selectedFreezerId || undefined,
              isContainerOp: true,
            });
          }
        }
        if (c.intent === 'add') {
          const prodName =
            c.productCandidates.find(p => p.product.id === c.selectedProductId)?.product.name || c.productQuery;
          summaryLines.push({
            text: `Added ${c.quantity}x ${prodName} to ${contName} (${freezerLabel})`,
            productId: c.selectedProductId || undefined,
            freezerId: c.selectedFreezerId || undefined,
            isDisplay: Boolean(selectedFreezerObj?.isDisplay),
          });
        }
        continue;
      }

      const prodName =
        c.productCandidates.find(p => p.product.id === c.selectedProductId)?.product.name || c.productQuery;
      if (c.intent === 'remove') {
        const srcLocObj = c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId);
        const srcLabel = srcLocObj?.label || c.sourceLocationQuery || 'on-site';
        summaryLines.push({
          text: `Removed ${c.quantity}x ${prodName} from ${srcLabel}`,
          productId: c.selectedProductId || undefined,
          containerId: c.selectedSourceContainerId || undefined,
          isDisplay: Boolean(srcLocObj?.isDisplay),
        });
      } else if (c.intent === 'set_quantity') {
        const srcLocObj = c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId);
        const locLabel = srcLocObj?.label || c.sourceLocationQuery || 'on-site';
        summaryLines.push({
          text: `Adjusted ${prodName} in ${locLabel} to ${c.quantity}x`,
          productId: c.selectedProductId || undefined,
          containerId: c.selectedSourceContainerId || undefined,
          isDisplay: Boolean(srcLocObj?.isDisplay),
        });
      } else if (c.intent === 'move') {
        const srcLabel =
          c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId)?.label ||
          c.sourceLocationQuery ||
          'source';
        const dstLocObj = c.destLocationCandidates.find(l => l.containerId === c.selectedDestContainerId);
        const dstLabel = dstLocObj?.label || c.destLocationQuery || 'destination';
        summaryLines.push({
          text: `Moved ${c.quantity}x ${prodName} from ${srcLabel} to ${dstLabel}`,
          productId: c.selectedProductId || undefined,
          containerId: c.selectedDestContainerId || c.selectedSourceContainerId || undefined,
          isDisplay: Boolean(dstLocObj?.isDisplay),
        });
      } else {
        const dstLocObj = c.destLocationCandidates.find(l => l.containerId === c.selectedDestContainerId);
        const dstLabel = dstLocObj?.label || c.destLocationQuery || 'destination';
        summaryLines.push({
          text: `Added ${c.quantity}x ${prodName} to ${dstLabel}`,
          productId: c.selectedProductId || undefined,
          containerId: c.selectedDestContainerId || undefined,
          isDisplay: Boolean(dstLocObj?.isDisplay),
        });
      }
    }

    setIsApplying(true);
    try {
      for (const action of actions) {
        await Promise.resolve(dispatch(action));
      }
      saveRecentCommand(commandInput);
      setAppliedSummary({
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: summaryLines,
      });
      setCommandInput('');
      setOverrides({});
      setExpandedSwitcherIds({});
      setEditingContainerGroupClauseId(null);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full pb-24 md:pb-8 space-y-3 sm:space-y-4 animate-fade-in">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-cool-gray-800">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            <span className="truncate">On-Site Voice Control</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-cool-gray-400 truncate">
            Local on-site parser · Off-site and butcher locked out
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenVoiceDictionary && (
            <button
              type="button"
              onClick={onOpenVoiceDictionary}
              className="min-h-[38px] sm:min-h-[42px] px-3 py-1.5 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-cool-gray-200 flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
              title="Open Custom Voice Dictionary"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dictionary</span>
            </button>
          )}
          {onTriggerUndo && (
            <button
              type="button"
              onClick={onTriggerUndo}
              className="min-h-[38px] sm:min-h-[42px] px-3 py-1.5 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-cool-gray-200 flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Undo</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary One-Screen Grid: Compact Input + Proposed Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 items-start">
        {/* Compact Command Box (fits comfortably in top portion on mobile) */}
        <div className="lg:col-span-5 bg-cool-gray-900 border border-cool-gray-800 rounded-xl p-3 sm:p-4 space-y-2.5">
          <div className="flex items-start gap-2">
            <div className="relative flex-1 min-w-0">
              <label htmlFor="voice-command-textarea" className="sr-only">
                Voice or keyboard dictation command
              </label>
              <textarea
                ref={inputRef}
                id="voice-command-textarea"
                rows={2}
                inputMode="text"
                enterKeyHint="go"
                value={isListening && interimTranscript ? `${commandInput} ${interimTranscript}`.trim() : commandInput}
                onChange={e => {
                  if (isListening) stopListening();
                  setAppliedSummary(null);
                  setOverrides({});
                  setCommandInput(e.target.value);
                }}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canConfirmApply) {
                    e.preventDefault();
                    handleConfirmApply();
                  }
                }}
                placeholder="Tap & use keyboard mic (e.g. remove 2 brats from display)..."
                className="w-full rounded-lg bg-cool-gray-950 border border-cool-gray-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 px-3 py-2 pr-8 text-sm text-white placeholder:text-cool-gray-500 leading-snug resize-y min-h-[58px] sm:min-h-[82px] transition"
              />
              {commandInput && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear command text"
                  className="absolute top-1.5 right-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center rounded-md text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Compact Mic Button right beside the box on mobile & desktop */}
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              title={isListening ? 'Stop listening' : speechSupported ? 'Start browser microphone' : 'Browser microphone unavailable'}
              className={`min-h-[58px] sm:min-h-[82px] px-3 sm:px-3.5 rounded-lg font-bold text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer shrink-0 whitespace-nowrap ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700 text-white border border-red-500'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500'
              }`}
            >
              {isListening ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <MicOff className="w-4 h-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>{speechSupported ? 'Speak' : 'Mic'}</span>
                </>
              )}
            </button>
          </div>

          {speechError && (
            <div className="px-2.5 py-2 rounded-lg bg-amber-950/30 border border-amber-500/40 text-[11px] text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{speechError}</span>
            </div>
          )}
        </div>

        {/* Proposed Changes & Stock Lookup (immediately visible below on mobile, right column on desktop) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Applied Receipt Banner */}
          {appliedSummary && (
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3.5 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-white">
                    Updated at {appliedSummary.timestamp}
                  </span>
                </div>
                {onTriggerUndo && (
                  <button
                    type="button"
                    onClick={onTriggerUndo}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-amber-300 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Undo</span>
                  </button>
                )}
              </div>
              <ul className="space-y-1 text-xs text-cool-gray-200 pl-6 list-disc">
                {appliedSummary.items.map((item, i) => {
                  const canJump = Boolean(
                    item.containerId ||
                      item.productId ||
                      item.freezerId ||
                      item.listId ||
                      item.tagId ||
                      item.isUndo
                  );
                  const handleJump = () => {
                    if (item.isContainerOp) {
                      if (item.containerId) {
                        onNavigateToFreezer(item.containerId);
                      } else if (item.freezerId && onNavigateToFreezerUnit) {
                        onNavigateToFreezerUnit(item.freezerId);
                      }
                    } else if (item.isDisplay && item.productId && onNavigateToDisplayCase) {
                      onNavigateToDisplayCase(item.productId);
                    } else if (item.productId) {
                      onNavigateToProduct(item.productId);
                    } else if (item.containerId) {
                      onNavigateToFreezer(item.containerId);
                    } else if (item.freezerId && onNavigateToFreezerUnit) {
                      onNavigateToFreezerUnit(item.freezerId);
                    } else if (item.listId && onNavigateToList) {
                      onNavigateToList(item.listId);
                    } else if (item.tagId && onNavigateToTag) {
                      onNavigateToTag(item.tagId);
                    } else if (item.isUndo && onNavigateToHistory) {
                      onNavigateToHistory();
                    }
                  };
                  return (
                    <li key={i}>
                      {canJump ? (
                        <button
                          type="button"
                          onClick={handleJump}
                          className="text-left hover:text-cyan-300 inline-flex items-center gap-1.5 transition cursor-pointer"
                          title="Open updated item in main app"
                        >
                          <span>{item.text}</span>
                          <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                        </button>
                      ) : (
                        <span>{item.text}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Compact Empty State */}
          {!effectiveTranscript && !appliedSummary && (
            <div className="bg-cool-gray-900/70 border border-cool-gray-800 rounded-xl px-4 py-4 text-center">
              <p className="text-xs sm:text-sm text-cool-gray-300 font-medium">
                Proposed changes will appear here for confirmation before anything changes.
              </p>
            </div>
          )}

          {/* Immediate Stock & Container Query Cards (Read-Only, No Voice Readout) */}
          {queryClauses.length > 0 && (
            <div className="space-y-2.5">
              {queryClauses.map(clause =>
                clause.intent === 'container_query' ? (
                  <div
                    key={clause.id}
                    className="bg-cool-gray-900 border border-cyan-500/35 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-cool-gray-400">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">
                          {clause.containerQueryMode === 'location' ? (
                            <>
                              Container location:{' '}
                              <strong className="text-white">
                                "{clause.sourceLocationQuery || clause.queryLocationFilter}"
                              </strong>
                            </>
                          ) : clause.containerQueryMode === 'empty' ? (
                            <>
                              Empty containers
                              {(clause.containerQueryTargetLabel || clause.queryLocationFilter) ? (
                                <>
                                  {' '}in{' '}
                                  <strong className="text-cyan-300">
                                    {clause.containerQueryTargetLabel || clause.queryLocationFilter}
                                  </strong>
                                </>
                              ) : (
                                <> across all on-site freezers</>
                              )}
                            </>
                          ) : clause.containerQueryMode === 'staging' ? (
                            <>Staging Area &amp; unplaced containers</>
                          ) : clause.containerQueryMode === 'count' ? (
                            <>
                              Container count:{' '}
                              <strong className="text-white">
                                "{clause.productQuery === '__all_containers__' ? 'containers' : clause.sourceLocationQuery}"
                              </strong>
                              {(clause.containerQueryTargetLabel || clause.queryLocationFilter) && (
                                <>
                                  {' · '}in{' '}
                                  <strong className="text-cyan-300">
                                    {clause.containerQueryTargetLabel || clause.queryLocationFilter}
                                  </strong>
                                </>
                              )}
                            </>
                          ) : clause.productQuery === '__all_containers__' ? (
                            <>
                              Containers
                              {(clause.containerQueryTargetLabel || clause.queryLocationFilter) ? (
                                <>
                                  {' '}in{' '}
                                  <strong className="text-white">
                                    {clause.containerQueryTargetLabel || clause.queryLocationFilter}
                                  </strong>
                                </>
                              ) : (
                                <> across all on-site freezers</>
                              )}
                            </>
                          ) : (
                            <>
                              Container contents:{' '}
                              <strong className="text-white">"{clause.sourceLocationQuery}"</strong>
                            </>
                          )}
                        </span>
                      </span>

                      {clause.containerQueryMode === 'count' ? (
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-cyan-400 tabular-nums leading-none">
                            {clause.containerQueryResults?.length || 0}
                          </div>
                          <div className="text-[10px] text-cool-gray-400">
                            {(clause.containerQueryResults?.length || 0) === 1 ? 'container' : 'containers'}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="tabular-nums">
                            {clause.containerQueryResults?.length || 0} container
                            {(clause.containerQueryResults?.length || 0) === 1 ? '' : 's'}
                          </span>
                          {clause.containerQueryMode === 'staging' && onNavigateToFreezerUnit && (
                            <button
                              type="button"
                              onClick={() => onNavigateToFreezerUnit('__staging__')}
                              title="Open Staging Area in Freezers view"
                              className="px-2 py-1 rounded-md bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-[11px] font-semibold text-cool-gray-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Staging</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {(!clause.containerQueryResults || clause.containerQueryResults.length === 0) && (
                      <div
                        className={`p-2.5 rounded-lg bg-cool-gray-850 border border-cool-gray-800 text-xs flex items-center justify-between gap-2 ${
                          clause.errorMessage ? 'text-amber-300' : 'text-cool-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {clause.errorMessage ? (
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                          ) : (
                            <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                          )}
                          <span>
                            {clause.errorMessage ||
                              `0 matching containers${
                                clause.containerQueryTargetLabel
                                  ? ` in ${clause.containerQueryTargetLabel}`
                                  : ''
                              }.`}
                          </span>
                        </div>
                        {onNavigateToFreezerUnit && (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToFreezerUnit(
                                clause.containerQueryMode === 'staging' ? '__staging__' : 'all'
                              )
                            }
                            className="px-2.5 py-1 rounded-md bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-cyan-300 inline-flex items-center gap-1 shrink-0 cursor-pointer transition"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open Freezers</span>
                          </button>
                        )}
                      </div>
                    )}

                    {clause.containerQueryResults && clause.containerQueryResults.length > 0 && (
                      <div className="divide-y divide-cool-gray-800">
                        {clause.containerQueryResults.map(res => (
                          <div key={res.containerId} className="py-2.5 first:pt-0.5 last:pb-0.5 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(res.containerId)}
                                title="Open container in Freezers view"
                                className="min-w-0 flex-1 text-left group cursor-pointer"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                                    {res.containerName}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/35 text-[11px] font-semibold text-cyan-300">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    {res.freezerName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-cool-gray-400 mt-0.5">
                                  {res.items.length} item line{res.items.length === 1 ? '' : 's'} · {res.totalPieces} total piece{res.totalPieces === 1 ? '' : 's'}
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(res.containerId)}
                                title="Open container in Freezers view"
                                className="min-w-[38px] min-h-[38px] px-2.5 flex items-center justify-center gap-1 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-cool-gray-300 hover:text-cyan-300 transition cursor-pointer shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Open</span>
                              </button>
                            </div>

                            {res.items.length === 0 ? (
                              <div className="text-xs text-cool-gray-500 pl-1">Empty (0 items inside)</div>
                            ) : (
                              <div className="space-y-1">
                                {res.items.map((item, idx) => (
                                  <button
                                    key={`${item.meatCut.id}-${idx}`}
                                    type="button"
                                    onClick={() => navigateToItem(item.product.id, res.isDisplay)}
                                    title={res.isDisplay ? 'Open in Display Case view' : 'Open product in Products view'}
                                    className="w-full min-h-[34px] px-2.5 py-1.5 rounded-lg bg-cool-gray-850/70 hover:bg-cool-gray-800 border border-cool-gray-800 flex items-center justify-between gap-2 text-xs text-left transition cursor-pointer"
                                  >
                                    <div className="min-w-0 flex items-center gap-1.5">
                                      <Package className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                      <span className="text-cool-gray-100 font-medium truncate">
                                        {item.product.name}
                                      </span>
                                      {item.meatCut.notes && (
                                        <span className="text-cool-gray-500 truncate">({item.meatCut.notes})</span>
                                      )}
                                    </div>
                                    <span className="font-bold text-white tabular-nums shrink-0">
                                      {item.quantity}x
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : clause.intent === 'list_query' ? (
                  <div
                    key={clause.id}
                    className="bg-cool-gray-900 border border-indigo-500/35 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-cool-gray-400">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <ListIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">
                          Custom list check
                          {clause.listQueryText ? (
                            <>
                              {': '}
                              <strong className="text-white">"{clause.listQueryText}"</strong>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <span className="tabular-nums shrink-0">
                        {clause.listQueryResults?.length || 0} list{(clause.listQueryResults?.length || 0) === 1 ? '' : 's'}
                      </span>
                    </div>

                    {clause.errorMessage && (
                      <div className="p-2.5 rounded-lg bg-cool-gray-850 border border-cool-gray-800 text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{clause.errorMessage}</span>
                      </div>
                    )}

                    {clause.listQueryResults && clause.listQueryResults.length > 0 && (
                      <div className="divide-y divide-cool-gray-800">
                        {clause.listQueryResults.map(res => {
                          const lowCount = res.items.filter(
                            it => it.threshold !== undefined && it.currentOnSiteQty <= it.threshold
                          ).length;
                          return (
                            <div key={res.list.id} className="py-2.5 first:pt-0.5 last:pb-0.5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => onNavigateToList?.(res.list.id)}
                                  className="min-w-0 text-left flex items-center gap-1.5 group cursor-pointer"
                                  title="Open custom lists in Catalog"
                                >
                                  <span className="text-sm font-bold text-white group-hover:text-cyan-300 truncate transition">
                                    {res.list.name}
                                  </span>
                                  <ExternalLink className="w-3.5 h-3.5 text-cool-gray-400 group-hover:text-cyan-300 shrink-0 transition" />
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] text-cool-gray-400 tabular-nums">
                                    {res.items.length} item{res.items.length === 1 ? '' : 's'}
                                    {lowCount > 0 ? (
                                      <span className="text-amber-300 font-semibold">
                                        {' '}
                                        &middot; {lowCount} below min
                                      </span>
                                    ) : null}
                                  </span>
                                  {onNavigateToList && (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateToList(res.list.id)}
                                      title="Open in Lists"
                                      className="min-w-[34px] min-h-[34px] px-2 flex items-center justify-center gap-1 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-cool-gray-300 hover:text-cyan-300 transition cursor-pointer"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Open</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                            {res.checkedProduct && (
                              <div
                                className={`px-2.5 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                  res.isProductOnList
                                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                                    : 'bg-cool-gray-850 border-cool-gray-700 text-cool-gray-300'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => onNavigateToProduct(res.checkedProduct!.id)}
                                  className="text-left hover:text-cyan-300 transition cursor-pointer"
                                >
                                  <strong>{res.checkedProduct.name}</strong> is{' '}
                                  {res.isProductOnList ? 'ON' : 'NOT on'} {res.list.name}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onNavigateToProduct(res.checkedProduct!.id)}
                                  className="text-cyan-300 hover:text-cyan-200 font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  <span>Open</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {!res.checkedProduct && res.items.length === 0 && (
                              <div className="text-xs text-cool-gray-500 pl-1">No items on this list yet.</div>
                            )}

                            {!res.checkedProduct && res.items.length > 0 && (
                              <div className="space-y-1">
                                {res.items.map(it => {
                                  const isLow = it.threshold !== undefined && it.currentOnSiteQty <= it.threshold;
                                  return (
                                    <button
                                      key={it.product.id}
                                      type="button"
                                      onClick={() => onNavigateToProduct(it.product.id)}
                                      className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg bg-cool-gray-850/70 hover:bg-cool-gray-800 border border-cool-gray-800 flex items-center justify-between gap-2 text-xs text-left transition cursor-pointer"
                                    >
                                      <div className="min-w-0 flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        <span className="text-cool-gray-100 font-medium truncate">
                                          {it.product.name}
                                        </span>
                                        {it.threshold !== undefined && (
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                                              isLow
                                                ? 'bg-amber-950/60 text-amber-300 border border-amber-500/35'
                                                : 'bg-cool-gray-900 text-cool-gray-400 border border-cool-gray-700'
                                            }`}
                                          >
                                            min {it.threshold}
                                          </span>
                                        )}
                                        {it.notifyEnabled === false && (
                                          <BellOff className="w-3 h-3 text-cool-gray-500 shrink-0" />
                                        )}
                                      </div>
                                      <span
                                        className={`font-bold tabular-nums shrink-0 ${
                                          isLow ? 'text-amber-300' : 'text-white'
                                        }`}
                                      >
                                        {it.currentOnSiteQty} on-site
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : clause.intent === 'inventory_alert_query' ? (
                  <div
                    key={clause.id}
                    className="bg-cool-gray-900 border border-amber-500/35 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-cool-gray-400">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">
                          {clause.alertQueryMode === 'needs_restock' ? (
                            <>
                              Needs restocking in <strong className="text-white">{clause.queryLocationFilter}</strong>
                            </>
                          ) : clause.alertQueryMode === 'display_low_stock' ? (
                            <>
                              Low stock (&le; {clause.alertThreshold}) in{' '}
                              <strong className="text-white">{clause.queryLocationFilter}</strong>
                            </>
                          ) : clause.alertQueryMode === 'global_out_of_stock' ? (
                            <>Completely out of stock across all on-site freezers</>
                          ) : clause.alertQueryMode === 'global_low_stock' ? (
                            <>Low stock (&le; {clause.alertThreshold}) across all on-site freezers</>
                          ) : (
                            <>
                              Out of stock in <strong className="text-white">{clause.queryLocationFilter}</strong>
                            </>
                          )}
                        </span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums font-semibold text-amber-300">
                          {clause.alertQueryResults?.length || 0} item{(clause.alertQueryResults?.length || 0) === 1 ? '' : 's'}
                        </span>
                        {clause.alertQueryMode?.startsWith('global')
                          ? onNavigateToProductsView && (
                              <button
                                type="button"
                                onClick={onNavigateToProductsView}
                                title="Open Products view"
                                className="px-2 py-1 rounded-md bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-[11px] font-semibold text-cool-gray-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Products</span>
                              </button>
                            )
                          : onNavigateToDisplayCase && (
                              <button
                                type="button"
                                onClick={() => onNavigateToDisplayCase()}
                                title="Open Display Case view"
                                className="px-2 py-1 rounded-md bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-[11px] font-semibold text-cool-gray-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Display</span>
                              </button>
                            )}
                      </div>
                    </div>

                    {clause.errorMessage && (
                      <div className="p-2.5 rounded-lg bg-cool-gray-850 border border-cool-gray-800 text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{clause.errorMessage}</span>
                      </div>
                    )}

                    {!clause.errorMessage && (!clause.alertQueryResults || clause.alertQueryResults.length === 0) && (
                      <div className="p-2.5 rounded-lg bg-cool-gray-850 border border-cool-gray-800 text-xs text-emerald-300 flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>All checked items are stocked above this threshold.</span>
                      </div>
                    )}

                    {clause.alertQueryResults && clause.alertQueryResults.length > 0 && (() => {
                      const isDisplayAlert = !clause.alertQueryMode?.startsWith('global');
                      return (
                        <div className="space-y-1.5">
                          {clause.alertQueryResults.map(item => (
                            <div
                              key={item.product.id}
                              className="p-2.5 rounded-lg bg-cool-gray-850/80 border border-cool-gray-800 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => navigateToItem(item.product.id, isDisplayAlert)}
                                  title={isDisplayAlert ? 'Open in Display Case view' : 'Open in Products view'}
                                  className="min-w-0 flex-1 text-left cursor-pointer group"
                                >
                                  <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                                    {item.product.name}
                                  </div>
                                  <div className="text-[11px] text-cool-gray-400">
                                    {item.product.primaryCategory} · {item.product.subCategory}
                                  </div>
                                </button>
                                <div className="flex items-center gap-1.5 shrink-0 text-xs tabular-nums">
                                  <span className="px-2 py-0.5 rounded bg-cool-gray-900 border border-cool-gray-700 text-amber-300 font-semibold">
                                    {!isDisplayAlert
                                      ? `${item.totalOnSiteQty} on-site`
                                      : `${item.targetLocationQty} here`}
                                  </span>
                                  {isDisplayAlert && (
                                    <span
                                      className={`px-2 py-0.5 rounded border font-semibold ${
                                        item.backstockQty > 0
                                          ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                                          : 'bg-cool-gray-900 border-cool-gray-800 text-cool-gray-500'
                                      }`}
                                    >
                                      {item.backstockQty} backstock
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => navigateToItem(item.product.id, isDisplayAlert)}
                                    title={isDisplayAlert ? 'Open in Display Case view' : 'Open in Products view'}
                                    className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-300 hover:text-cyan-300 transition cursor-pointer"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {item.backstockLocations.length > 0 && isDisplayAlert && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {item.backstockLocations.map(loc => (
                                    <button
                                      key={loc.containerId}
                                      type="button"
                                      onClick={() =>
                                        isDisplayContainerId(loc.containerId) && onNavigateToDisplayCase
                                          ? onNavigateToDisplayCase(item.product.id)
                                          : onNavigateToFreezer(loc.containerId)
                                      }
                                      className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer transition ${
                                        loc.hasPrioritized
                                          ? 'bg-amber-950/40 hover:bg-amber-950/60 border-amber-500/40 text-amber-200 hover:text-amber-100'
                                          : 'bg-cool-gray-900 hover:bg-cool-gray-800 border-cool-gray-750 text-cool-gray-300 hover:text-cyan-300'
                                      }`}
                                      title={loc.hasPrioritized ? 'Prioritize pulling from this tagged container' : 'Open container in Freezers view'}
                                    >
                                      {loc.hasPrioritized ? '⚡ ' : ''}
                                      {loc.label}: <strong className="text-white">{loc.quantity}</strong>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ) : clause.tagQueryResults ? (
                  <div
                    key={clause.id}
                    className="bg-cool-gray-900 border border-teal-500/35 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-cool-gray-400">
                      <span className="flex items-center gap-1.5">
                        <TagIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>
                          Tag check: <strong className="text-white">"{clause.tagQueryText}"</strong>
                          {clause.queryLocationFilter && (
                            <>
                              {' · '}in <strong className="text-cyan-300">{clause.queryLocationFilter}</strong>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="tabular-nums shrink-0">
                        {clause.tagQueryResults.reduce((s, t) => s + t.totalQuantity, 0)} pcs
                      </span>
                    </div>

                    {clause.tagQueryResults.map(res => (
                      <div key={res.tag.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigateToTag?.(res.tag.id)}
                            title="Filter Products view by this tag"
                            className="text-left flex items-center gap-1.5 group cursor-pointer min-w-0"
                          >
                            <span className="text-sm font-bold text-white group-hover:text-cyan-300 truncate transition">
                              {res.tag.name}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-cool-gray-400 group-hover:text-cyan-300 shrink-0 transition" />
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-teal-300 tabular-nums">
                              {res.totalQuantity} total pcs
                            </span>
                            {onNavigateToTag && (
                              <button
                                type="button"
                                onClick={() => onNavigateToTag(res.tag.id)}
                                title="Open tagged items in Products view"
                                className="min-w-[34px] min-h-[34px] px-2 flex items-center justify-center gap-1 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-cool-gray-300 hover:text-cyan-300 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Open</span>
                              </button>
                            )}
                          </div>
                        </div>
                        {res.items.length === 0 ? (
                          <div className="text-xs text-cool-gray-500">No active items carry this tag.</div>
                        ) : (
                          <div className="space-y-1">
                            {res.items.map((item, idx) => {
                              const itemIsDisplay = isDisplayContainerId(item.containerId);
                              return (
                                <div
                                  key={`${item.meatCut.id}-${idx}`}
                                  className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg bg-cool-gray-850/70 border border-cool-gray-800 flex items-center justify-between gap-2 text-xs"
                                >
                                  <button
                                    type="button"
                                    onClick={() => navigateToItem(item.product.id, itemIsDisplay)}
                                    title={itemIsDisplay ? 'Open in Display Case view' : 'Open product in Products view'}
                                    className="min-w-0 flex items-center gap-1.5 text-left hover:text-cyan-300 transition cursor-pointer"
                                  >
                                    <Package className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                    <span className="text-white hover:text-cyan-300 font-medium truncate">
                                      {item.product.name}
                                    </span>
                                  </button>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        itemIsDisplay && onNavigateToDisplayCase
                                          ? onNavigateToDisplayCase(item.product.id)
                                          : onNavigateToFreezer(item.containerId)
                                      }
                                      title={itemIsDisplay ? 'Open in Display Case view' : 'Open container in Freezers view'}
                                      className="px-2 py-0.5 rounded bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-700 text-[11px] text-cool-gray-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer max-w-[160px]"
                                    >
                                      <MapPin className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{item.containerLabel}</span>
                                    </button>
                                    <span className="font-bold text-white tabular-nums shrink-0">{item.quantity}x</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : clause.categoryQueryResults ? (
                  <div
                    key={clause.id}
                    className="bg-cool-gray-900 border border-cyan-500/35 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-cool-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Category stock: <strong className="text-white">"{clause.productQuery}"</strong>
                          {clause.queryLocationFilter && (
                            <>
                              {' · '}in <strong className="text-cyan-300">{clause.queryLocationFilter}</strong>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="tabular-nums shrink-0">
                        {clause.categoryQueryResults.length} categor{clause.categoryQueryResults.length === 1 ? 'y' : 'ies'}
                      </span>
                    </div>

                    <div className="divide-y divide-cool-gray-800">
                      {clause.categoryQueryResults.map(cat => (
                        <div key={`${cat.categoryType}-${cat.categoryName}`} className="py-2 first:pt-0.5 last:pb-0.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onNavigateToCategory?.(
                                  cat.categoryName,
                                  cat.categoryType,
                                  cat.items[0]?.product.primaryCategory
                                )
                              }
                              title="Open category in Products view"
                              className="text-left group cursor-pointer min-w-0"
                            >
                              <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                                {cat.categoryName}
                              </span>
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-cool-gray-400">
                                {cat.categoryType === 'primary' ? 'Primary Category' : 'Subcategory'}
                              </span>
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-base font-bold text-cyan-400 tabular-nums">
                                {cat.totalQuantity} on-site
                              </span>
                              {onNavigateToCategory && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onNavigateToCategory(
                                      cat.categoryName,
                                      cat.categoryType,
                                      cat.items[0]?.product.primaryCategory
                                    )
                                  }
                                  title="Open category in Products view"
                                  className="min-w-[34px] min-h-[34px] px-2 flex items-center justify-center gap-1 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-cool-gray-300 hover:text-cyan-300 transition cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Open</span>
                                </button>
                              )}
                            </div>
                          </div>
                          {cat.items.length === 0 ? (
                            <div className="text-xs text-cool-gray-500">0 in stock.</div>
                          ) : (
                            <div className="space-y-1">
                              {cat.items.map(it => (
                                <button
                                  key={it.product.id}
                                  type="button"
                                  onClick={() => onNavigateToProduct(it.product.id)}
                                  className="w-full min-h-[34px] px-2.5 py-1.5 rounded-lg bg-cool-gray-850/70 hover:bg-cool-gray-800 border border-cool-gray-800 flex items-center justify-between gap-2 text-xs text-left transition cursor-pointer"
                                >
                                  <span className="text-cool-gray-100 font-medium truncate">{it.product.name}</span>
                                  <span className="font-bold text-white tabular-nums shrink-0">{it.totalQuantity}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    key={clause.id}
                    className="bg-cool-gray-900 border border-cyan-500/35 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-cool-gray-400">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Stock check: <strong className="text-white">"{clause.productQuery}"</strong>
                          {clause.bundlePhrase && (
                            <>
                              {' · '}
                              <span className="text-fuchsia-300 font-semibold">
                                Pack: {clause.bundlePhrase}
                              </span>
                            </>
                          )}
                          {clause.queryLocationFilter && (
                            <>
                              {' · '}in <strong className="text-cyan-300">{clause.queryLocationFilter}</strong>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="tabular-nums shrink-0">
                        {clause.queryResults?.length || 0} match{(clause.queryResults?.length || 0) === 1 ? '' : 'es'}
                      </span>
                    </div>

                    {(!clause.queryResults || clause.queryResults.length === 0) && (
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-lg bg-cool-gray-850 border border-cool-gray-800 text-xs text-amber-300 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{clause.errorMessage || `No on-site products matched "${clause.productQuery}".`}</span>
                        </div>
                        {clause.suggestedFallbackProducts && clause.suggestedFallbackProducts.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-cool-gray-300">
                              Did you mean? Tap to check stock:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {clause.suggestedFallbackProducts.map(cand => (
                                <button
                                  key={cand.product.id}
                                  type="button"
                                  onClick={() => updateOverride(clause.id, { productId: cand.product.id })}
                                  className="px-2.5 py-1.5 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 hover:border-cyan-500/60 text-xs text-cool-gray-100 hover:text-cyan-200 transition cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <span>{cand.product.name}</span>
                                  <span className="text-[10px] text-cool-gray-400 tabular-nums">
                                    ({cand.totalOnSiteQty})
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {clause.queryResults && clause.queryResults.length > 0 && (
                      <div className="divide-y divide-cool-gray-800">
                        {clause.queryResults.map(res => {
                          const allLocationsDisplay =
                            res.locations.length > 0 && res.locations.every(loc => loc.isDisplay);
                          return (
                            <div key={res.product.id} className="py-2.5 first:pt-0.5 last:pb-0.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => navigateToItem(res.product.id, allLocationsDisplay)}
                                  title={allLocationsDisplay ? 'Open in Display Case view' : 'Open in Products view'}
                                  className="min-w-0 flex-1 text-left group cursor-pointer"
                                >
                                  <div className="text-sm font-bold text-white group-hover:text-cyan-300 truncate transition">
                                    {res.product.name}
                                  </div>
                                  <div className="text-[11px] text-cool-gray-400 truncate">
                                    {res.product.primaryCategory} · {res.product.subCategory}
                                  </div>
                                </button>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-cyan-400 tabular-nums leading-none">
                                      {res.totalQuantity}
                                    </div>
                                    <div className="text-[10px] text-cool-gray-400">on-site</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => navigateToItem(res.product.id, allLocationsDisplay)}
                                    title={allLocationsDisplay ? 'Open in Display Case view' : 'Open in Products view'}
                                    className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-300 hover:text-cyan-300 transition cursor-pointer"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {res.locations.length === 0 ? (
                                <div className="text-xs text-cool-gray-500 pl-1">
                                  0 in stock across matching on-site locations
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {res.locations.map((loc, idx) => (
                                    <button
                                      key={`${loc.containerId}-${idx}`}
                                      type="button"
                                      onClick={() =>
                                        loc.isDisplay && onNavigateToDisplayCase
                                          ? onNavigateToDisplayCase(res.product.id)
                                          : onNavigateToFreezer(loc.containerId)
                                      }
                                      title={loc.isDisplay ? 'Open in Display Case view' : 'Open container in Freezers view'}
                                      className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg bg-cool-gray-850/70 hover:bg-cool-gray-800 border border-cool-gray-800 flex items-center justify-between gap-2 text-xs text-left transition cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {loc.isDisplay ? (
                                          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        ) : (
                                          <MapPin className="w-3.5 h-3.5 text-cool-gray-400 shrink-0" />
                                        )}
                                        <span className="text-cool-gray-200 truncate">
                                          {loc.freezerName} · {loc.containerName}
                                        </span>
                                        {loc.notes && (
                                          <span className="text-cool-gray-500 truncate">({loc.notes})</span>
                                        )}
                                      </div>
                                      <span className="font-bold text-white tabular-nums shrink-0">
                                        {loc.quantity}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Partial / Unrecognized Clauses with 1-Tap Recovery */}
          {unknownClauses.length > 0 && (
            <div className="bg-cool-gray-900 border border-amber-500/40 rounded-xl p-3 space-y-2.5">
              {unknownClauses.map(clause => {
                const topProd = clause.suggestedFallbackProducts?.[0];
                const topTpl = clause.suggestedTemplateCandidates?.[0];
                const topLoc = clause.suggestedFallbackLocations?.[0];
                const suggestedFreezerName = clause.suggestedFreezerId
                  ? (clause.suggestedFallbackFreezers || []).find(
                      f => f.freezerId === clause.suggestedFreezerId
                    )?.freezerName
                  : undefined;

                return (
                  <div key={clause.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <div className="flex items-start gap-2 text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{clause.errorMessage}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateOverride(clause.id, { excluded: true })}
                        className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 cursor-pointer shrink-0"
                        title="Dismiss line"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pl-6">
                      {topProd && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateOverride(clause.id, {
                                fallbackIntent: 'add',
                                productId: clause.inferredFallbackProductQuery
                                  ? topProd.product.id
                                  : undefined,
                              })
                            }
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-xs font-semibold text-emerald-200 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>
                              Add {clause.quantity}x{' '}
                              {clause.inferredFallbackProductQuery ? topProd.product.name : 'Item'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateOverride(clause.id, {
                                fallbackIntent: 'remove',
                                productId: clause.inferredFallbackProductQuery
                                  ? topProd.product.id
                                  : undefined,
                              })
                            }
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-xs font-semibold text-red-200 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Minus className="w-3.5 h-3.5" />
                            <span>
                              Remove {clause.quantity}x{' '}
                              {clause.inferredFallbackProductQuery ? topProd.product.name : 'Item'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateOverride(clause.id, {
                                fallbackIntent: 'move',
                                productId: clause.inferredFallbackProductQuery
                                  ? topProd.product.id
                                  : undefined,
                              })
                            }
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/40 text-xs font-semibold text-amber-200 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Move</span>
                          </button>
                        </>
                      )}

                      {topTpl && (
                        <button
                          type="button"
                          onClick={() =>
                            updateOverride(clause.id, {
                              fallbackIntent: 'add',
                              createNewContainer: true,
                              templateId: topTpl.templateId,
                              customContainerName: topTpl.isCustom ? topTpl.name : undefined,
                              productId: clause.inferredFallbackProductQuery
                                ? topProd?.product.id
                                : undefined,
                              freezerId: clause.suggestedFreezerId || undefined,
                            })
                          }
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/40 text-xs font-semibold text-cyan-200 transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>
                            Pack in New "{topTpl.name}"
                            {suggestedFreezerName ? ` → ${suggestedFreezerName}` : ''}
                          </span>
                        </button>
                      )}

                      {topLoc && !topLoc.isLoose && (
                        <button
                          type="button"
                          onClick={() =>
                            updateOverride(clause.id, {
                              fallbackIntent: 'move_container',
                              sourceContainerId: topLoc.containerId,
                              freezerId: clause.suggestedFreezerId || undefined,
                            })
                          }
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/40 text-xs font-semibold text-purple-200 transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>
                            Move {topLoc.containerName}
                            {suggestedFreezerName ? ` → ${suggestedFreezerName}` : ' to Freezer'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => updateOverride(clause.id, { fallbackIntent: 'query' })}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-xs font-semibold text-cool-gray-200 transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Search className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Check Stock</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending Mutations Confirmation Plan */}
          {activeMutationClauses.length > 0 && (
            <div className="space-y-2.5">
              {/* Plan Header Bar */}
              <div className="bg-cool-gray-900 border border-cool-gray-800 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-white">Proposed Changes</h2>
                  <p className="text-[11px] sm:text-xs text-cool-gray-400 tabular-nums">
                    {parsedResult.readyMutationCount} of {activeMutationClauses.length} ready
                    {parsedResult.pendingSelectionCount > 0 && (
                      <span className="text-amber-400 font-semibold">
                        {' · '}
                        {parsedResult.pendingSelectionCount} need{parsedResult.pendingSelectionCount === 1 ? 's' : ''} selection
                      </span>
                    )}
                  </p>
                </div>

                <div className="hidden md:flex items-center">
                  <button
                    type="button"
                    disabled={!canConfirmApply}
                    onClick={handleConfirmApply}
                    className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                      canConfirmApply
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow-lg shadow-cyan-950/30'
                        : 'bg-cool-gray-800 text-cool-gray-500 border border-cool-gray-700 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isApplying
                        ? 'Applying...'
                        : `Confirm & Apply (${activeMutationClauses.length})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Line-Item Cards */}
              {activeMutationClauses.map(clause => {
                const meta = getIntentMeta(clause.intent);
                const selectedProduct = clause.productCandidates.find(
                  p => p.product.id === clause.selectedProductId
                );
                const selectedSourceLoc = clause.sourceLocationCandidates.find(
                  l => l.containerId === clause.selectedSourceContainerId
                );
                const selectedDestLoc = clause.destLocationCandidates.find(
                  l => l.containerId === clause.selectedDestContainerId
                );
                const selectedCut = clause.cutCandidates.find(
                  c => c.meatCut.id === clause.selectedMeatCutId
                );
                const selectedNewFreezer = (clause.freezerCandidates || []).find(
                  f => f.freezerId === clause.selectedFreezerId
                );
                const selectedNewTemplate = (clause.templateCandidates || []).find(
                  t => t.templateId === clause.selectedTemplateId
                );
                const selectedListObj = (clause.listCandidates || []).find(
                  l => l.list.id === clause.selectedListId
                );
                const selectedTagObj = (clause.tagCandidates || []).find(
                  t => t.tag.id === clause.selectedTagId
                );
                const selectedReplacementProd = (clause.replacementProductCandidates || []).find(
                  p => p.product.id === clause.selectedReplacementProductId
                );
                const isNewContainerGroupOwner = Boolean(
                  clause.newContainerGroupKey && firstActiveNewContainerClauseIds.has(clause.id)
                );

                const isBulkContainerOp =
                  clause.intent === 'empty_container' ||
                  clause.intent === 'move_all' ||
                  clause.intent === 'move_container' ||
                  clause.intent === 'combine_containers' ||
                  clause.intent === 'swap_containers' ||
                  clause.intent === 'rename_container' ||
                  clause.intent === 'archive_container' ||
                  clause.intent === 'delete_container';

                const isNewCustomMutationOp =
                  clause.intent === 'manage_list' ||
                  clause.intent === 'manage_tag' ||
                  clause.intent === 'correct_label' ||
                  clause.intent === 'undo_last';

                const clauseItemIsDisplay =
                  clause.intent === 'restock_display'
                    ? true
                    : clause.intent === 'remove' || clause.intent === 'set_quantity'
                    ? Boolean(selectedSourceLoc?.isDisplay)
                    : clause.intent === 'add'
                    ? Boolean(selectedDestLoc?.isDisplay || selectedNewFreezer?.isDisplay)
                    : clause.intent === 'move'
                    ? Boolean(selectedDestLoc?.isDisplay)
                    : clause.intent === 'manage_tag' || clause.intent === 'correct_label'
                    ? Boolean(selectedCut?.freezer?.isSpecial || selectedSourceLoc?.isDisplay)
                    : false;

                const showQuantityStepper =
                  clause.intent !== 'add_container' &&
                  !isBulkContainerOp &&
                  !isNewCustomMutationOp &&
                  !(clause.intent === 'set_quantity' && !clause.productQuery.trim());

                const isSwitcherOpen = Boolean(expandedSwitcherIds[clause.id]);
                const hasCombineSlotSelectionNeeded = Boolean(
                  clause.combineSlots?.some(s => s.requiresSelection)
                );
                const needsAnySelection =
                  clause.requiresProductSelection ||
                  clause.requiresSourceLocationSelection ||
                  clause.requiresDestLocationSelection ||
                  clause.requiresCutSelection ||
                  clause.requiresListSelection ||
                  clause.requiresTagSelection ||
                  clause.requiresReplacementProductSelection ||
                  hasCombineSlotSelectionNeeded ||
                  Boolean(
                    (isNewContainerGroupOwner || clause.intent === 'move_container') &&
                      clause.requiresFreezerSelection
                  ) ||
                  Boolean(isNewContainerGroupOwner && clause.requiresTemplateSelection);

                const hasContainerSwitcherOptions = Boolean(
                  (isNewContainerGroupOwner || clause.intent === 'move_container') &&
                    ((clause.freezerCandidates?.length || 0) > 1 ||
                      (isNewContainerGroupOwner && (clause.templateCandidates?.length || 0) > 1))
                );
                const hasCombineSlotSwitcherOptions = Boolean(
                  clause.combineSlots?.some(s => s.candidates.length > 1)
                );
                const hasExtraCandidateSwitcherOptions =
                  (clause.listCandidates?.length || 0) > 1 ||
                  (clause.tagCandidates?.length || 0) > 1 ||
                  (clause.replacementProductCandidates?.length || 0) > 1;

                const currentCutQty =
                  selectedCut?.meatCut.quantity ??
                  (clause.intent === 'set_quantity' &&
                  selectedProduct &&
                  selectedSourceLoc &&
                  clause.cutCandidates.length === 0
                    ? 0
                    : null);
                const projectedAfterQty =
                  clause.intent === 'set_quantity'
                    ? clause.quantity
                    : currentCutQty !== null && (clause.intent === 'remove' || clause.intent === 'move')
                    ? Math.max(0, currentCutQty - clause.quantity)
                    : null;

                const selectedCombineNames = (clause.combineSlots || [])
                  .map(
                    s =>
                      s.candidates.find(c => c.containerId === s.selectedContainerId)?.containerName ||
                      s.query
                  )
                  .join(' + ');

                const totalPreviewPieces = (clause.containerCutPreviews || []).reduce(
                  (sum, item) => sum + item.quantity,
                  0
                );

                return (
                  <div
                    key={clause.id}
                    className={`bg-cool-gray-900 border rounded-xl p-3 sm:p-3.5 space-y-2.5 transition ${
                      clause.isValid ? 'border-cool-gray-700' : 'border-amber-500/50'
                    }`}
                  >
                    {/* Top Row: Intent + Item/Container + Stepper */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className={`font-bold uppercase tracking-wider ${meta.accentText}`}>
                            {meta.label}
                          </span>
                          {clause.bundlePhrase && (
                            <>
                              <span className="text-cool-gray-600">·</span>
                              <span className="text-fuchsia-300 font-semibold">
                                Pack: {clause.bundlePhrase}
                              </span>
                            </>
                          )}
                          {clause.newContainerGroupKey && clause.intent === 'add' && (
                            <>
                              <span className="text-cool-gray-600">·</span>
                              <span className="text-emerald-300 font-semibold">Into new container</span>
                            </>
                          )}
                          {clause.isAllQuantity && (
                            <>
                              <span className="text-cool-gray-600">·</span>
                              <span className="text-cyan-300 font-semibold">All remaining</span>
                            </>
                          )}
                          <span className="text-cool-gray-600">·</span>
                          <span className="text-cool-gray-400 truncate">"{clause.rawText}"</span>
                        </div>
                        <div className="text-sm font-bold text-white flex flex-wrap items-center gap-1 mt-0.5">
                          {clause.intent === 'add_container' ? (
                            clause.selectedExistingSpareContainerId ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(clause.selectedExistingSpareContainerId!)}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open container in Freezers view"
                              >
                                <span>Create "{clause.resolvedNewContainerName || clause.newContainerNameQuery}"</span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : clause.selectedFreezerId && onNavigateToFreezerUnit ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezerUnit(clause.selectedFreezerId!)}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open target freezer in Freezers view"
                              >
                                <span>Create "{clause.resolvedNewContainerName || clause.newContainerNameQuery}"</span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : (
                              <span>
                                Create "{clause.resolvedNewContainerName || clause.newContainerNameQuery}"
                              </span>
                            )
                          ) : clause.intent === 'empty_container' ? (
                            selectedSourceLoc ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open container in Freezers view"
                              >
                                <span>Empty {selectedSourceLoc.label}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : (
                              <span>Empty "{clause.sourceLocationQuery}"</span>
                            )
                          ) : clause.intent === 'move_all' ? (
                            selectedSourceLoc ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open container in Freezers view"
                              >
                                <span>Move all contents of {selectedSourceLoc.label}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : (
                              <span>Move all contents of "{clause.sourceLocationQuery}"</span>
                            )
                          ) : clause.intent === 'move_container' ? (
                            selectedSourceLoc ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open container in Freezers view"
                              >
                                <span>Move container {selectedSourceLoc.label}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : (
                              <span>Move container "{clause.sourceLocationQuery}"</span>
                            )
                          ) : clause.intent === 'combine_containers' ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span>Combine</span>
                              {(clause.combineSlots || []).map((slot, idx) => (
                                <React.Fragment key={`combine-title-${slot.slotIndex}`}>
                                  {idx > 0 && <span className="text-cool-gray-400">+</span>}
                                  {slot.selectedContainerId ? (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateToFreezer(slot.selectedContainerId!)}
                                      className="hover:text-cyan-300 inline-flex items-center gap-0.5 transition cursor-pointer"
                                      title="Open container in Freezers view"
                                    >
                                      <span>
                                        {slot.candidates.find(c => c.containerId === slot.selectedContainerId)
                                          ?.containerName || slot.query}
                                      </span>
                                      <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                    </button>
                                  ) : (
                                    <span>{slot.query}</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </span>
                          ) : clause.intent === 'swap_containers' ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span>Swap</span>
                              {(clause.combineSlots || []).map((slot, idx) => (
                                <React.Fragment key={`swap-title-${slot.slotIndex}`}>
                                  {idx > 0 && <span className="text-cool-gray-400">↔</span>}
                                  {slot.selectedContainerId ? (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateToFreezer(slot.selectedContainerId!)}
                                      className="hover:text-cyan-300 inline-flex items-center gap-0.5 transition cursor-pointer"
                                      title="Open container in Freezers view"
                                    >
                                      <span>
                                        {slot.candidates.find(c => c.containerId === slot.selectedContainerId)
                                          ?.containerName || slot.query}
                                      </span>
                                      <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                    </button>
                                  ) : (
                                    <span>{slot.query}</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </span>
                          ) : clause.intent === 'rename_container' ? (
                            selectedSourceLoc ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open container in Freezers view"
                              >
                                <span>
                                  Rename {selectedSourceLoc.label} → "{clause.newContainerNameInput}"
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : (
                              <span>
                                Rename "{clause.sourceLocationQuery}" → "{clause.newContainerNameInput}"
                              </span>
                            )
                          ) : clause.intent === 'archive_container' ? (
                            selectedSourceLoc ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open container in Freezers view"
                              >
                                <span>
                                  {clause.archiveState === false ? 'Restore' : 'Archive'} {selectedSourceLoc.label}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : (
                              <span>
                                {clause.archiveState === false ? 'Restore' : 'Archive'} "{clause.sourceLocationQuery}"
                              </span>
                            )
                          ) : clause.intent === 'delete_container' ? (
                            selectedSourceLoc ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open container in Freezers view"
                              >
                                <span>Delete container {selectedSourceLoc.label}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : (
                              <span>Delete container "{clause.sourceLocationQuery}"</span>
                            )
                          ) : clause.intent === 'undo_last' ? (
                            onNavigateToHistory ? (
                              <button
                                type="button"
                                onClick={onNavigateToHistory}
                                className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                title="Open Audit History"
                              >
                                <span>Undo: {clause.undoTargetDescription || 'Last Action'}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              </button>
                            ) : (
                              <span>Undo: {clause.undoTargetDescription || 'Last Action'}</span>
                            )
                          ) : clause.intent === 'restock_display' ? (
                            <>
                              <span className="tabular-nums text-emerald-300">+{clause.quantity}x</span>
                              {selectedProduct ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToItem(selectedProduct.product.id, true)}
                                  className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  title="Open in Display Case view"
                                >
                                  <span>{selectedProduct.product.name}</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                </button>
                              ) : (
                                <span>{clause.productQuery ? `"${clause.productQuery}"` : 'Restock Item'}</span>
                              )}
                            </>
                          ) : clause.intent === 'manage_list' ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span>
                                {clause.listAction === 'remove'
                                  ? 'Remove'
                                  : clause.listAction === 'set_threshold'
                                  ? 'Set threshold for'
                                  : clause.listAction === 'enable_notify'
                                  ? 'Enable alerts for'
                                  : clause.listAction === 'disable_notify'
                                  ? 'Mute alerts for'
                                  : 'Add'}
                              </span>
                              {selectedProduct ? (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToProduct(selectedProduct.product.id)}
                                  className="hover:text-cyan-300 inline-flex items-center gap-0.5 transition cursor-pointer"
                                  title="Open product in Products view"
                                >
                                  <span>{selectedProduct.product.name}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              ) : (
                                <span>{clause.productQuery}</span>
                              )}
                              {clause.listAction === 'remove' || !clause.listAction || clause.listAction === 'add' ? (
                                <>
                                  <span>{clause.listAction === 'remove' ? 'from' : 'to'}</span>
                                  {selectedListObj && onNavigateToList ? (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateToList(selectedListObj.list.id)}
                                      className="hover:text-cyan-300 inline-flex items-center gap-0.5 transition cursor-pointer"
                                      title="Open Lists in Catalog"
                                    >
                                      <span>{selectedListObj.list.name}</span>
                                      <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                    </button>
                                  ) : (
                                    <span>{selectedListObj?.list.name || clause.listQueryText || 'list'}</span>
                                  )}
                                </>
                              ) : clause.listAction === 'set_threshold' ? (
                                <span>to {clause.listThreshold ?? 0}</span>
                              ) : null}
                            </span>
                          ) : clause.intent === 'manage_tag' ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span>{clause.tagAction === 'remove' ? 'Remove' : 'Add'} tag</span>
                              {selectedTagObj && onNavigateToTag ? (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToTag(selectedTagObj.tag.id)}
                                  className="hover:text-cyan-300 inline-flex items-center gap-0.5 transition cursor-pointer"
                                  title="Filter Products view by this tag"
                                >
                                  <span>"{selectedTagObj.tag.name}"</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              ) : (
                                <span>"{selectedTagObj?.tag.name || clause.tagQueryText}"</span>
                              )}
                              <span>{clause.tagAction === 'remove' ? 'from' : 'on'}</span>
                              {selectedProduct ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToItem(selectedProduct.product.id, clauseItemIsDisplay)}
                                  className="hover:text-cyan-300 inline-flex items-center gap-0.5 transition cursor-pointer"
                                  title={clauseItemIsDisplay ? 'Open in Display Case view' : 'Open product in Products view'}
                                >
                                  <span>{selectedProduct.product.name}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              ) : (
                                <span>{clause.productQuery}</span>
                              )}
                            </span>
                          ) : clause.intent === 'correct_label' ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span>Relabel</span>
                              {selectedProduct ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToItem(selectedProduct.product.id, clauseItemIsDisplay)}
                                  className="hover:text-cyan-300 inline-flex items-center gap-0.5 transition cursor-pointer"
                                  title={clauseItemIsDisplay ? 'Open in Display Case view' : 'Open product in Products view'}
                                >
                                  <span>{selectedProduct.product.name}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              ) : (
                                <span>{clause.productQuery}</span>
                              )}
                              <span>→</span>
                              {selectedReplacementProd ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToItem(selectedReplacementProd.product.id, clauseItemIsDisplay)}
                                  className="hover:text-cyan-300 inline-flex items-center gap-0.5 transition cursor-pointer"
                                  title={clauseItemIsDisplay ? 'Open replacement product in Display Case view' : 'Open replacement product in Products view'}
                                >
                                  <span>{selectedReplacementProd.product.name}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              ) : (
                                <span>
                                  {clause.replacementProductQuery
                                    ? `"${clause.replacementProductQuery}"`
                                    : 'Select replacement'}
                                </span>
                              )}
                            </span>
                          ) : (
                            <>
                              <span className="tabular-nums">
                                {clause.intent === 'remove'
                                  ? `-${clause.quantity}x`
                                  : clause.intent === 'add'
                                  ? `+${clause.quantity}x`
                                  : clause.intent === 'set_quantity'
                                  ? clause.missingTargetQuantity
                                    ? '?x'
                                    : `=${clause.quantity}x`
                                  : `${clause.quantity}x`}
                              </span>
                              {selectedProduct ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToItem(selectedProduct.product.id, clauseItemIsDisplay)}
                                  className="text-left hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  title={clauseItemIsDisplay ? 'Open in Display Case view' : 'Open product in Products view'}
                                >
                                  <span>{selectedProduct.product.name}</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                </button>
                              ) : (
                                <span>
                                  {clause.productQuery ? `"${clause.productQuery}"` : 'Inventory Adjustment'}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper (item mutations only) + Remove Line */}
                      <div className="flex items-center gap-1 shrink-0">
                        {showQuantityStepper && (
                          <>
                            <button
                              type="button"
                              data-action="decrement"
                              aria-label="Decrease quantity"
                              onClick={() =>
                                updateOverride(clause.id, {
                                  quantity: Math.max(
                                    clause.intent === 'set_quantity' ? 0 : 1,
                                    clause.quantity - 1
                                  ),
                                })
                              }
                              className="btn-qty-minus min-w-[38px] min-h-[38px] rounded-lg flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="min-w-[28px] text-center font-bold text-sm text-white tabular-nums">
                              {clause.quantity}
                            </span>
                            <button
                              type="button"
                              data-action="increment"
                              aria-label="Increase quantity"
                              onClick={() => updateOverride(clause.id, { quantity: clause.quantity + 1 })}
                              className="btn-qty-plus min-w-[38px] min-h-[38px] rounded-lg flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => updateOverride(clause.id, { excluded: true })}
                          aria-label="Remove this item from batch"
                          title="Remove from batch"
                          className="min-w-[38px] min-h-[38px] ml-0.5 rounded-lg bg-cool-gray-850 hover:bg-red-950/50 border border-cool-gray-700 hover:border-red-500/40 text-cool-gray-400 hover:text-red-300 flex items-center justify-center transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Resolved Location & Stock Balance */}
                    {(clause.isValid || isNewContainerGroupOwner || isBulkContainerOp || isNewCustomMutationOp || clause.intent === 'restock_display') && (
                      <div className="space-y-1.5 px-2.5 py-2 rounded-lg bg-cool-gray-850/90 border border-cool-gray-800 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-cool-gray-200 min-w-0">
                            {clause.intent === 'remove' && selectedSourceLoc && (
                              <>
                                <span className="text-cool-gray-400">From:</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectedSourceLoc.isDisplay && onNavigateToDisplayCase
                                      ? onNavigateToDisplayCase(selectedProduct?.product.id)
                                      : onNavigateToFreezer(selectedSourceLoc.containerId)
                                  }
                                  className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  title={selectedSourceLoc.isDisplay ? 'Open in Display Case view' : 'Open container in Freezers view'}
                                >
                                  <span>{selectedSourceLoc.label}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              </>
                            )}
                            {clause.intent === 'set_quantity' && selectedSourceLoc && (
                              <>
                                <span className="text-cool-gray-400">In:</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectedSourceLoc.isDisplay && selectedProduct && onNavigateToDisplayCase
                                      ? onNavigateToDisplayCase(selectedProduct.product.id)
                                      : onNavigateToFreezer(selectedSourceLoc.containerId)
                                  }
                                  className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  title={
                                    selectedSourceLoc.isDisplay && selectedProduct
                                      ? 'Open in Display Case view'
                                      : 'Open container in Freezers view'
                                  }
                                >
                                  <span>{selectedSourceLoc.label}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              </>
                            )}
                            {clause.intent === 'move' && selectedSourceLoc && selectedDestLoc && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectedSourceLoc.isDisplay && onNavigateToDisplayCase
                                      ? onNavigateToDisplayCase(selectedProduct?.product.id)
                                      : onNavigateToFreezer(selectedSourceLoc.containerId)
                                  }
                                  className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  title={
                                    selectedSourceLoc.isDisplay
                                      ? 'Open in Display Case view'
                                      : 'Open source container in Freezers view'
                                  }
                                >
                                  <span>{selectedSourceLoc.label}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectedDestLoc.isDisplay && onNavigateToDisplayCase
                                      ? onNavigateToDisplayCase(selectedProduct?.product.id)
                                      : onNavigateToFreezer(selectedDestLoc.containerId)
                                  }
                                  className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  title={
                                    selectedDestLoc.isDisplay
                                      ? 'Open in Display Case view'
                                      : 'Open destination container in Freezers view'
                                  }
                                >
                                  <span>{selectedDestLoc.label}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              </>
                            )}
                            {clause.intent === 'restock_display' && (
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-cool-gray-400">To:</span>
                                  {selectedDestLoc ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        selectedDestLoc.isDisplay && onNavigateToDisplayCase
                                          ? onNavigateToDisplayCase(selectedProduct?.product.id)
                                          : onNavigateToFreezer(selectedDestLoc.containerId)
                                      }
                                      className="font-semibold text-emerald-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                      title={
                                        selectedDestLoc.isDisplay
                                          ? 'Open in Display Case view'
                                          : 'Open destination in Freezers view'
                                      }
                                    >
                                      <span>{selectedDestLoc.label}</span>
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                    </button>
                                  ) : (
                                    <span className="font-semibold text-emerald-300">
                                      {clause.destLocationQuery || 'Display'}
                                    </span>
                                  )}
                                  {clause.restockAllocations && clause.restockAllocations.length > 0 && (
                                    <span className="text-cool-gray-400 flex flex-wrap items-center gap-1">
                                      <span>· From</span>
                                      {clause.restockAllocations.map((a, idx) => (
                                        <span key={`${a.meatCut.id}-${idx}`} className="inline-flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => onNavigateToFreezer(a.container.id)}
                                            className="text-cool-gray-200 hover:text-cyan-300 underline decoration-cool-gray-600 hover:decoration-cyan-400 transition cursor-pointer"
                                            title="Open source container in Freezers view"
                                          >
                                            {a.locationLabel} ({a.moveQty})
                                          </button>
                                          {(a.tags || []).map(tag => (
                                            <span
                                              key={tag.id}
                                              className="px-1 py-0.2 rounded text-[10px] font-bold border uppercase"
                                              style={{
                                                backgroundColor: `${tag.color || '#f59e0b'}20`,
                                                borderColor: `${tag.color || '#f59e0b'}45`,
                                                color: tag.color || '#fbbf24',
                                              }}
                                            >
                                              {tag.excludeFromDisplayRestock ? '🚫 ' : tag.prioritizeItem ? '⚡ ' : ''}
                                              {tag.name}
                                            </span>
                                          ))}
                                          {idx < clause.restockAllocations!.length - 1 && <span>,</span>}
                                        </span>
                                      ))}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {clause.restockRuleNote && (clause.intent === 'restock_display' || clause.intent === 'remove' || clause.intent === 'move') && (
                              <div className="w-full text-[11px] text-cyan-300/90 flex items-center gap-1">
                                <TagIcon className="w-3 h-3 shrink-0" />
                                <span>{clause.restockRuleNote}</span>
                              </div>
                            )}
                            {(clause.intent === 'empty_container' || clause.intent === 'move_all') && (
                              <>
                                {selectedSourceLoc ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                    title="Open source container in Freezers view"
                                  >
                                    <span>{selectedSourceLoc.label}</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">
                                    {clause.sourceLocationQuery || 'Select source'}
                                  </span>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                {selectedDestLoc ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(selectedDestLoc.containerId)}
                                    className="font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 transition cursor-pointer"
                                    title="Open destination container in Freezers view"
                                  >
                                    <span>{selectedDestLoc.label}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-cyan-300">
                                    {clause.destLocationQuery || 'Select destination'}
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'move_container' && (
                              <>
                                {selectedSourceLoc ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                    title="Open container in Freezers view"
                                  >
                                    <span>{selectedSourceLoc.label}</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">
                                    {clause.sourceLocationQuery || 'Select container'}
                                  </span>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                {selectedNewFreezer && onNavigateToFreezerUnit ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezerUnit(selectedNewFreezer.freezerId)}
                                    className="font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 transition cursor-pointer"
                                    title="Open target freezer in Freezers view"
                                  >
                                    <span>{selectedNewFreezer.freezerName}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-cyan-300">
                                    {selectedNewFreezer?.freezerName ||
                                      clause.destLocationQuery ||
                                      'Select freezer'}
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'combine_containers' && (
                              <>
                                <span className="text-cool-gray-400">Keep into:</span>
                                {selectedDestLoc ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(selectedDestLoc.containerId)}
                                    className="font-semibold text-purple-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                    title="Open surviving container in Freezers view"
                                  >
                                    <span>{selectedDestLoc.label}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-purple-300">
                                    Choose surviving container below
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'swap_containers' && (
                              <>
                                <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                {clause.combineSlots?.[0]?.selectedContainerId ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(clause.combineSlots![0].selectedContainerId!)}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>
                                      {clause.combineSlots[0].candidates.find(
                                        c => c.containerId === clause.combineSlots?.[0]?.selectedContainerId
                                      )?.label || clause.combineSlots[0].query}
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">
                                    {clause.combineSlots?.[0]?.query}
                                  </span>
                                )}
                                <span className="text-cool-gray-400">with</span>
                                {clause.combineSlots?.[1]?.selectedContainerId ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(clause.combineSlots![1].selectedContainerId!)}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>
                                      {clause.combineSlots[1].candidates.find(
                                        c => c.containerId === clause.combineSlots?.[1]?.selectedContainerId
                                      )?.label || clause.combineSlots[1].query}
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">
                                    {clause.combineSlots?.[1]?.query}
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'rename_container' && (
                              <>
                                <Edit2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                {selectedSourceLoc ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>{selectedSourceLoc.label}</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">
                                    {clause.sourceLocationQuery}
                                  </span>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span className="font-semibold text-purple-300">
                                  "{clause.newContainerNameInput}"
                                </span>
                              </>
                            )}
                            {clause.intent === 'archive_container' && (
                              <>
                                <Archive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="text-cool-gray-400">
                                  {clause.archiveState === false ? 'Restore:' : 'Archive:'}
                                </span>
                                {selectedSourceLoc ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>{selectedSourceLoc.label}</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">
                                    {clause.sourceLocationQuery}
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'delete_container' && (
                              <>
                                <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span className="text-cool-gray-400">Delete:</span>
                                {selectedSourceLoc ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(selectedSourceLoc.containerId)}
                                    className="font-semibold text-red-200 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>{selectedSourceLoc.label}</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-red-200">
                                    {clause.sourceLocationQuery}
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'manage_list' && (
                              <>
                                {clause.listAction === 'enable_notify' ? (
                                  <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : clause.listAction === 'disable_notify' ? (
                                  <BellOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                ) : (
                                  <ListIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                )}
                                <span className="text-cool-gray-400">List:</span>
                                {selectedListObj && onNavigateToList ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToList(selectedListObj.list.id)}
                                    className="font-semibold text-indigo-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>{selectedListObj.list.name}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-indigo-300">
                                    {selectedListObj?.list.name || clause.listQueryText || 'Choose list'}
                                  </span>
                                )}
                                {clause.listThreshold !== undefined && (
                                  <span className="px-1.5 py-0.5 rounded bg-cool-gray-900 border border-cool-gray-700 text-[11px] text-cyan-300 font-semibold tabular-nums">
                                    min {clause.listThreshold}
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'manage_tag' && (
                              <>
                                <TagIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                {selectedTagObj && onNavigateToTag ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToTag(selectedTagObj.tag.id)}
                                    className="font-semibold text-teal-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>{selectedTagObj.tag.name}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-teal-300">
                                    {selectedTagObj?.tag.name || clause.tagQueryText}
                                  </span>
                                )}
                                {selectedCut && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectedCut.freezer?.isSpecial && onNavigateToDisplayCase
                                        ? onNavigateToDisplayCase(selectedProduct?.product.id)
                                        : onNavigateToFreezer(selectedCut.container.id)
                                    }
                                    className="text-cool-gray-400 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                    title={selectedCut.freezer?.isSpecial ? 'Open in Display Case view' : 'Open container in Freezers view'}
                                  >
                                    <span>· {selectedCut.locationLabel}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </button>
                                )}
                              </>
                            )}
                            {clause.intent === 'correct_label' && (
                              <>
                                <span className="text-cool-gray-400">Stack:</span>
                                {selectedCut || selectedSourceLoc ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const isDisp = Boolean(
                                        selectedCut?.freezer?.isSpecial || selectedSourceLoc?.isDisplay
                                      );
                                      if (isDisp && onNavigateToDisplayCase) {
                                        onNavigateToDisplayCase(
                                          selectedReplacementProd?.product.id || selectedProduct?.product.id
                                        );
                                      } else {
                                        onNavigateToFreezer(
                                          selectedCut?.container.id || selectedSourceLoc!.containerId
                                        );
                                      }
                                    }}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                    title={
                                      selectedCut?.freezer?.isSpecial || selectedSourceLoc?.isDisplay
                                        ? 'Open in Display Case view'
                                        : 'Open container in Freezers view'
                                    }
                                  >
                                    <span>{selectedCut?.locationLabel || selectedSourceLoc?.label}</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">on-site</span>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                {selectedReplacementProd ? (
                                  <button
                                    type="button"
                                    onClick={() => navigateToItem(selectedReplacementProd.product.id, clauseItemIsDisplay)}
                                    className="font-semibold text-emerald-300 hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                    title={clauseItemIsDisplay ? 'Open in Display Case view' : 'Open in Products view'}
                                  >
                                    <span>{selectedReplacementProd.product.name}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-emerald-300">
                                    Choose new product below
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'undo_last' && (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                {onNavigateToHistory ? (
                                  <button
                                    type="button"
                                    onClick={onNavigateToHistory}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>{clause.undoTargetDescription || 'Nothing to undo'}</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">
                                    {clause.undoTargetDescription || 'Nothing to undo'}
                                  </span>
                                )}
                                {clause.undoTargetTimestamp && (
                                  <span className="text-cool-gray-400">
                                    ({new Date(clause.undoTargetTimestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })})
                                  </span>
                                )}
                              </>
                            )}
                            {clause.intent === 'add' && !clause.newContainerGroupKey && selectedDestLoc && (
                              <>
                                <span className="text-cool-gray-400">To:</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectedDestLoc.isDisplay && onNavigateToDisplayCase
                                      ? onNavigateToDisplayCase(selectedProduct?.product.id)
                                      : onNavigateToFreezer(selectedDestLoc.containerId)
                                  }
                                  className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  title={
                                    selectedDestLoc.isDisplay
                                      ? 'Open in Display Case view'
                                      : 'Open destination container in Freezers view'
                                  }
                                >
                                  <span>{selectedDestLoc.label}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                </button>
                              </>
                            )}
                            {clause.newContainerGroupKey && (
                              <>
                                {clause.newContainerImageUrl && (
                                  <img
                                    src={clause.newContainerImageUrl}
                                    alt={clause.resolvedNewContainerName || 'Container photo'}
                                    className="w-6 h-6 rounded object-cover border border-cool-gray-700 shrink-0"
                                  />
                                )}
                                <span className="text-cool-gray-400">
                                  {clause.selectedExistingSpareContainerId
                                    ? 'Existing spare:'
                                    : clause.intent === 'add_container'
                                    ? 'In:'
                                    : 'New container:'}
                                </span>
                                {clause.selectedExistingSpareContainerId ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToFreezer(clause.selectedExistingSpareContainerId!)}
                                    className="font-semibold text-white hover:text-cyan-300 inline-flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span>
                                      {clause.resolvedNewContainerName || clause.newContainerNameQuery} (Spare Pool)
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                                  </button>
                                ) : (
                                  <span className="font-semibold text-white">
                                    {clause.resolvedNewContainerName || clause.newContainerNameQuery}
                                    {clause.newContainerSaveAsTemplate
                                      ? ' (Save as Template)'
                                      : selectedNewTemplate && !selectedNewTemplate.isCustom
                                      ? ' (Template)'
                                      : ' (Custom)'}
                                  </span>
                                )}
                                {clause.newContainerImageUrl && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-cyan-300">
                                    <ImageIcon className="w-3 h-3" />
                                    Photo
                                  </span>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                {selectedNewFreezer ? (
                                  clause.intent !== 'add_container' &&
                                  selectedNewFreezer.isDisplay &&
                                  onNavigateToDisplayCase ? (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateToDisplayCase(selectedProduct?.product.id)}
                                      className="font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 transition cursor-pointer"
                                      title="Open in Display Case view"
                                    >
                                      <span>{selectedNewFreezer.freezerName}</span>
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                    </button>
                                  ) : onNavigateToFreezerUnit ? (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateToFreezerUnit(selectedNewFreezer.freezerId)}
                                      className="font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 transition cursor-pointer"
                                      title="Open freezer in Freezers view"
                                    >
                                      <span>{selectedNewFreezer.freezerName}</span>
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                    </button>
                                  ) : (
                                    <span className="font-semibold text-cyan-300">
                                      {selectedNewFreezer.freezerName}
                                    </span>
                                  )
                                ) : (
                                  <span className="font-semibold text-cyan-300">Staging Area</span>
                                )}
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 tabular-nums shrink-0">
                            {currentCutQty !== null && projectedAfterQty !== null && (
                              <span className="text-cool-gray-300">
                                <strong className="text-white">{currentCutQty}</strong> →{' '}
                                <strong className={projectedAfterQty === 0 ? 'text-amber-300' : 'text-emerald-400'}>
                                  {projectedAfterQty}
                                </strong>
                              </span>
                            )}
                            {isBulkContainerOp && (clause.containerCutPreviews?.length || 0) > 0 && (
                              <span className="text-cool-gray-300">
                                <strong className="text-white">{totalPreviewPieces}</strong> pcs
                              </span>
                            )}
                            {clause.switchedFromExistingAdd && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateOverride(clause.id, {
                                    createNewContainer: false,
                                    templateId: null,
                                    freezerId: null,
                                    customContainerName: undefined,
                                    existingSpareContainerId: undefined,
                                  })
                                }
                                className="px-2 py-1 rounded-md bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition"
                                title="Switch back to adding into an existing container"
                              >
                                <RotateCcw className="w-3 h-3 shrink-0" />
                                <span>Use Existing</span>
                              </button>
                            )}
                            {clause.canSwitchToNewContainer && !clause.newContainerGroupKey && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateOverride(clause.id, {
                                    createNewContainer: true,
                                    destContainerId: null,
                                  })
                                }
                                className="px-2 py-1 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 border border-emerald-500/40 text-emerald-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition"
                                title="Pack these items into a new container / template and pick a freezer"
                              >
                                <Plus className="w-3 h-3 shrink-0" />
                                <span>New Container / Location</span>
                              </button>
                            )}
                            {isNewContainerGroupOwner && (
                              <button
                                type="button"
                                onClick={() => setEditingContainerGroupClauseId(clause.id)}
                                className="px-2 py-1 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-650 text-cyan-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition"
                                title="Open full New Container Form (add photo, save as template, pick spare container)"
                              >
                                <SlidersHorizontal className="w-3 h-3 shrink-0" />
                                <span>Container Form</span>
                              </button>
                            )}
                            {(clause.productCandidates.length > 1 ||
                              clause.sourceLocationCandidates.length > 1 ||
                              clause.destLocationCandidates.length > 1 ||
                              (!clause.requiresSourceLocationSelection && clause.cutCandidates.length > 1) ||
                              hasContainerSwitcherOptions ||
                              hasCombineSlotSwitcherOptions ||
                              hasExtraCandidateSwitcherOptions) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSwitcherIds(prev => ({
                                    ...prev,
                                    [clause.id]: !prev[clause.id],
                                  }))
                                }
                                className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>Change</span>
                                {isSwitcherOpen ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Item preview chips for container-level operations */}
                        {isBulkContainerOp &&
                          clause.containerCutPreviews &&
                          clause.containerCutPreviews.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-cool-gray-800/80">
                              <span className="text-[11px] text-cool-gray-400">
                                {clause.intent === 'move_container' ||
                                clause.intent === 'archive_container' ||
                                clause.intent === 'delete_container'
                                  ? 'Inside:'
                                  : 'Moving:'}
                              </span>
                              {clause.containerCutPreviews.map((item, idx) => {
                                const chipIsDisplay = isDisplayContainerId(item.containerId);
                                return (
                                  <button
                                    key={`${item.meatCut.id}-${idx}`}
                                    type="button"
                                    onClick={() => navigateToItem(item.product.id, chipIsDisplay)}
                                    title={chipIsDisplay ? 'Open in Display Case view' : 'Open product in Products view'}
                                    className="px-2 py-0.5 rounded bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-750 hover:border-cyan-500/40 text-[11px] text-cool-gray-200 hover:text-cyan-300 tabular-nums transition cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <strong className="text-white">{item.quantity}x</strong>
                                    <span>{item.product.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                        {/* Excluded items indicator for empty_container / move_all */}
                        {clause.exceptProductQueries && clause.exceptProductQueries.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-cool-gray-800/80 text-[11px]">
                            <span className="text-amber-300 font-semibold">Keeping behind (excluded):</span>
                            {clause.exceptProductQueries.map((q, idx) => (
                              <span
                                key={`${q}-${idx}`}
                                className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/35 text-amber-200"
                              >
                                {q}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Duplicate / Non-blocking Warning Banner */}
                    {clause.warningMessage &&
                      !clause.errorMessage &&
                      (isNewContainerGroupOwner ||
                        clause.intent === 'move' ||
                        clause.intent === 'restock_display' ||
                        clause.intent === 'empty_container' ||
                        clause.intent === 'move_all' ||
                        clause.intent === 'move_container' ||
                        clause.intent === 'set_quantity' ||
                        clause.intent === 'archive_container' ||
                        clause.intent === 'delete_container' ||
                        clause.intent === 'manage_list' ||
                        clause.intent === 'manage_tag') && (
                        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{clause.warningMessage}</span>
                        </div>
                      )}

                    {/* Validation Error Banner & Zero-Dead-End Recovery Suggestions */}
                    {clause.errorMessage && (!needsAnySelection || clause.intent === 'add_container') && (
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/40 text-xs text-red-200 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <span>{clause.errorMessage}</span>
                          </div>
                          {clause.intent === 'add_container' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCommandInput(prev => {
                                  const trimmed = prev.trim();
                                  return /\bwith$/i.test(trimmed) ? `${trimmed} ` : `${trimmed} with `;
                                });
                                setTimeout(() => inputRef.current?.focus(), 20);
                              }}
                              className="min-h-[32px] px-2.5 py-1 rounded-md bg-cool-gray-900 border border-cool-gray-700 text-xs font-semibold text-white hover:border-cyan-500 cursor-pointer shrink-0"
                            >
                              + Add items
                            </button>
                          )}
                          {selectedCut &&
                            selectedCut.meatCut.quantity > 0 &&
                            clause.quantity > selectedCut.meatCut.quantity && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateOverride(clause.id, { quantity: selectedCut.meatCut.quantity })
                                }
                                className="min-h-[32px] px-2.5 py-1 rounded-md bg-cool-gray-900 border border-cool-gray-700 text-xs font-semibold text-white hover:border-cyan-500 cursor-pointer"
                              >
                                Use max ({selectedCut.meatCut.quantity})
                              </button>
                            )}
                        </div>

                        {/* Zero-Dead-End Template / New Container Recovery for Add */}
                        {clause.suggestedTemplateCandidates &&
                          clause.suggestedTemplateCandidates.length > 0 &&
                          !clause.newContainerGroupKey && (
                            <div className="space-y-1.5">
                              <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  Start as New Container
                                  {clause.suggestedFreezerId
                                    ? ` in ${
                                        (clause.suggestedFallbackFreezers || []).find(
                                          f => f.freezerId === clause.suggestedFreezerId
                                        )?.freezerName || 'selected freezer'
                                      }`
                                    : ''}
                                  :
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {clause.suggestedTemplateCandidates.map(tpl => (
                                  <button
                                    key={`sug-tpl-${tpl.templateId}`}
                                    type="button"
                                    onClick={() =>
                                      updateOverride(clause.id, {
                                        createNewContainer: true,
                                        templateId: tpl.templateId,
                                        customContainerName: tpl.isCustom ? tpl.name : undefined,
                                        freezerId: clause.suggestedFreezerId || undefined,
                                        destContainerId: null,
                                      })
                                    }
                                    className="min-h-[42px] px-3 py-2 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/45 border border-emerald-500/40 text-left transition cursor-pointer flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-white truncate">
                                        {tpl.isCustom ? `Create "${tpl.name}"` : tpl.name}
                                      </div>
                                      <div className="text-[11px] text-emerald-300/80 truncate">
                                        {tpl.isCustom ? 'New custom container' : 'From Container Template'}
                                      </div>
                                    </div>
                                    <Plus className="w-4 h-4 text-emerald-300 shrink-0" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Zero-Dead-End Product Suggestions */}
                        {clause.suggestedFallbackProducts &&
                          clause.suggestedFallbackProducts.length > 0 &&
                          clause.productCandidates.length === 0 && (
                            <div className="space-y-1.5">
                              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 shrink-0" />
                                <span>Closest products — tap to select:</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {clause.suggestedFallbackProducts.map(cand => (
                                  <button
                                    key={`sug-prod-${cand.product.id}`}
                                    type="button"
                                    onClick={() =>
                                      updateOverride(clause.id, {
                                        productId: cand.product.id,
                                        meatCutId: null,
                                      })
                                    }
                                    className="min-h-[42px] px-3 py-2 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 hover:border-cyan-500/60 text-left transition cursor-pointer flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-white truncate">
                                        {cand.product.name}
                                      </div>
                                      <div className="text-[11px] text-cool-gray-400 truncate">
                                        {cand.product.primaryCategory} · {cand.product.subCategory}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 tabular-nums">
                                      <div className="text-xs font-bold text-cyan-300">
                                        {cand.totalOnSiteQty}
                                      </div>
                                      <div className="text-[10px] text-cool-gray-500">in stock</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Zero-Dead-End Location / Container Suggestions */}
                        {clause.suggestedFallbackLocations &&
                          clause.suggestedFallbackLocations.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {clause.intent === 'add' ||
                                  (clause.intent === 'move' && clause.sourceLocationCandidates.length > 0 && clause.destLocationCandidates.length === 0)
                                    ? 'Or select an existing destination container / location:'
                                    : clause.intent === 'move_container' ||
                                      clause.intent === 'empty_container' ||
                                      clause.intent === 'move_all'
                                    ? 'Select container from active list:'
                                    : 'Available containers — tap to select:'}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {clause.suggestedFallbackLocations.map(loc => {
                                  const isDestRecovery =
                                    clause.intent === 'add' ||
                                    (clause.intent === 'move' &&
                                      clause.sourceLocationCandidates.length > 0 &&
                                      clause.destLocationCandidates.length === 0);
                                  return (
                                    <button
                                      key={`sug-loc-${loc.containerId}`}
                                      type="button"
                                      onClick={() =>
                                        updateOverride(
                                          clause.id,
                                          isDestRecovery
                                            ? { destContainerId: loc.containerId }
                                            : { sourceContainerId: loc.containerId, meatCutId: null }
                                        )
                                      }
                                      className="min-h-[42px] px-3 py-2 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 hover:border-cyan-500/60 text-left transition cursor-pointer flex items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-white truncate">
                                          {loc.containerName}
                                        </div>
                                        <div className="text-[11px] text-cool-gray-400 truncate">
                                          {loc.freezerName}
                                          {loc.hasMatchingProduct && (
                                            <span className="ml-1.5 text-emerald-300 font-semibold">
                                              · {loc.existingProductQty} in box
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* DISAMBIGUATION SECTIONS */}
                    {(needsAnySelection || isSwitcherOpen) && (
                      <div className="space-y-2.5 pt-0.5">
                        {/* 1. Product Candidates */}
                        {(clause.requiresProductSelection ||
                          (isSwitcherOpen && clause.productCandidates.length > 1)) && (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {clause.requiresProductSelection
                                  ? `Select exact product for "${clause.productQuery}" (${clause.productCandidates.length} matches)`
                                  : `Switch product (${clause.productCandidates.length} matches)`}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {clause.productCandidates.map(cand => {
                                const isSelected = clause.selectedProductId === cand.product.id;
                                return (
                                  <button
                                    key={cand.product.id}
                                    type="button"
                                    onClick={() =>
                                      updateOverride(clause.id, {
                                        productId: cand.product.id,
                                        meatCutId: null,
                                      })
                                    }
                                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                      isSelected
                                        ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                        : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">
                                        {cand.product.name}
                                      </div>
                                      <div className="text-[11px] text-cool-gray-400 truncate">
                                        {cand.product.primaryCategory} · {cand.product.subCategory}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 tabular-nums">
                                      <div className="text-xs font-bold text-cyan-300">
                                        {clause.sourceLocationQuery ? cand.locationStockQty : cand.totalOnSiteQty}
                                      </div>
                                      <div className="text-[10px] text-cool-gray-500">in stock</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2. Source Location Candidates */}
                        {(clause.requiresSourceLocationSelection ||
                          (isSwitcherOpen && clause.sourceLocationCandidates.length > 1)) && (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {clause.requiresSourceLocationSelection
                                  ? `Select source container (${clause.sourceLocationCandidates.length} matches)`
                                  : `Switch source container (${clause.sourceLocationCandidates.length} matches)`}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {clause.sourceLocationCandidates.map(loc => {
                                const isSelected = clause.selectedSourceContainerId === loc.containerId;
                                const containerStockQty =
                                  clause.selectedProductId &&
                                  (clause.intent === 'remove' ||
                                    clause.intent === 'move' ||
                                    clause.intent === 'set_quantity')
                                    ? (state.meatCuts || [])
                                        .filter(
                                          mc =>
                                            mc.productId === clause.selectedProductId &&
                                            mc.containerId === loc.containerId &&
                                            mc.quantity > 0
                                        )
                                        .reduce((sum, mc) => sum + mc.quantity, 0)
                                    : null;
                                return (
                                  <button
                                    key={loc.containerId}
                                    type="button"
                                    onClick={() =>
                                      updateOverride(clause.id, {
                                        sourceContainerId: loc.containerId,
                                        meatCutId: null,
                                      })
                                    }
                                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                      isSelected
                                        ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                        : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                                        {loc.hasPrioritized && <span className="text-amber-400 shrink-0" title="Prioritized stock">⚡</span>}
                                        <span className="truncate">{loc.containerName}</span>
                                      </div>
                                      <div className="text-[11px] text-cool-gray-400 truncate">
                                        {loc.freezerName}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {containerStockQty !== null && (
                                        <div className="text-right tabular-nums">
                                          <div className="text-xs font-bold text-white">{containerStockQty}</div>
                                          <div className="text-[10px] text-cool-gray-400">available</div>
                                        </div>
                                      )}
                                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2b. Combine / Swap Container Slot Disambiguation */}
                        {(clause.intent === 'combine_containers' || clause.intent === 'swap_containers') &&
                          clause.combineSlots?.map(slot => {
                            if (!slot.requiresSelection && !(isSwitcherOpen && slot.candidates.length > 1)) {
                              return null;
                            }
                            return (
                              <div key={`slot-${slot.slotIndex}`} className="space-y-1.5">
                                <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    Select container for "{slot.query}" ({slot.candidates.length} matches)
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {slot.candidates.map(loc => {
                                    const isSelected = slot.selectedContainerId === loc.containerId;
                                    const existingSelections = overrides[clause.id]?.combineSlotSelections || {};
                                    return (
                                      <button
                                        key={`${slot.slotIndex}-${loc.containerId}`}
                                        type="button"
                                        onClick={() =>
                                          updateOverride(clause.id, {
                                            combineSlotSelections: {
                                              ...existingSelections,
                                              [slot.slotIndex]: loc.containerId,
                                            },
                                          })
                                        }
                                        className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                          isSelected
                                            ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                            : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                        }`}
                                      >
                                        <div className="min-w-0">
                                          <div className="text-xs font-semibold truncate">
                                            {loc.containerName}
                                          </div>
                                          <div className="text-[11px] text-cool-gray-400 truncate">
                                            {loc.freezerName}
                                          </div>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                        {/* 3. Destination / Surviving Location Candidates */}
                        {(clause.requiresDestLocationSelection ||
                          (isSwitcherOpen && clause.destLocationCandidates.length > 1)) && (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {clause.intent === 'combine_containers'
                                  ? clause.requiresDestLocationSelection
                                    ? 'Select surviving container to keep all combined items'
                                    : 'Switch surviving destination container'
                                  : clause.requiresDestLocationSelection
                                  ? `Select destination container (${clause.destLocationCandidates.length} matches)`
                                  : `Switch destination container (${clause.destLocationCandidates.length} matches)`}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {clause.destLocationCandidates.map(loc => {
                                const isSelected = clause.selectedDestContainerId === loc.containerId;
                                const piecesInDest =
                                  clause.intent === 'combine_containers'
                                    ? (state.meatCuts || [])
                                        .filter(mc => mc.containerId === loc.containerId && mc.quantity > 0)
                                        .reduce((sum, mc) => sum + mc.quantity, 0)
                                    : null;
                                return (
                                  <button
                                    key={loc.containerId}
                                    type="button"
                                    onClick={() =>
                                      updateOverride(clause.id, { destContainerId: loc.containerId })
                                    }
                                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                      isSelected
                                        ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                        : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">
                                        {loc.containerName}
                                      </div>
                                      <div className="text-[11px] text-cool-gray-400 truncate">
                                        {loc.freezerName}
                                        {piecesInDest !== null && ` · ${piecesInDest} pcs inside`}
                                        {loc.hasMatchingProduct && (
                                          <span className="ml-1.5 text-emerald-300 font-semibold">
                                            · {loc.existingProductQty} already inside
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 4. Specific MeatCut Variant Stack Candidates */}
                        {(clause.requiresCutSelection ||
                          (isSwitcherOpen &&
                            !clause.requiresSourceLocationSelection &&
                            clause.cutCandidates.length > 1)) && (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {clause.intent === 'restock_display'
                                  ? `Prefer backstock source stack (${clause.cutCandidates.length} available)`
                                  : `Select package stack (${clause.cutCandidates.length} variants in location)`}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                              {clause.cutCandidates.map(cc => {
                                const isSelected = clause.selectedMeatCutId === cc.meatCut.id;
                                const isPrioritizedStack = cc.tags.some(t => t.prioritizeItem);
                                return (
                                  <button
                                    key={cc.meatCut.id}
                                    type="button"
                                    onClick={() =>
                                      updateOverride(clause.id, { meatCutId: cc.meatCut.id })
                                    }
                                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                                      isSelected
                                        ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                        : isPrioritizedStack
                                        ? 'bg-amber-950/20 hover:bg-amber-950/35 border-amber-500/40 text-cool-gray-100'
                                        : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                                        {isPrioritizedStack && (
                                          <span className="text-amber-300 shrink-0" title="Prioritized item">⚡</span>
                                        )}
                                        <span className="truncate">{cc.locationLabel}</span>
                                      </div>
                                      <div className="text-[11px] text-cool-gray-400 truncate">
                                        {cc.meatCut.notes ? `Notes: ${cc.meatCut.notes}` : 'Standard stack'}
                                        {cc.tags.length > 0 && ` · Tags: ${cc.tags.map(t => t.name).join(', ')}`}
                                        {cc.meatCut.packDate && ` · Pack: ${cc.meatCut.packDate}`}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 tabular-nums">
                                      <div className="text-xs font-bold text-white">{cc.meatCut.quantity}</div>
                                      <div className="text-[10px] text-cool-gray-400">available</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 4b. Custom List Selection */}
                        {(clause.requiresListSelection ||
                          (isSwitcherOpen && (clause.listCandidates?.length || 0) > 1)) && (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                              <ListIcon className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {clause.requiresListSelection
                                  ? `Select custom list (${clause.listCandidates?.length || 0} options)`
                                  : 'Switch custom list'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {(clause.listCandidates || []).map(cand => {
                                const isSelected = clause.selectedListId === cand.list.id;
                                return (
                                  <button
                                    key={cand.list.id}
                                    type="button"
                                    onClick={() => updateOverride(clause.id, { listId: cand.list.id })}
                                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                      isSelected
                                        ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                        : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">{cand.list.name}</div>
                                      <div className="text-[11px] text-cool-gray-400 truncate">
                                        {cand.list.items.length} item{cand.list.items.length === 1 ? '' : 's'}
                                      </div>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 4c. Tag Selection */}
                        {(clause.requiresTagSelection ||
                          (isSwitcherOpen && (clause.tagCandidates?.length || 0) > 1)) && (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                              <TagIcon className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {clause.requiresTagSelection
                                  ? `Select tag (${clause.tagCandidates?.length || 0} matches)`
                                  : 'Switch tag'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {(clause.tagCandidates || []).map(cand => {
                                const isSelected = clause.selectedTagId === cand.tag.id;
                                return (
                                  <button
                                    key={cand.tag.id}
                                    type="button"
                                    onClick={() => updateOverride(clause.id, { tagId: cand.tag.id })}
                                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                      isSelected
                                        ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                        : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                    }`}
                                  >
                                    <span className="text-xs font-semibold truncate">{cand.tag.name}</span>
                                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 4d. Replacement Product Selection (Correct Label) */}
                        {clause.intent === 'correct_label' &&
                          (clause.requiresReplacementProductSelection ||
                            (isSwitcherOpen && (clause.replacementProductCandidates?.length || 0) > 1)) && (
                            <div className="space-y-1.5">
                              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {clause.replacementProductQuery
                                    ? `Select replacement product for "${clause.replacementProductQuery}"`
                                    : 'Select correct replacement product label'}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                                {(clause.replacementProductCandidates || []).map(cand => {
                                  const isSelected = clause.selectedReplacementProductId === cand.product.id;
                                  return (
                                    <button
                                      key={cand.product.id}
                                      type="button"
                                      onClick={() =>
                                        updateOverride(clause.id, {
                                          replacementProductId: cand.product.id,
                                        })
                                      }
                                      className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                        isSelected
                                          ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                          : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold truncate">
                                          {cand.product.name}
                                        </div>
                                        <div className="text-[11px] text-cool-gray-400 truncate">
                                          {cand.product.primaryCategory} · {cand.product.subCategory}
                                        </div>
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        {/* 5. New Container Template vs Custom Selection */}
                        {isNewContainerGroupOwner &&
                          (clause.requiresTemplateSelection ||
                            (isSwitcherOpen && (clause.templateCandidates?.length || 0) > 1)) && (
                            <div className="space-y-1.5">
                              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {clause.requiresTemplateSelection
                                    ? `Select container template or custom container for "${clause.newContainerNameQuery}"`
                                    : 'Switch container template or custom name'}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {(clause.templateCandidates || []).map(tpl => {
                                  const isSelected = clause.selectedTemplateId === tpl.templateId;
                                  return (
                                    <button
                                      key={tpl.templateId}
                                      type="button"
                                      onClick={() =>
                                        updateOverride(
                                          clause.id,
                                          { templateId: tpl.templateId },
                                          clause.newContainerGroupKey
                                        )
                                      }
                                      className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                        isSelected
                                          ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                          : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold truncate">{tpl.name}</div>
                                        <div className="text-[11px] text-cool-gray-400 truncate">
                                          {tpl.isCustom ? 'New custom container' : 'From Container Template'}
                                        </div>
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                        {/* 6. Target Freezer Selection (New Container OR Move Container) */}
                        {(isNewContainerGroupOwner || clause.intent === 'move_container') &&
                          (clause.requiresFreezerSelection ||
                            (isSwitcherOpen && (clause.freezerCandidates?.length || 0) > 1)) && (
                            <div className="space-y-1.5">
                              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {clause.requiresFreezerSelection
                                    ? `Select target freezer${
                                        clause.newContainerFreezerQuery || clause.destLocationQuery
                                          ? ` for "${clause.newContainerFreezerQuery || clause.destLocationQuery}"`
                                          : ''
                                      }`
                                    : 'Switch target freezer'}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {(clause.freezerCandidates || []).map(f => {
                                  const isSelected = clause.selectedFreezerId === f.freezerId;
                                  return (
                                    <button
                                      key={f.freezerId}
                                      type="button"
                                      onClick={() =>
                                        updateOverride(
                                          clause.id,
                                          { freezerId: f.freezerId },
                                          clause.newContainerGroupKey
                                        )
                                      }
                                      className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                        isSelected
                                          ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                          : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold truncate">{f.freezerName}</div>
                                        <div className="text-[11px] text-cool-gray-400 truncate">
                                          {f.isStaging ? 'Unassigned / Staging' : f.isDisplay ? 'Display Freezer' : 'On-site Freezer'}
                                        </div>
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Condensed Recent Commands & Sample Phrases (out of the way of active workflow) */}
      <div className="pt-2 border-t border-cool-gray-800/80 space-y-2.5">
        {recentCommands.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-cool-gray-400 mr-1">Recent:</span>
            {recentCommands.map((cmd, idx) => (
              <button
                key={`${idx}-${cmd}`}
                type="button"
                onClick={() => handleSelectExample(cmd)}
                className="max-w-[260px] truncate px-2.5 py-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-800 hover:border-cyan-500/40 text-cool-gray-300 hover:text-cyan-300 transition cursor-pointer"
                title={cmd}
              >
                {cmd}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setRecentCommands([]);
                try {
                  localStorage.removeItem(RECENT_COMMANDS_STORAGE_KEY);
                } catch {
                  // ignore
                }
              }}
              className="px-2 py-1 text-[11px] text-cool-gray-500 hover:text-cool-gray-300 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* [TEMP] Temporary button to save the prompt box text + optional notes (just above Sample phrases) */}
        <TempVoicePromptRecorder
          promptText={effectiveTranscript}
          parserSummary={tempPromptStatus.summary}
          hasFailureOrWarning={tempPromptStatus.hasIssue}
          onLoadPrompt={handleSelectExample}
        />

        <div className="bg-cool-gray-900/60 border border-cool-gray-800 rounded-xl p-3">
          <button
            type="button"
            onClick={() => setShowExamples(prev => !prev)}
            className="w-full text-xs font-semibold text-cool-gray-300 hover:text-cyan-300 flex items-center justify-between gap-2 cursor-pointer py-0.5"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Sample phrases &amp; full command guide</span>
              <span className="text-[11px] font-normal text-cool-gray-500">
                ({SAMPLE_PHRASE_SECTIONS.reduce((sum, sec) => sum + sec.items.length, 0)} examples across{' '}
                {SAMPLE_PHRASE_SECTIONS.length} categories)
              </span>
            </span>
            {showExamples ? (
              <ChevronUp className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" />
            )}
          </button>

          {showExamples && (
            <div className="mt-3 space-y-3 border-t border-cool-gray-800 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-cool-gray-400">
                  Tap any phrase below to load it into the command box. Chain multiple commands with{' '}
                  <strong className="text-cool-gray-200">"and"</strong>,{' '}
                  <strong className="text-cool-gray-200">"then"</strong>,{' '}
                  <strong className="text-cool-gray-200">;</strong>, or separate lines.
                </p>
                {onOpenVoiceDictionary && (
                  <button
                    type="button"
                    onClick={onOpenVoiceDictionary}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-[11px] font-semibold text-cyan-300 transition cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Customize in Voice Dictionary</span>
                  </button>
                )}
              </div>

              {/* Section Filter Strip */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedExampleCategory('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    selectedExampleCategory === 'all'
                      ? 'bg-cyan-600/20 border-cyan-400/60 text-cyan-200'
                      : 'bg-cool-gray-850 border-cool-gray-800 text-cool-gray-400 hover:text-cool-gray-200'
                  }`}
                >
                  All Categories
                </button>
                {SAMPLE_PHRASE_SECTIONS.map(section => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSelectedExampleCategory(section.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                      selectedExampleCategory === section.id
                        ? section.badgeClass
                        : 'bg-cool-gray-850 border-cool-gray-800 text-cool-gray-400 hover:text-cool-gray-200'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>

              {/* Categorized Example Cards */}
              <div className="space-y-3">
                {SAMPLE_PHRASE_SECTIONS.filter(
                  sec => selectedExampleCategory === 'all' || sec.id === selectedExampleCategory
                ).map(section => (
                  <div
                    key={section.id}
                    className="rounded-xl bg-cool-gray-950/60 border border-cool-gray-800/90 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${section.headingClass}`}>
                        {section.title}
                      </h3>
                      <span className="text-[11px] text-cool-gray-500">{section.description}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {section.items.map(item => (
                        <button
                          key={`${section.id}-${item.label}`}
                          type="button"
                          onClick={() => handleSelectExample(item.command)}
                          title={item.command}
                          className="text-left px-2.5 py-2 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-800 hover:border-cyan-500/40 transition cursor-pointer space-y-0.5"
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-cool-gray-400">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-cool-gray-200 hover:text-white leading-snug break-words">
                            "{item.command.replace(/\n/g, ' ↵ ')}"
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sticky Bottom Confirmation Bar (<= 15% mobile height) */}
      {activeMutationClauses.length > 0 && (
        <div
          id="voice-mobile-confirm-bar"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900 bg-[var(--ha-bg-card,#1f2937)] border-t border-cool-gray-700 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] px-4 py-2 flex items-center justify-between gap-3"
        >
          <div className="text-xs text-cool-gray-300 tabular-nums">
            <span className="font-bold text-white">{parsedResult.readyMutationCount}</span>/{activeMutationClauses.length} ready
            {parsedResult.pendingSelectionCount > 0 && (
              <span className="block text-[11px] text-amber-400">
                Select highlighted options
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={!canConfirmApply}
            onClick={handleConfirmApply}
            className={`min-h-[42px] px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0 ${
              canConfirmApply
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
                : 'bg-cool-gray-800 text-cool-gray-500 border border-cool-gray-700 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isApplying ? 'Applying...' : 'Confirm & Apply'}</span>
          </button>
        </div>
      )}

      {/* Full Normal New Container Form Modal (Option for photos, template selection, save-as-template, spare reuse) */}
      {editingContainerClause && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingContainerGroupClauseId(null)}
        >
          <div
            className="w-full max-w-lg bg-cool-gray-800 border border-cool-gray-700 rounded-xl shadow-2xl overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-cool-gray-700 bg-cool-gray-850">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  Configure New Container
                </h3>
                <p className="text-[11px] text-cool-gray-400 truncate">
                  Add a photo, choose or save a template, or reuse a spare container
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingContainerGroupClauseId(null)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-cool-gray-400 hover:text-white hover:bg-cool-gray-700 transition cursor-pointer"
                aria-label="Close container form"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 sm:p-4 max-h-[80vh] overflow-y-auto">
              <AddForms.ContainerForm
                dispatch={dispatch}
                state={state}
                onClose={() => setEditingContainerGroupClauseId(null)}
                freezerId={
                  editingContainerClause.selectedFreezerId &&
                  editingContainerClause.selectedFreezerId !== '__staging__'
                    ? editingContainerClause.selectedFreezerId
                    : ''
                }
                initialName={editingContainerClause.resolvedNewContainerName || ''}
                initialTemplateId={
                  editingContainerClause.selectedTemplateId &&
                  editingContainerClause.selectedTemplateId !== '__custom__'
                    ? editingContainerClause.selectedTemplateId
                    : ''
                }
                initialSaveAsTemplate={Boolean(editingContainerClause.newContainerSaveAsTemplate)}
                initialImageUrl={editingContainerClause.newContainerImageUrl || ''}
                initialIcon={editingContainerClause.newContainerIcon || 'generic'}
                draftSubmitLabel="Apply Container Options"
                onSubmitDraft={(draft: ContainerDraftValues) => {
                  updateOverride(
                    editingContainerClause.id,
                    {
                      customContainerName: draft.name,
                      freezerId: draft.freezerId || '__staging__',
                      templateId: draft.existingSpareContainerId
                        ? editingContainerClause.selectedTemplateId || '__custom__'
                        : draft.templateId || '__custom__',
                      saveAsTemplate: draft.saveAsTemplate,
                      containerImageUrl: draft.imageUrl || '',
                      containerIcon: draft.icon,
                      existingSpareContainerId: draft.existingSpareContainerId,
                    },
                    editingContainerClause.newContainerGroupKey
                  );
                  setEditingContainerGroupClauseId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceControlView;

