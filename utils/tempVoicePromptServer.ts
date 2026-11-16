// [TEMP] Temporary voice prompt capture server store & Express routes.
// Safe to delete this entire file (and its 2-line import/registration in server.ts) once the voice model is built out.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Express, RequestHandler } from 'express';

export interface TempVoicePromptEntry {
  id: string;
  prompt: string;
  notes?: string;
  parserSummary?: string;
  user?: string;
  clientDevice?: string;
  createdAt: string;
  updatedAt?: string;
}

const MAX_TEMP_VOICE_PROMPTS = 500;
const TEMP_VOICE_PROMPTS_FILENAME = 'temp-voice-prompts.json';

export function getTempVoicePromptsFilePath(dataDir: string): string {
  return path.join(dataDir, TEMP_VOICE_PROMPTS_FILENAME);
}

export function readTempVoicePrompts(filePath: string): TempVoicePromptEntry[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TempVoicePromptEntry =>
        Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.prompt === 'string')
    );
  } catch (err) {
    console.warn('[TempVoicePrompts] Could not read temp voice prompts file:', err);
    return [];
  }
}

export function writeTempVoicePrompts(filePath: string, entries: TempVoicePromptEntry[]): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

export function addTempVoicePrompt(
  filePath: string,
  input: {
    prompt: string;
    notes?: string;
    parserSummary?: string;
    user?: string;
    clientDevice?: string;
  }
): TempVoicePromptEntry {
  const cleanPrompt = (input.prompt || '').trim();
  if (!cleanPrompt) {
    throw new Error('Prompt text cannot be empty.');
  }

  const now = new Date().toISOString();
  const cleanNotes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const cleanSummary = typeof input.parserSummary === 'string' ? input.parserSummary.trim() : '';
  const cleanUser = typeof input.user === 'string' ? input.user.trim() : '';
  const cleanDevice = typeof input.clientDevice === 'string' ? input.clientDevice.trim() : '';

  const entry: TempVoicePromptEntry = {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `tvp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: cleanPrompt,
    ...(cleanNotes ? { notes: cleanNotes } : {}),
    ...(cleanSummary ? { parserSummary: cleanSummary } : {}),
    ...(cleanUser ? { user: cleanUser } : {}),
    ...(cleanDevice ? { clientDevice: cleanDevice } : {}),
    createdAt: now,
  };

  const existing = readTempVoicePrompts(filePath);
  const next = [entry, ...existing].slice(0, MAX_TEMP_VOICE_PROMPTS);
  writeTempVoicePrompts(filePath, next);
  return entry;
}

export function updateTempVoicePromptNotes(
  filePath: string,
  id: string,
  notes: string
): TempVoicePromptEntry | null {
  const existing = readTempVoicePrompts(filePath);
  const idx = existing.findIndex(e => e.id === id);
  if (idx === -1) return null;

  const cleanNotes = typeof notes === 'string' ? notes.trim() : '';
  const updated: TempVoicePromptEntry = {
    ...existing[idx],
    updatedAt: new Date().toISOString(),
  };
  if (cleanNotes) {
    updated.notes = cleanNotes;
  } else {
    delete updated.notes;
  }

  const next = [...existing];
  next[idx] = updated;
  writeTempVoicePrompts(filePath, next);
  return updated;
}

export function deleteTempVoicePrompt(filePath: string, id: string): boolean {
  const existing = readTempVoicePrompts(filePath);
  const next = existing.filter(e => e.id !== id);
  if (next.length === existing.length) return false;
  writeTempVoicePrompts(filePath, next);
  return true;
}

export function clearTempVoicePrompts(filePath: string): void {
  writeTempVoicePrompts(filePath, []);
}

export function registerTempVoicePromptRoutes(
  app: Express,
  dataDir: string,
  requireEditAuth: RequestHandler
): void {
  const filePath = getTempVoicePromptsFilePath(dataDir);

  app.get('/api/temp/voice-prompts', (_req, res) => {
    try {
      const entries = readTempVoicePrompts(filePath);
      res.json({ entries });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load temporary voice prompts.', details: err?.message });
    }
  });

  app.post('/api/temp/voice-prompts', requireEditAuth, (req: any, res) => {
    try {
      const { prompt, notes, parserSummary } = req.body || {};
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt text is required.' });
      }
      const rawUser =
        req.userAuth?.currentUser?.name ||
        (typeof req.headers['x-user-name'] === 'string' ? req.headers['x-user-name'] : '') ||
        (typeof req.headers['x-operator-name'] === 'string' ? req.headers['x-operator-name'] : '');
      const rawDevice =
        typeof req.headers['x-client-device'] === 'string' ? req.headers['x-client-device'] : '';

      const entry = addTempVoicePrompt(filePath, {
        prompt,
        notes: typeof notes === 'string' ? notes : undefined,
        parserSummary: typeof parserSummary === 'string' ? parserSummary : undefined,
        user: rawUser,
        clientDevice: rawDevice,
      });
      const entries = readTempVoicePrompts(filePath);
      res.status(201).json({ entry, entries });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save temporary voice prompt.', details: err?.message });
    }
  });

  app.patch('/api/temp/voice-prompts/:id', requireEditAuth, (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Entry id is required.' });
      }
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';
      const updated = updateTempVoicePromptNotes(filePath, id, notes);
      if (!updated) {
        return res.status(404).json({ error: 'Temporary voice prompt not found.' });
      }
      const entries = readTempVoicePrompts(filePath);
      res.json({ entry: updated, entries });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update temporary voice prompt notes.', details: err?.message });
    }
  });

  app.delete('/api/temp/voice-prompts/:id', requireEditAuth, (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const deleted = deleteTempVoicePrompt(filePath, id);
      if (!deleted) {
        return res.status(404).json({ error: 'Temporary voice prompt not found.' });
      }
      const entries = readTempVoicePrompts(filePath);
      res.json({ success: true, entries });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete temporary voice prompt.', details: err?.message });
    }
  });

  app.delete('/api/temp/voice-prompts', requireEditAuth, (_req, res) => {
    try {
      clearTempVoicePrompts(filePath);
      res.json({ success: true, entries: [] });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to clear temporary voice prompts.', details: err?.message });
    }
  });
}
