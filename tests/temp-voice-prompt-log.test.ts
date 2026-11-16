import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getTempVoicePromptsFilePath,
  readTempVoicePrompts,
  addTempVoicePrompt,
  updateTempVoicePromptNotes,
  deleteTempVoicePrompt,
  clearTempVoicePrompts,
} from '../utils/tempVoicePromptServer';
import { formatTempVoicePromptsForCopy } from '../utils/tempVoicePromptLog';

describe('[TEMP] Temporary Voice Prompt Capture Store & Helpers', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-voice-prompts-'));
    filePath = getTempVoicePromptsFilePath(tempDir);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
  });

  it('returns empty list when file does not exist or contains invalid JSON', () => {
    expect(readTempVoicePrompts(filePath)).toEqual([]);
    fs.writeFileSync(filePath, '{broken json', 'utf8');
    expect(readTempVoicePrompts(filePath)).toEqual([]);
  });

  it('saves prompts newest-first, supports optional notes updates, and deletes cleanly', () => {
    const first = addTempVoicePrompt(filePath, {
      prompt: 'grabbed a couple brats for the front cooler',
      parserSummary: '1 unrecognized',
      user: 'Nick',
      clientDevice: 'Standalone PWA',
    });

    expect(first.id).toBeTruthy();
    expect(first.prompt).toBe('grabbed a couple brats for the front cooler');
    expect(first.notes).toBeUndefined();

    const second = addTempVoicePrompt(filePath, {
      prompt: 'restock display with all pork chops from canada',
      notes: 'Should pull all available pork chops from Canada into Display',
      parserSummary: '1 mutation error',
    });

    const listAfterAdd = readTempVoicePrompts(filePath);
    expect(listAfterAdd).toHaveLength(2);
    expect(listAfterAdd[0].id).toBe(second.id);
    expect(listAfterAdd[1].id).toBe(first.id);

    // Update optional notes on first entry after saving
    const updatedFirst = updateTempVoicePromptNotes(
      filePath,
      first.id,
      'Expected it to remove 2 brats from Display Case'
    );
    expect(updatedFirst?.notes).toBe('Expected it to remove 2 brats from Display Case');
    expect(updatedFirst?.updatedAt).toBeTruthy();

    // Clearing notes removes the notes field cleanly
    const clearedNote = updateTempVoicePromptNotes(filePath, first.id, '   ');
    expect(clearedNote?.notes).toBeUndefined();

    // Missing ID returns null
    expect(updateTempVoicePromptNotes(filePath, 'nonexistent', 'hello')).toBeNull();

    // Delete single entry
    expect(deleteTempVoicePrompt(filePath, first.id)).toBe(true);
    expect(deleteTempVoicePrompt(filePath, first.id)).toBe(false);
    expect(readTempVoicePrompts(filePath)).toHaveLength(1);

    // Clear all
    clearTempVoicePrompts(filePath);
    expect(readTempVoicePrompts(filePath)).toEqual([]);
  });

  it('rejects blank prompts', () => {
    expect(() => addTempVoicePrompt(filePath, { prompt: '   ' })).toThrow();
  });

  it('formats saved prompts and optional notes into readable copy text', () => {
    const formatted = formatTempVoicePromptsForCopy([
      {
        id: '1',
        prompt: 'take out 2 ribeyes from chest',
        notes: 'Should deduct 2 ribeyes from Chest Freezer',
        parserSummary: '1 unrecognized',
        user: 'Nick',
        clientDevice: 'Mobile Browser',
        createdAt: '2026-11-14T20:00:00.000Z',
      },
    ]);

    expect(formatted).toContain('1. "take out 2 ribeyes from chest"');
    expect(formatted).toContain('Notes: Should deduct 2 ribeyes from Chest Freezer');
    expect(formatted).toContain('Parser: 1 unrecognized');
    expect(formatted).toContain('User: Nick');
  });
});
