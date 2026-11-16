// [TEMP] Temporary client helpers for recording unrecognized/failed voice prompts & optional notes.
// Safe to delete this entire file once the voice model is built out.
import { getApiUrl } from '../hooks/apiUrl';
import { authFetch, getClientDeviceInfo } from './clientDevice';

export interface TempVoicePromptEntry {
  id: string;
  prompt: string;
  notes?: string;
  parserSummary?: string;
  user?: string;
  clientDevice?: string;
  createdAt: string;
  updatedAt?: string;
  offlineOnly?: boolean;
}

const TEMP_VOICE_PROMPTS_STORAGE_KEY = 'temp_voice_prompts_cache_v1';

function readLocalCache(): TempVoicePromptEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(TEMP_VOICE_PROMPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(entries: TempVoicePromptEntry[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TEMP_VOICE_PROMPTS_STORAGE_KEY, JSON.stringify(entries.slice(0, 500)));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchTempVoicePrompts(): Promise<TempVoicePromptEntry[]> {
  try {
    const res = await authFetch(getApiUrl('api/temp/voice-prompts'));
    if (res.ok) {
      const data = await res.json();
      const serverEntries: TempVoicePromptEntry[] = Array.isArray(data?.entries) ? data.entries : [];
      const offlineOnly = readLocalCache().filter(e => e.offlineOnly);
      const merged = [...offlineOnly, ...serverEntries];
      writeLocalCache(merged);
      return merged;
    }
  } catch {
    // fall back to local cache when offline
  }
  return readLocalCache();
}

export async function saveTempVoicePrompt(input: {
  prompt: string;
  notes?: string;
  parserSummary?: string;
}): Promise<{
  entry: TempVoicePromptEntry | null;
  entries: TempVoicePromptEntry[];
  offlineSaved?: boolean;
  authRequired?: boolean;
  error?: string;
}> {
  const cleanPrompt = (input.prompt || '').trim();
  if (!cleanPrompt) {
    return { entry: null, entries: readLocalCache(), error: 'Prompt box is empty.' };
  }

  try {
    const res = await authFetch(getApiUrl('api/temp/voice-prompts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: cleanPrompt,
        notes: input.notes?.trim() || '',
        parserSummary: input.parserSummary?.trim() || '',
      }),
    });

    if (res.status === 401) {
      return {
        entry: null,
        entries: readLocalCache(),
        authRequired: true,
        error: 'Sign in with your PIN to save prompts to the server.',
      };
    }

    if (res.ok) {
      const data = await res.json();
      const serverEntries: TempVoicePromptEntry[] = Array.isArray(data?.entries) ? data.entries : [];
      const offlineOnly = readLocalCache().filter(e => e.offlineOnly);
      const merged = [...offlineOnly, ...serverEntries];
      writeLocalCache(merged);
      return { entry: data?.entry || null, entries: merged };
    }
  } catch {
    // offline fallback below
  }

  const dev = getClientDeviceInfo();
  const offlineEntry: TempVoicePromptEntry = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    prompt: cleanPrompt,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.parserSummary?.trim() ? { parserSummary: input.parserSummary.trim() } : {}),
    user: dev.operatorName || undefined,
    clientDevice: dev.clientDevice,
    createdAt: new Date().toISOString(),
    offlineOnly: true,
  };
  const next = [offlineEntry, ...readLocalCache()];
  writeLocalCache(next);
  return { entry: offlineEntry, entries: next, offlineSaved: true };
}

export async function updateTempVoicePromptNote(
  id: string,
  notes: string
): Promise<{
  entry: TempVoicePromptEntry | null;
  entries: TempVoicePromptEntry[];
  error?: string;
}> {
  const cleanNotes = notes.trim();
  if (id.startsWith('local-')) {
    const current = readLocalCache();
    let updatedEntry: TempVoicePromptEntry | null = null;
    const next = current.map(e => {
      if (e.id !== id) return e;
      updatedEntry = {
        ...e,
        updatedAt: new Date().toISOString(),
        ...(cleanNotes ? { notes: cleanNotes } : {}),
      };
      if (!cleanNotes) delete updatedEntry.notes;
      return updatedEntry;
    });
    writeLocalCache(next);
    return { entry: updatedEntry, entries: next };
  }

  try {
    const res = await authFetch(getApiUrl(`api/temp/voice-prompts/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: cleanNotes }),
    });
    if (res.status === 401) {
      return { entry: null, entries: readLocalCache(), error: 'Sign in with your PIN to update notes.' };
    }
    if (res.ok) {
      const data = await res.json();
      const serverEntries: TempVoicePromptEntry[] = Array.isArray(data?.entries) ? data.entries : [];
      const offlineOnly = readLocalCache().filter(e => e.offlineOnly);
      const merged = [...offlineOnly, ...serverEntries];
      writeLocalCache(merged);
      return { entry: data?.entry || null, entries: merged };
    }
  } catch {
    return { entry: null, entries: readLocalCache(), error: 'Could not reach server to update note.' };
  }

  return { entry: null, entries: readLocalCache(), error: 'Failed to update note.' };
}

export async function deleteTempVoicePromptById(id: string): Promise<TempVoicePromptEntry[]> {
  if (id.startsWith('local-')) {
    const next = readLocalCache().filter(e => e.id !== id);
    writeLocalCache(next);
    return next;
  }

  try {
    const res = await authFetch(getApiUrl(`api/temp/voice-prompts/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      const serverEntries: TempVoicePromptEntry[] = Array.isArray(data?.entries) ? data.entries : [];
      const offlineOnly = readLocalCache().filter(e => e.offlineOnly);
      const merged = [...offlineOnly, ...serverEntries];
      writeLocalCache(merged);
      return merged;
    }
  } catch {
    // ignore
  }
  return readLocalCache();
}

export async function clearAllTempVoicePrompts(): Promise<TempVoicePromptEntry[]> {
  try {
    const res = await authFetch(getApiUrl('api/temp/voice-prompts'), {
      method: 'DELETE',
    });
    if (res.ok) {
      writeLocalCache([]);
      return [];
    }
  } catch {
    // ignore
  }
  const remainingServer = readLocalCache().filter(e => !e.offlineOnly);
  writeLocalCache(remainingServer);
  return remainingServer;
}

export function formatTempVoicePromptsForCopy(entries: TempVoicePromptEntry[]): string {
  if (entries.length === 0) return '';
  return entries
    .map((entry, index) => {
      const lines = [`${index + 1}. "${entry.prompt}"`];
      if (entry.notes) lines.push(`   Notes: ${entry.notes}`);
      const metaParts = [
        entry.parserSummary ? `Parser: ${entry.parserSummary}` : '',
        entry.user ? `User: ${entry.user}` : '',
        entry.clientDevice ? `Device: ${entry.clientDevice}` : '',
        entry.createdAt ? `Saved: ${entry.createdAt}` : '',
      ].filter(Boolean);
      if (metaParts.length > 0) lines.push(`   [${metaParts.join(' | ')}]`);
      return lines.join('\n');
    })
    .join('\n\n');
}
