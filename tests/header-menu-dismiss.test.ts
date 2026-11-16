import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  isEventOutsideContainer,
  attachHeaderMenuDismissListeners,
} from '../utils/headerMenuDismiss';

describe('Header Menu Outside-Click & Mutual Exclusion Behavior', () => {
  it('detects outside vs inside container targets accurately', () => {
    const insideChild = { id: 'auto-mode-btn' };
    const outsideTarget = { id: 'hamburger-btn' };
    const container = {
      contains: (node: unknown) => node === container || node === insideChild,
    };

    expect(isEventOutsideContainer(container, container)).toBe(false);
    expect(isEventOutsideContainer(container, insideChild)).toBe(false);
    expect(isEventOutsideContainer(container, outsideTarget)).toBe(true);
    expect(isEventOutsideContainer(null, outsideTarget)).toBe(false);
    expect(isEventOutsideContainer(container, null)).toBe(false);
  });

  it('closes on outside pointerdown/mousedown and Escape, stays open on inside clicks, and cleans up listeners', () => {
    const listeners = new Map<string, Array<{ fn: EventListener; capture: boolean }>>();
    const mockDoc = {
      addEventListener: vi.fn((type: string, fn: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        const list = listeners.get(type) ?? [];
        list.push({ fn: fn as EventListener, capture: Boolean(options) });
        listeners.set(type, list);
      }),
      removeEventListener: vi.fn((type: string, fn: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        const list = listeners.get(type) ?? [];
        listeners.set(
          type,
          list.filter((entry) => entry.fn !== fn || entry.capture !== Boolean(options))
        );
      }),
    };

    const insideButton = { name: 'force-single-btn' };
    const outsidePage = { name: 'product-card' };
    const hamburgerButton = { name: 'hamburger-btn' };
    const container = {
      contains: (node: unknown) => node === container || node === insideButton,
    };

    const onClose = vi.fn();
    const cleanup = attachHeaderMenuDismissListeners({
      container,
      onClose,
      targetDoc: mockDoc,
    });

    const emit = (type: string, event: any) => {
      for (const entry of listeners.get(type) ?? []) {
        expect(entry.capture).toBe(true);
        entry.fn(event);
      }
    };

    // Clicking inside the menu (e.g. switching operating modes) does not close it
    emit('pointerdown', { target: insideButton });
    emit('mousedown', { target: insideButton });
    expect(onClose).not.toHaveBeenCalled();

    // Non-Escape key does not close it
    emit('keydown', { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    // Clicking outside on page content closes it
    emit('mousedown', { target: outsidePage });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Clicking the hamburger menu button outside the sync menu closes it
    emit('pointerdown', { target: hamburgerButton });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Pressing Escape closes it
    emit('keydown', { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);

    // Cleanup removes all listeners
    cleanup();
    expect(listeners.get('pointerdown')?.length ?? 0).toBe(0);
    expect(listeners.get('mousedown')?.length ?? 0).toBe(0);
    expect(listeners.get('keydown')?.length ?? 0).toBe(0);
  });

  it('wires outside-click dismissal, mutual exclusion, and unified menu structure in App.tsx', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');

    expect(appSource).toContain('useHeaderMenuDismiss(isSyncMenuOpen, syncMenuRef, () => setIsSyncMenuOpen(false))');

    // Separate hamburger menu has been completely consolidated into the status menu
    expect(appSource).not.toContain('id="user-hamburger-dropdown"');
    expect(appSource).not.toContain('isUserDropdownOpen');
    expect(appSource).not.toContain('userMenuRef');

    const syncIdx = appSource.indexOf('id="sync-status-dropdown"');
    expect(syncIdx).toBeGreaterThan(-1);

    const endHeaderIdx = appSource.indexOf('{/* Expanded Search & Filters Row */}', syncIdx);
    expect(endHeaderIdx).toBeGreaterThan(syncIdx);

    const menuSlice = appSource.slice(syncIdx, endHeaderIdx);

    // No fixed inset-0 z-40 backdrops trapping clicks inside sticky header
    const headerMenusSlice = appSource.slice(appSource.indexOf('syncMenuRef'), endHeaderIdx);
    expect(headerMenusSlice).not.toContain('fixed inset-0 z-40');

    // Mutual exclusion with active movement popdown
    const syncMenuTriggerStart = appSource.indexOf('ref={syncMenuRef}');
    const syncMenuTriggerSlice = appSource.slice(syncMenuTriggerStart, syncIdx);
    expect(syncMenuTriggerSlice).toContain('setIsMovementPopdownOpen(false)');

    // Top-to-bottom section ordering: Modes & Inbound at top, Workspace/Account next, Sync/Modes, Version footer at very bottom
    const onSiteIdx = menuSlice.indexOf('>On-Site<');
    const offSiteIdx = menuSlice.indexOf('>Off-Site<');
    const inboundIdx = menuSlice.indexOf('>Inbound Stock<');
    const csvIdx = menuSlice.indexOf('>Bulk CSV Intake<');
    const catalogIdx = menuSlice.indexOf('Catalog &amp; Settings');
    const autoModeIdx = menuSlice.indexOf('>Auto Mode<');
    const versionIdx = menuSlice.indexOf('App Version:');
    const checkUpdatesIdx = menuSlice.indexOf('Check Updates');

    expect(onSiteIdx).toBeGreaterThan(-1);
    expect(offSiteIdx).toBeGreaterThan(onSiteIdx);
    expect(inboundIdx).toBeGreaterThan(offSiteIdx);
    expect(csvIdx).toBeGreaterThan(inboundIdx);
    expect(catalogIdx).toBeGreaterThan(csvIdx);
    expect(autoModeIdx).toBeGreaterThan(catalogIdx);
    expect(versionIdx).toBeGreaterThan(autoModeIdx);
    expect(checkUpdatesIdx).toBeGreaterThan(versionIdx);

    // Contextual inbound guards strictly respect on-site vs off-site
    expect(headerMenusSlice).toContain("const isOnSiteContext = ['product', 'freezer', 'display_case'].includes(currentView);");
    expect(headerMenusSlice).toContain("const isOffSiteMode = currentView === 'offsite';");
    expect(menuSlice).toContain('{isOnSiteContext && (');
    expect(menuSlice).toContain('{isOffSiteMode && (');

    // Compact 2-column grid layout & zero verbose explanatory prose
    expect(menuSlice).toContain('grid grid-cols-2 gap-1.5');
    expect(menuSlice).not.toContain('Default solo performance with zero-lag local memory');
    expect(menuSlice).not.toContain('Changes save with zero latency locally');
  });
});
