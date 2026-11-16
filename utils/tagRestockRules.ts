import { Freezer, MeatCut, Tag } from '../types';

/**
 * Resolve all tag IDs marked with `excludeFromDisplayRestock: true`.
 * Behavior is driven strictly by tag configuration (never hardcoded tag IDs or names).
 */
export function getExcludedFromDisplayRestockTagIds(tags?: Tag[]): Set<string> {
  const excludedIds = new Set<string>();
  for (const tag of tags || []) {
    if (tag.excludeFromDisplayRestock === true) {
      excludedIds.add(tag.id);
    }
  }
  return excludedIds;
}

/**
 * Resolve all tag IDs marked with `prioritizeItem: true`.
 * Behavior is driven strictly by tag configuration (never hardcoded tag IDs or names).
 */
export function getPrioritizeItemTagIds(tags?: Tag[]): Set<string> {
  const prioritizedIds = new Set<string>();
  for (const tag of tags || []) {
    if (tag.prioritizeItem === true) {
      prioritizedIds.add(tag.id);
    }
  }
  return prioritizedIds;
}

/**
 * Returns true if the given MeatCut carries any tag marked `excludeFromDisplayRestock`.
 */
export function isCutExcludedFromDisplayRestock(
  cut: Pick<MeatCut, 'tagIds'>,
  tagsOrSet?: Tag[] | Set<string>
): boolean {
  const tagIds = cut.tagIds;
  if (!tagIds || tagIds.length === 0) return false;
  const excludedSet =
    tagsOrSet instanceof Set ? tagsOrSet : getExcludedFromDisplayRestockTagIds(tagsOrSet);
  return tagIds.some(id => excludedSet.has(id));
}

/**
 * Returns the Tag objects on a cut that exclude it from Display Case restocking.
 */
export function getCutExcludedRestockTags(
  cut: Pick<MeatCut, 'tagIds'>,
  tags?: Tag[]
): Tag[] {
  const tagIds = cut.tagIds;
  if (!tagIds || tagIds.length === 0) return [];
  const excludedSet = getExcludedFromDisplayRestockTagIds(tags);
  const tagMap = new Map((tags || []).map(t => [t.id, t]));
  const result: Tag[] = [];

  for (const id of tagIds) {
    if (!excludedSet.has(id)) continue;
    const found = tagMap.get(id);
    if (found) {
      result.push(found);
    }
  }

  return result;
}

/**
 * Returns true if the given MeatCut carries any tag marked `prioritizeItem`.
 */
export function isCutPrioritized(
  cut: Pick<MeatCut, 'tagIds'>,
  tagsOrSet?: Tag[] | Set<string>
): boolean {
  const tagIds = cut.tagIds;
  if (!tagIds || tagIds.length === 0) return false;
  const prioritizedSet =
    tagsOrSet instanceof Set ? tagsOrSet : getPrioritizeItemTagIds(tagsOrSet);
  return tagIds.some(id => prioritizedSet.has(id));
}

/**
 * Returns the Tag objects on a cut that mark it as a priority item.
 */
export function getCutPrioritizedTags(
  cut: Pick<MeatCut, 'tagIds'>,
  tags?: Tag[]
): Tag[] {
  const tagIds = cut.tagIds;
  if (!tagIds || tagIds.length === 0) return [];
  const prioritizedSet = getPrioritizeItemTagIds(tags);
  const tagMap = new Map((tags || []).map(t => [t.id, t]));
  const result: Tag[] = [];

  for (const id of tagIds) {
    if (!prioritizedSet.has(id)) continue;
    const found = tagMap.get(id);
    if (found) {
      result.push(found);
    }
  }

  return result;
}

/**
 * Resolve a consistent badge icon from configured tag action flags.
 */
export function getTagActionIcon(
  tag?: Pick<Tag, 'excludeFromDisplayRestock' | 'prioritizeItem'>
): string {
  if (tag?.excludeFromDisplayRestock) return '🚫';
  if (tag?.prioritizeItem) return '⚡';
  return '🏷️';
}

/**
 * Deterministic comparator for choosing backstock stacks when restocking Display Case:
 * 1. `prioritizeItem` tagged cuts ALWAYS come first
 * 2. Non-special storage freezers before other special display freezers
 * 3. Larger stacks first (single-stack sufficiency)
 */
export function compareBackstockForDisplayRestock<
  T extends { meatCut: MeatCut; freezer?: Pick<Freezer, 'isSpecial'> }
>(a: T, b: T, tagsOrSet?: Tag[] | Set<string>): number {
  const prioritizedSet =
    tagsOrSet instanceof Set ? tagsOrSet : getPrioritizeItemTagIds(tagsOrSet);
  const aPrio = isCutPrioritized(a.meatCut, prioritizedSet) ? 1 : 0;
  const bPrio = isCutPrioritized(b.meatCut, prioritizedSet) ? 1 : 0;
  if (aPrio !== bPrio) return bPrio - aPrio;

  const aSpec = a.freezer?.isSpecial ? 1 : 0;
  const bSpec = b.freezer?.isSpecial ? 1 : 0;
  if (aSpec !== bSpec) return aSpec - bSpec;

  return b.meatCut.quantity - a.meatCut.quantity;
}

/**
 * Comparator pushing `prioritizeItem` tagged cuts first when ordering items for removal/display.
 */
export function compareCutsForRemoval<T extends { meatCut: MeatCut }>(
  a: T,
  b: T,
  tagsOrSet?: Tag[] | Set<string>
): number {
  const prioritizedSet =
    tagsOrSet instanceof Set ? tagsOrSet : getPrioritizeItemTagIds(tagsOrSet);
  const aPrio = isCutPrioritized(a.meatCut, prioritizedSet) ? 1 : 0;
  const bPrio = isCutPrioritized(b.meatCut, prioritizedSet) ? 1 : 0;
  return bPrio - aPrio;
}
