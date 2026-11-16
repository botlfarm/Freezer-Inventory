// [TEMP] Temporary component for recording voice prompts that didn't parse or work as expected,
// along with an optional notes field and lightweight review/export list.
// Safe to delete this entire component (and its single import/tag in views/VoiceControlView.tsx)
// once the voice model is built out.
import React, { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit2,
  MessageSquarePlus,
  RotateCcw,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  TempVoicePromptEntry,
  clearAllTempVoicePrompts,
  deleteTempVoicePromptById,
  fetchTempVoicePrompts,
  formatTempVoicePromptsForCopy,
  saveTempVoicePrompt,
  updateTempVoicePromptNote,
} from '../utils/tempVoicePromptLog';

interface TempVoicePromptRecorderProps {
  promptText: string;
  parserSummary: string;
  hasFailureOrWarning: boolean;
  onLoadPrompt: (prompt: string) => void;
}

export const TempVoicePromptRecorder: React.FC<TempVoicePromptRecorderProps> = ({
  promptText,
  parserSummary,
  hasFailureOrWarning,
  onLoadPrompt,
}) => {
  const [entries, setEntries] = useState<TempVoicePromptEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Active post-save state: shows the optional notes field as soon as Save Prompt is clicked
  const [justSavedEntry, setJustSavedEntry] = useState<TempVoicePromptEntry | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);

  // Saved prompts drawer state
  const [showSavedList, setShowSavedList] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const noteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetchTempVoicePrompts().then(list => {
      if (active) setEntries(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSavePrompt = async () => {
    const clean = promptText.trim();
    if (!clean || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setNoteSavedNotice(false);
    try {
      const result = await saveTempVoicePrompt({
        prompt: clean,
        parserSummary,
      });
      if (result.error && !result.entry) {
        setSaveError(result.error);
        return;
      }
      setEntries(result.entries);
      if (result.entry) {
        setJustSavedEntry(result.entry);
        setNoteDraft(result.entry.notes || '');
        setTimeout(() => noteInputRef.current?.focus(), 40);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveActiveNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!justSavedEntry || isSavingNote) return;

    setIsSavingNote(true);
    setSaveError(null);
    try {
      const res = await updateTempVoicePromptNote(justSavedEntry.id, noteDraft);
      if (res.error) {
        setSaveError(res.error);
        return;
      }
      setEntries(res.entries);
      if (res.entry) {
        setJustSavedEntry(res.entry);
      }
      setNoteSavedNotice(true);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSaveInlineListNote = async (entryId: string) => {
    const res = await updateTempVoicePromptNote(entryId, editingNoteDraft);
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    setEntries(res.entries);
    if (justSavedEntry?.id === entryId && res.entry) {
      setJustSavedEntry(res.entry);
      setNoteDraft(res.entry.notes || '');
    }
    setEditingEntryId(null);
    setEditingNoteDraft('');
  };

  const handleDeleteEntry = async (id: string) => {
    const next = await deleteTempVoicePromptById(id);
    setEntries(next);
    if (justSavedEntry?.id === id) {
      setJustSavedEntry(null);
      setNoteDraft('');
    }
    if (editingEntryId === id) {
      setEditingEntryId(null);
      setEditingNoteDraft('');
    }
  };

  const handleClearAll = async () => {
    const next = await clearAllTempVoicePrompts();
    setEntries(next);
    setJustSavedEntry(null);
    setNoteDraft('');
    setEditingEntryId(null);
    setConfirmClearAll(false);
  };

  const handleCopyAll = async () => {
    const formatted = formatTempVoicePromptsForCopy(entries);
    if (!formatted) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(formatted);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      }
    } catch {
      setSaveError('Clipboard copy failed — use Export JSON instead.');
    }
  };

  const handleExportJson = () => {
    if (entries.length === 0) return;
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-prompt-cases-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasPromptText = promptText.trim().length > 0;

  return (
    <div className="bg-cool-gray-900/60 border border-cool-gray-800 rounded-xl p-3 space-y-2" data-testid="temp-voice-prompt-recorder">
      {/* Compact Save Prompt + Saved Count Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleSavePrompt}
          disabled={!hasPromptText || isSaving}
          title={
            hasPromptText
              ? 'Temporarily save this prompt to refine the voice model later'
              : 'Type or dictate a prompt first to save it'
          }
          className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            hasPromptText && hasFailureOrWarning
              ? 'bg-amber-950/50 hover:bg-amber-900/60 border-amber-500/45 text-amber-200'
              : 'bg-cool-gray-850 hover:bg-cool-gray-800 border-cool-gray-700 text-cool-gray-200'
          }`}
        >
          <BookmarkPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{isSaving ? 'Saving...' : 'Save Prompt'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowSavedList(prev => !prev);
            setConfirmClearAll(false);
          }}
          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-cool-gray-950/80 hover:bg-cool-gray-850 border border-cool-gray-800 text-[11px] font-semibold text-cool-gray-300 flex items-center gap-1.5 transition cursor-pointer"
        >
          <span>Saved Prompts</span>
          <span className="px-1.5 py-0.2 rounded bg-cool-gray-800 text-cyan-300 tabular-nums font-bold">
            {entries.length}
          </span>
          {showSavedList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {saveError && (
        <div className="px-2.5 py-1.5 rounded-lg bg-red-950/40 border border-red-500/40 text-[11px] text-red-200 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>{saveError}</span>
          </span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-cool-gray-400 hover:text-white cursor-pointer"
            aria-label="Dismiss save error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Post-Save Confirmation + Optional Notes Field */}
      {justSavedEntry && (
        <form
          onSubmit={handleSaveActiveNote}
          className="rounded-lg bg-cool-gray-950 border border-amber-500/35 p-2.5 space-y-2 animate-fade-in"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Prompt saved{justSavedEntry.offlineOnly ? ' (local offline cache)' : ''}
                </span>
              </div>
              <p className="text-xs text-cool-gray-200 break-words">
                &ldquo;{justSavedEntry.prompt}&rdquo;
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setJustSavedEntry(null);
                setNoteDraft('');
                setNoteSavedNotice(false);
              }}
              className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 cursor-pointer shrink-0"
              aria-label="Close saved prompt note box"
              title="Done"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="temp-voice-prompt-notes"
              className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400"
            >
              Optional Notes
            </label>
            <div className="flex items-center gap-1.5">
              <input
                ref={noteInputRef}
                id="temp-voice-prompt-notes"
                type="text"
                value={noteDraft}
                onChange={e => {
                  setNoteDraft(e.target.value);
                  setNoteSavedNotice(false);
                }}
                placeholder="What should this have done? (optional)"
                className="flex-1 min-w-0 rounded-md bg-cool-gray-900 border border-cool-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 px-2.5 py-1.5 text-xs text-white placeholder:text-cool-gray-500"
              />
              <button
                type="submit"
                disabled={isSavingNote}
                className="min-h-[32px] px-2.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                {noteSavedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>{isSavingNote ? 'Saving...' : 'Save Note'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Expandable Saved Prompts Log */}
      {showSavedList && (
        <div className="rounded-lg bg-cool-gray-950/90 border border-cool-gray-800 p-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-cool-gray-800">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/35 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                Temp
              </span>
              <span className="text-xs font-bold text-white">Recorded Voice Prompts</span>
            </div>

            {entries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="px-2 py-1 rounded bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-[11px] font-semibold text-cool-gray-200 flex items-center gap-1 cursor-pointer"
                  title="Copy all saved prompts & notes"
                >
                  {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="px-2 py-1 rounded bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-[11px] font-semibold text-cool-gray-200 flex items-center gap-1 cursor-pointer"
                  title="Download JSON"
                >
                  <Download className="w-3 h-3" />
                  <span>JSON</span>
                </button>
                {confirmClearAll ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-[11px] font-bold text-white cursor-pointer"
                    >
                      Confirm Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-1.5 py-1 rounded bg-cool-gray-800 text-[11px] text-cool-gray-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-2 py-1 rounded bg-cool-gray-850 hover:bg-red-950/50 border border-cool-gray-700 hover:border-red-500/40 text-[11px] font-semibold text-cool-gray-400 hover:text-red-300 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="text-[11px] text-cool-gray-500 text-center py-2">
              No saved prompts yet. When a command doesn&apos;t work as expected, tap &ldquo;Save Prompt&rdquo; above to log it with optional notes.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
              {entries.map(entry => {
                const isEditingNote = editingEntryId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg bg-cool-gray-900 border border-cool-gray-800 p-2 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs font-semibold text-white break-words">
                          &ldquo;{entry.prompt}&rdquo;
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-cool-gray-400">
                          <span>
                            {new Date(entry.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {entry.parserSummary && (
                            <span className="text-amber-300/90">{entry.parserSummary}</span>
                          )}
                          {(entry.user || entry.clientDevice) && (
                            <span>
                              {[entry.user, entry.clientDevice].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          {entry.offlineOnly && (
                            <span className="text-amber-400 font-semibold">Offline cache</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onLoadPrompt(entry.prompt)}
                          className="p-1 rounded bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-cyan-300 hover:text-cyan-200 cursor-pointer"
                          title="Load prompt back into command box"
                          aria-label="Load prompt into command box"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntryId(isEditingNote ? null : entry.id);
                            setEditingNoteDraft(entry.notes || '');
                          }}
                          className="p-1 rounded bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-300 hover:text-white cursor-pointer"
                          title={entry.notes ? 'Edit note' : 'Add optional note'}
                          aria-label={entry.notes ? 'Edit note' : 'Add optional note'}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 rounded bg-cool-gray-850 hover:bg-red-950/50 border border-cool-gray-700 hover:border-red-500/40 text-cool-gray-400 hover:text-red-300 cursor-pointer"
                          title="Delete saved prompt"
                          aria-label="Delete saved prompt"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isEditingNote ? (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <input
                          type="text"
                          value={editingNoteDraft}
                          onChange={e => setEditingNoteDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveInlineListNote(entry.id);
                            } else if (e.key === 'Escape') {
                              setEditingEntryId(null);
                            }
                          }}
                          placeholder="Optional notes..."
                          className="flex-1 min-w-0 rounded bg-cool-gray-950 border border-cool-gray-700 focus:border-cyan-500 px-2 py-1 text-[11px] text-white placeholder:text-cool-gray-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInlineListNote(entry.id)}
                          className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-[11px] font-bold text-white cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      entry.notes && (
                        <div className="text-[11px] text-cool-gray-300 bg-cool-gray-950/70 border border-cool-gray-800/80 rounded px-2 py-1 break-words">
                          <span className="text-cool-gray-500 font-semibold">Note: </span>
                          {entry.notes}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TempVoicePromptRecorder;
