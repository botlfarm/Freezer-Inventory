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
} from 'lucide-react';
import { Action, InventoryState } from '../types';
import AddForms, { ContainerDraftValues } from '../components/AddForms';
import {
  parseVoiceTranscript,
  buildVoiceDispatchActions,
  ParsedVoiceClause,
  VoiceSelectionOverrides,
} from '../utils/voiceCommandParser';

interface VoiceControlViewProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  onNavigateToProduct: (productId: string) => void;
  onNavigateToFreezer: (containerId: string) => void;
  onTriggerUndo?: () => void;
  onOpenVoiceDictionary?: () => void;
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
      { label: 'Multi-item sale list', command: 'remove 2 brats, 1 belly, 3 ground pork and 1 chicken broth from display' },
      { label: 'Spoken numbers & synonyms', command: 'sold three belly fresh from display' },
      { label: 'Remove all remaining', command: 'remove all brats from display' },
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
      { label: 'Move to Staging Area', command: 'move 3 pork belly from chest freezer to staging' },
      { label: 'Same-line location header', command: 'Move to display: 2 hotdogs from orange in canada, 3 ribs from chest freezer' },
    ],
  },
  {
    id: 'add_create',
    title: 'Adding Items & New Containers',
    description: 'Restock existing bins or strictly create new containers/templates with items.',
    badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/35',
    headingClass: 'text-emerald-300',
    items: [
      { label: 'Restock existing location', command: 'add 5 pork chops to display' },
      { label: 'New container + items', command: 'add container yellow bag in freezer canada with 4 liverwurst' },
      { label: 'New container from template', command: 'add container from template yellow bag in chest freezer with 3 ribeye' },
      { label: 'Inbound into new container', command: 'inbound 4 ribeye, 2 brisket into new container red tote in canada' },
      { label: 'Multi-line new container', command: 'Add container blue bin in chest freezer:\n- 4 ribeye\n- 2 ground beef' },
      { label: 'Shorthand labels (w/, w/o, &)', command: 'add 2 boneless chicken breast to red tote with lid' },
    ],
  },
  {
    id: 'containers',
    title: 'Container Moves, Emptying & Combining',
    description: 'Unload whole containers, move intact containers between freezers, or merge bins.',
    badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-500/35',
    headingClass: 'text-purple-300',
    items: [
      { label: 'Empty container to Staging', command: 'empty container orange in canada' },
      { label: 'Unload container to Display', command: 'unload orange in canada to display' },
      { label: 'Move all contents to another bin', command: 'move all of container orange in canada to blue tote' },
      { label: 'Move whole container to freezer', command: 'move container blue tote to chest freezer' },
      { label: 'Relocate container to Staging', command: 'relocate orange in canada to staging' },
      { label: 'Combine (pick survivor)', command: 'combine containers orange in canada and blue tote' },
      { label: 'Merge directionally into target', command: 'merge orange in canada into blue tote' },
      { label: 'Combine multiple into target', command: 'combine orange in canada and red bag into blue tote' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Checks & Container Lookups',
    description: 'Instant read-only queries — never alters inventory or touches off-site/butcher.',
    badgeClass: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/35',
    headingClass: 'text-cyan-300',
    items: [
      { label: 'Product stock total', command: 'how many pork liver do I have?' },
      { label: 'Product stock in location', command: 'how many brats are in display?' },
      { label: 'Locate product across freezers', command: 'where are pork belly?' },
      { label: 'Where is a container', command: 'where is red bag' },
      { label: 'Count matching containers', command: 'how many green bags are in freezer 1' },
      { label: 'List containers in freezer', command: 'what containers are in freezer 1' },
      { label: 'Inspect container contents', command: "what's in orange in canada" },
    ],
  },
  {
    id: 'chaining',
    title: 'Chaining, Dictation & Shortcuts',
    description: 'Chain actions, speak naturally, or define custom shortcuts in Voice Dictionary.',
    badgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/35',
    headingClass: 'text-indigo-300',
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
    case 'container_query':
      return {
        label: 'Container Contents',
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
    items: string[];
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
            c.intent === 'add_container' ||
            c.intent === 'empty_container' ||
            c.intent === 'move_all' ||
            c.intent === 'move_container' ||
            c.intent === 'combine_containers')
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
        c => !c.excluded && (c.intent === 'query' || c.intent === 'container_query')
      ),
    [parsedResult.clauses]
  );

  const unknownClauses = useMemo(
    () => parsedResult.clauses.filter(c => !c.excluded && c.intent === 'unknown'),
    [parsedResult.clauses]
  );

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

    const summaryLines: string[] = [];
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
        summaryLines.push(`${verb} ${srcLabel} (${pieceTotal} pcs) to ${dstLabel}`);
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
        summaryLines.push(`Moved container ${srcLabel} to ${freezerLabel}`);
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
        summaryLines.push(
          `Combined ${absorbedLabels.join(', ')} (${pieceTotal} pcs) into ${dstLabel}`
        );
        continue;
      }

      if (c.newContainerGroupKey) {
        const contName = c.resolvedNewContainerName || c.newContainerNameQuery || 'New Container';
        const freezerLabel =
          (c.freezerCandidates || []).find(f => f.freezerId === c.selectedFreezerId)?.freezerName ||
          'Staging Area';
        if (!loggedNewContainerGroups.has(c.newContainerGroupKey)) {
          loggedNewContainerGroups.add(c.newContainerGroupKey);
          const chosenTpl = (c.templateCandidates || []).find(
            t => t.templateId === c.selectedTemplateId && !t.isCustom
          );
          if (c.selectedExistingSpareContainerId) {
            summaryLines.push(`Placed existing container ${contName} in ${freezerLabel}`);
          } else if (c.newContainerSaveAsTemplate) {
            summaryLines.push(`Created container & template ${contName} in ${freezerLabel}`);
          } else {
            summaryLines.push(
              `Created container ${contName}${chosenTpl ? ' (from template)' : ''} in ${freezerLabel}`
            );
          }
        }
        if (c.intent === 'add') {
          const prodName =
            c.productCandidates.find(p => p.product.id === c.selectedProductId)?.product.name || c.productQuery;
          summaryLines.push(`Added ${c.quantity}x ${prodName} to ${contName} (${freezerLabel})`);
        }
        continue;
      }

      const prodName =
        c.productCandidates.find(p => p.product.id === c.selectedProductId)?.product.name || c.productQuery;
      if (c.intent === 'remove') {
        const srcLabel =
          c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId)?.label ||
          c.sourceLocationQuery ||
          'on-site';
        summaryLines.push(`Removed ${c.quantity}x ${prodName} from ${srcLabel}`);
      } else if (c.intent === 'move') {
        const srcLabel =
          c.sourceLocationCandidates.find(l => l.containerId === c.selectedSourceContainerId)?.label ||
          c.sourceLocationQuery ||
          'source';
        const dstLabel =
          c.destLocationCandidates.find(l => l.containerId === c.selectedDestContainerId)?.label ||
          c.destLocationQuery ||
          'destination';
        summaryLines.push(`Moved ${c.quantity}x ${prodName} from ${srcLabel} to ${dstLabel}`);
      } else {
        const dstLabel =
          c.destLocationCandidates.find(l => l.containerId === c.selectedDestContainerId)?.label ||
          c.destLocationQuery ||
          'destination';
        summaryLines.push(`Added ${c.quantity}x ${prodName} to ${dstLabel}`);
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
              <ul className="space-y-0.5 text-xs text-cool-gray-200 pl-6 list-disc">
                {appliedSummary.items.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
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
                        <span className="tabular-nums shrink-0">
                          {clause.containerQueryResults?.length || 0} container
                          {(clause.containerQueryResults?.length || 0) === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    {(!clause.containerQueryResults || clause.containerQueryResults.length === 0) && (
                      <div
                        className={`p-2.5 rounded-lg bg-cool-gray-850 border border-cool-gray-800 text-xs flex items-center gap-2 ${
                          clause.errorMessage ? 'text-amber-300' : 'text-cool-gray-300'
                        }`}
                      >
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
                    )}

                    {clause.containerQueryResults && clause.containerQueryResults.length > 0 && (
                      <div className="divide-y divide-cool-gray-800">
                        {clause.containerQueryResults.map(res => (
                          <div key={res.containerId} className="py-2.5 first:pt-0.5 last:pb-0.5 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-bold text-white">{res.containerName}</span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/35 text-[11px] font-semibold text-cyan-300">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    {res.freezerName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-cool-gray-400 mt-0.5">
                                  {res.items.length} item line{res.items.length === 1 ? '' : 's'} · {res.totalPieces} total piece{res.totalPieces === 1 ? '' : 's'}
                                </div>
                              </div>
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
                                    onClick={() => onNavigateToProduct(item.product.id)}
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
                ) : (
                  <div
                    key={clause.id}
                    className="bg-cool-gray-900 border border-cyan-500/35 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-cool-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Stock check: <strong className="text-white">"{clause.productQuery}"</strong>
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
                      <div className="p-2.5 rounded-lg bg-cool-gray-850 border border-cool-gray-800 text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{clause.errorMessage || `No on-site products matched "${clause.productQuery}".`}</span>
                      </div>
                    )}

                    {clause.queryResults && clause.queryResults.length > 0 && (
                      <div className="divide-y divide-cool-gray-800">
                        {clause.queryResults.map(res => (
                          <div key={res.product.id} className="py-2.5 first:pt-0.5 last:pb-0.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-white">{res.product.name}</div>
                                <div className="text-[11px] text-cool-gray-400">
                                  {res.product.primaryCategory} · {res.product.subCategory}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-right">
                                  <div className="text-lg font-bold text-cyan-400 tabular-nums leading-none">
                                    {res.totalQuantity}
                                  </div>
                                  <div className="text-[10px] text-cool-gray-400">on-site</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onNavigateToProduct(res.product.id)}
                                  title="Open in Products view"
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
                                    onClick={() => onNavigateToFreezer(loc.containerId)}
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
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Unrecognized Clauses Warning */}
          {unknownClauses.length > 0 && (
            <div className="bg-cool-gray-900 border border-amber-500/40 rounded-xl p-3 space-y-2">
              {unknownClauses.map(clause => (
                <div key={clause.id} className="flex items-start justify-between gap-2 text-xs">
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
              ))}
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
                const isNewContainerGroupOwner = Boolean(
                  clause.newContainerGroupKey && firstActiveNewContainerClauseIds.has(clause.id)
                );

                const isBulkContainerOp =
                  clause.intent === 'empty_container' ||
                  clause.intent === 'move_all' ||
                  clause.intent === 'move_container' ||
                  clause.intent === 'combine_containers';

                const isSwitcherOpen = Boolean(expandedSwitcherIds[clause.id]);
                const hasCombineSlotSelectionNeeded = Boolean(
                  clause.combineSlots?.some(s => s.requiresSelection)
                );
                const needsAnySelection =
                  clause.requiresProductSelection ||
                  clause.requiresSourceLocationSelection ||
                  clause.requiresDestLocationSelection ||
                  clause.requiresCutSelection ||
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

                const currentCutQty = selectedCut?.meatCut.quantity ?? null;
                const projectedAfterQty =
                  currentCutQty !== null && (clause.intent === 'remove' || clause.intent === 'move')
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
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className={`font-bold uppercase tracking-wider ${meta.accentText}`}>
                            {meta.label}
                          </span>
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
                            <span>
                              Create "{clause.resolvedNewContainerName || clause.newContainerNameQuery}"
                            </span>
                          ) : clause.intent === 'empty_container' ? (
                            <span>
                              Empty {selectedSourceLoc ? selectedSourceLoc.label : `"${clause.sourceLocationQuery}"`}
                            </span>
                          ) : clause.intent === 'move_all' ? (
                            <span>
                              Move all contents of{' '}
                              {selectedSourceLoc ? selectedSourceLoc.label : `"${clause.sourceLocationQuery}"`}
                            </span>
                          ) : clause.intent === 'move_container' ? (
                            <span>
                              Move container{' '}
                              {selectedSourceLoc ? selectedSourceLoc.label : `"${clause.sourceLocationQuery}"`}
                            </span>
                          ) : clause.intent === 'combine_containers' ? (
                            <span>Combine {selectedCombineNames}</span>
                          ) : (
                            <>
                              <span className="tabular-nums">
                                {clause.intent === 'remove'
                                  ? `-${clause.quantity}`
                                  : clause.intent === 'add'
                                  ? `+${clause.quantity}`
                                  : clause.quantity}
                                x
                              </span>
                              <span>
                                {selectedProduct
                                  ? selectedProduct.product.name
                                  : `"${clause.productQuery}"`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper (item mutations only) + Remove Line */}
                      <div className="flex items-center gap-1 shrink-0">
                        {clause.intent !== 'add_container' && !isBulkContainerOp && (
                          <>
                            <button
                              type="button"
                              data-action="decrement"
                              aria-label="Decrease quantity"
                              onClick={() =>
                                updateOverride(clause.id, { quantity: Math.max(1, clause.quantity - 1) })
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
                    {(clause.isValid || isNewContainerGroupOwner || isBulkContainerOp) && (
                      <div className="space-y-1.5 px-2.5 py-2 rounded-lg bg-cool-gray-850/90 border border-cool-gray-800 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-cool-gray-200 min-w-0">
                            {clause.intent === 'remove' && selectedSourceLoc && (
                              <>
                                <span className="text-cool-gray-400">From:</span>
                                <span className="font-semibold text-white">{selectedSourceLoc.label}</span>
                              </>
                            )}
                            {clause.intent === 'move' && selectedSourceLoc && selectedDestLoc && (
                              <>
                                <span className="font-semibold text-white">{selectedSourceLoc.label}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="font-semibold text-white">{selectedDestLoc.label}</span>
                              </>
                            )}
                            {(clause.intent === 'empty_container' || clause.intent === 'move_all') && (
                              <>
                                <span className="font-semibold text-white">
                                  {selectedSourceLoc?.label || clause.sourceLocationQuery || 'Select source'}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="font-semibold text-cyan-300">
                                  {selectedDestLoc?.label ||
                                    clause.destLocationQuery ||
                                    'Select destination'}
                                </span>
                              </>
                            )}
                            {clause.intent === 'move_container' && (
                              <>
                                <span className="font-semibold text-white">
                                  {selectedSourceLoc?.label || clause.sourceLocationQuery || 'Select container'}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="font-semibold text-cyan-300">
                                  {selectedNewFreezer?.freezerName ||
                                    clause.destLocationQuery ||
                                    'Select freezer'}
                                </span>
                              </>
                            )}
                            {clause.intent === 'combine_containers' && (
                              <>
                                <span className="text-cool-gray-400">Keep into:</span>
                                <span className="font-semibold text-purple-300">
                                  {selectedDestLoc?.label || 'Choose surviving container below'}
                                </span>
                              </>
                            )}
                            {clause.intent === 'add' && !clause.newContainerGroupKey && selectedDestLoc && (
                              <>
                                <span className="text-cool-gray-400">To:</span>
                                <span className="font-semibold text-white">{selectedDestLoc.label}</span>
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
                                <span className="font-semibold text-white">
                                  {clause.resolvedNewContainerName || clause.newContainerNameQuery}
                                  {clause.selectedExistingSpareContainerId
                                    ? ' (Spare Pool)'
                                    : clause.newContainerSaveAsTemplate
                                    ? ' (Save as Template)'
                                    : selectedNewTemplate && !selectedNewTemplate.isCustom
                                    ? ' (Template)'
                                    : ' (Custom)'}
                                </span>
                                {clause.newContainerImageUrl && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-cyan-300">
                                    <ImageIcon className="w-3 h-3" />
                                    Photo
                                  </span>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="font-semibold text-cyan-300">
                                  {selectedNewFreezer?.freezerName || 'Staging Area'}
                                </span>
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
                              clause.cutCandidates.length > 1 ||
                              hasContainerSwitcherOptions ||
                              hasCombineSlotSwitcherOptions) && (
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
                                {clause.intent === 'move_container' ? 'Carrying:' : 'Moving:'}
                              </span>
                              {clause.containerCutPreviews.map((item, idx) => (
                                <span
                                  key={`${item.meatCut.id}-${idx}`}
                                  className="px-2 py-0.5 rounded bg-cool-gray-900 border border-cool-gray-750 text-[11px] text-cool-gray-200 tabular-nums"
                                >
                                  <strong className="text-white">{item.quantity}x</strong> {item.product.name}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Duplicate / Non-blocking Warning Banner */}
                    {clause.warningMessage &&
                      !clause.errorMessage &&
                      (isNewContainerGroupOwner || clause.intent === 'move_container') && (
                        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{clause.warningMessage}</span>
                        </div>
                      )}

                    {/* Validation Error Banner */}
                    {clause.errorMessage && (!needsAnySelection || clause.intent === 'add_container') && (
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
                        )}

                        {/* 2b. Combine Container Slot Disambiguation */}
                        {clause.intent === 'combine_containers' &&
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
                          (isSwitcherOpen && clause.cutCandidates.length > 1)) && (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Select package stack ({clause.cutCandidates.length} variants in location)
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                              {clause.cutCandidates.map(cc => {
                                const isSelected = clause.selectedMeatCutId === cc.meatCut.id;
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
                                        : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate">
                                        {cc.locationLabel}
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
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-cool-gray-900/95 border-t border-cool-gray-700 px-4 py-2 flex items-center justify-between gap-3">
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

