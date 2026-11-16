import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Voice Control Mobile Sticky Bottom Confirm Bar', () => {
  it('uses an opaque solid surface instead of transparent bg-cool-gray-900/95 in VoiceControlView.tsx', () => {
    const voiceSource = fs.readFileSync(
      path.resolve(__dirname, '../views/VoiceControlView.tsx'),
      'utf-8'
    );

    const markerIdx = voiceSource.indexOf('id="voice-mobile-confirm-bar"');
    expect(markerIdx).toBeGreaterThan(-1);

    const barSlice = voiceSource.slice(markerIdx, markerIdx + 400);
    expect(barSlice).not.toContain('bg-cool-gray-900/95');
    expect(barSlice).toContain('bg-[var(--ha-bg-card,#1f2937)]');
    expect(barSlice).toContain('fixed bottom-0 left-0 right-0');
  });

  it('enforces solid opaque background and opacity: 1 for #voice-mobile-confirm-bar in index.css', () => {
    const cssSource = fs.readFileSync(
      path.resolve(__dirname, '../index.css'),
      'utf-8'
    );

    const ruleIdx = cssSource.indexOf('#voice-mobile-confirm-bar');
    expect(ruleIdx).toBeGreaterThan(-1);

    const ruleEnd = cssSource.indexOf('}', ruleIdx);
    expect(ruleEnd).toBeGreaterThan(ruleIdx);

    const ruleBlock = cssSource.slice(ruleIdx, ruleEnd + 1);
    expect(ruleBlock).toContain('background-color: var(--ha-bg-card, #1f2937) !important;');
    expect(ruleBlock).toContain('opacity: 1 !important;');
    expect(ruleBlock).toContain('backdrop-filter: none !important;');
  });
});
