import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Tag } from '../types';
import { createTestDatabase } from './test-harness';
import {
  getExcludedFromDisplayRestockTagIds,
  getPrioritizeItemTagIds,
  isCutExcludedFromDisplayRestock,
  getCutExcludedRestockTags,
  isCutPrioritized,
  getCutPrioritizedTags,
  getTagActionIcon,
  compareBackstockForDisplayRestock,
  compareCutsForRemoval,
} from '../utils/tagRestockRules';

describe('Tag-Based Restock & Removal Priority Rules', () => {
  it('applies NO hardcoded defaults for any tag name or ID (including "not-for-sale" or "use-first")', () => {
    expect(Array.from(getExcludedFromDisplayRestockTagIds(undefined))).toEqual([]);
    expect(Array.from(getPrioritizeItemTagIds(undefined))).toEqual([]);

    const unflaggedTags: Tag[] = [
      { id: 'not-for-sale', name: 'Not For Sale' },
      { id: 'use-first', name: 'Use First' },
      { id: 't-wholesale', name: 'Wholesale Only', excludeFromDisplayRestock: true },
      { id: 't-short-date', name: 'Short Date', prioritizeItem: true },
      { id: 't-vacuum', name: 'Vacuum Sealed', excludeFromDisplayRestock: false, prioritizeItem: false },
    ];

    const excluded = getExcludedFromDisplayRestockTagIds(unflaggedTags);
    expect(Array.from(excluded)).toEqual(['t-wholesale']);
    expect(excluded.has('not-for-sale')).toBe(false);

    const prioritized = getPrioritizeItemTagIds(unflaggedTags);
    expect(Array.from(prioritized)).toEqual(['t-short-date']);
    expect(prioritized.has('use-first')).toBe(false);
  });

  it('detects excluded and prioritized tags strictly from boolean flags and returns metadata', () => {
    const tags: Tag[] = [
      { id: 't-reserve', name: 'Farmer Hold', excludeFromDisplayRestock: true, color: '#ef4444' },
      { id: 't-promo', name: 'Promo Priority', prioritizeItem: true, color: '#f59e0b' },
      { id: 'use-first', name: 'Use First', color: '#94a3b8' },
    ];

    expect(isCutExcludedFromDisplayRestock({ tagIds: undefined }, tags)).toBe(false);
    expect(isCutExcludedFromDisplayRestock({ tagIds: ['use-first'] }, tags)).toBe(false);
    expect(isCutExcludedFromDisplayRestock({ tagIds: ['not-for-sale'] }, tags)).toBe(false);
    expect(isCutExcludedFromDisplayRestock({ tagIds: ['t-reserve'] }, tags)).toBe(true);

    expect(getCutExcludedRestockTags({ tagIds: ['t-reserve', 't-promo', 'not-for-sale'] }, tags)).toEqual([
      { id: 't-reserve', name: 'Farmer Hold', excludeFromDisplayRestock: true, color: '#ef4444' },
    ]);

    expect(isCutPrioritized({ tagIds: ['use-first'] }, tags)).toBe(false);
    expect(isCutPrioritized({ tagIds: ['t-promo'] }, tags)).toBe(true);
    expect(getCutPrioritizedTags({ tagIds: ['t-reserve', 't-promo', 'use-first'] }, tags)).toEqual([
      { id: 't-promo', name: 'Promo Priority', prioritizeItem: true, color: '#f59e0b' },
    ]);
  });

  it('derives badge icons from explicit tag action flags rather than hardcoded IDs', () => {
    expect(getTagActionIcon({ excludeFromDisplayRestock: true })).toBe('🚫');
    expect(getTagActionIcon({ prioritizeItem: true })).toBe('⚡');
    expect(getTagActionIcon({ excludeFromDisplayRestock: false, prioritizeItem: false })).toBe('🏷️');
    expect(getTagActionIcon(undefined)).toBe('🏷️');
  });

  it('sorts prioritized items first for both Display backstock restocking and inventory removal', () => {
    const tags: Tag[] = [
      { id: 't-quick-sell', name: 'Quick Sell', prioritizeItem: true },
      { id: 'use-first', name: 'Use First' }, // No flag -> ordinary tag
    ];

    const backstockEntries = [
      {
        label: 'large-special',
        meatCut: { id: 'mc1', productId: 'p1', containerId: 'c1', quantity: 20 },
        freezer: { isSpecial: true },
      },
      {
        label: 'medium-storage',
        meatCut: { id: 'mc2', productId: 'p1', containerId: 'c2', quantity: 12 },
        freezer: { isSpecial: false },
      },
      {
        label: 'unflagged-use-first',
        meatCut: { id: 'mc3', productId: 'p1', containerId: 'c3', quantity: 18, tagIds: ['use-first'] },
        freezer: { isSpecial: false },
      },
      {
        label: 'small-prio-special',
        meatCut: { id: 'mc4', productId: 'p1', containerId: 'c4', quantity: 2, tagIds: ['t-quick-sell'] },
        freezer: { isSpecial: true },
      },
      {
        label: 'larger-prio-storage',
        meatCut: { id: 'mc5', productId: 'p1', containerId: 'c5', quantity: 5, tagIds: ['t-quick-sell'] },
        freezer: { isSpecial: false },
      },
    ];

    const sortedBackstock = [...backstockEntries].sort((a, b) =>
      compareBackstockForDisplayRestock(a, b, tags)
    );
    expect(sortedBackstock.map(e => e.label)).toEqual([
      'larger-prio-storage',
      'small-prio-special',
      'unflagged-use-first',
      'medium-storage',
      'large-special',
    ]);

    const removalEntries = [
      { label: 'ordinary-first', meatCut: { id: 'r1', productId: 'p1', containerId: 'c1', quantity: 10 } },
      { label: 'flagged-priority', meatCut: { id: 'r2', productId: 'p1', containerId: 'c1', quantity: 3, tagIds: ['t-quick-sell'] } },
      { label: 'ordinary-second', meatCut: { id: 'r3', productId: 'p1', containerId: 'c1', quantity: 4, tagIds: ['use-first'] } },
    ];
    const sortedRemoval = [...removalEntries].sort((a, b) => compareCutsForRemoval(a, b, tags));
    expect(sortedRemoval.map(e => e.label)).toEqual([
      'flagged-priority',
      'ordinary-first',
      'ordinary-second',
    ]);
  });

  it('persists prioritizeItem and excludeFromDisplayRestock columns in SQLite tags table', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-tag-schema-'));
    const dbPath = path.join(tempDir, 'tags.db');
    let db: Database.Database | null = null;
    try {
      db = createTestDatabase(dbPath);
      db.prepare(
        `INSERT INTO tags (id, name, description, color, textColor, excludeFromDisplayRestock, prioritizeItem)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('t-clearout', 'Clear Out First', 'Sell before newer packs', '#f59e0b', '#ffffff', 0, 1);

      const row = db
        .prepare('SELECT id, name, excludeFromDisplayRestock, prioritizeItem FROM tags WHERE id = ?')
        .get('t-clearout') as any;
      expect(row).toEqual({
        id: 't-clearout',
        name: 'Clear Out First',
        excludeFromDisplayRestock: 0,
        prioritizeItem: 1,
      });
    } finally {
      if (db) db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
