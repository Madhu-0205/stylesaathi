import { WardrobeItem, GeneratedOutfit, SavedOutfit } from '../types';
import { sampleWardrobe } from '../data/sampleWardrobe';

/**
 * Demo Wardrobe Service
 * 
 * Provides strict architectural isolation between the 28-piece curated
 * demonstration wardrobe capsule and authentic personal user storage.
 * 
 * Demonstration items NEVER enter persistent repositories, wear events,
 * calendar plans, backup payloads, or cloud sync queues.
 */

export const DEMO_ID_PREFIXES = ['sample-', 'demo-'];

/**
 * Evaluates whether an item or ID belongs to the isolated demonstration capsule.
 */
export function isDemoItem(itemOrId: WardrobeItem | string | null | undefined): boolean {
  if (!itemOrId) return false;
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  if (!id || typeof id !== 'string') return false;
  return DEMO_ID_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/**
 * Checks whether an outfit contains any demonstration pieces.
 * Accepts either a GeneratedOutfit or a SavedOutfit.
 */
export function isDemoOutfit(outfit: GeneratedOutfit | SavedOutfit | null | undefined): boolean {
  if (!outfit) return false;
  if (outfit.id && isDemoItem(outfit.id)) return true;
  const genOutfit: GeneratedOutfit =
    'outfit' in outfit && (outfit as SavedOutfit).outfit
      ? (outfit as SavedOutfit).outfit
      : (outfit as GeneratedOutfit);
  if (genOutfit.id && isDemoItem(genOutfit.id)) return true;
  if (genOutfit.slots) {
    const pieces = Object.values(genOutfit.slots).flat();
    return pieces.some((p) => p && isDemoItem(p));
  }
  return false;
}

/**
 * Checks whether an arbitrary sync or persistence payload contains demonstration items.
 */
export function isDemoPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.id && typeof payload.id === 'string' && isDemoItem(payload.id)) return true;
  if (payload.item && isDemoItem(payload.item)) return true;
  if (payload.outfit && isDemoOutfit(payload.outfit)) return true;
  if (Array.isArray(payload.items)) {
    return payload.items.some((i: any) => isDemoItem(i));
  }
  return false;
}

/**
 * Asserts that an item is an authentic personal garment, throwing a descriptive error
 * if a write operation attempts to persist a demonstration item.
 */
export function assertNotDemoItem(itemOrId: WardrobeItem | string, operation: string): void {
  if (isDemoItem(itemOrId)) {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    throw new Error(
      `[DemoIsolation] Prohibited persistent write: Cannot perform '${operation}' on demonstration fixture item '${id}'. Demonstration items are strictly read-only.`
    );
  }
}

/**
 * Returns the 28-piece curated demonstration wardrobe capsule.
 * Always returns a cloned, read-only collection that never mutates real user storage.
 */
export function getDemoWardrobe(): WardrobeItem[] {
  return sampleWardrobe.map((item) => ({
    ...item,
    // Ensure deep clone of arrays
    colors: [...item.colors],
    seasons: [...item.seasons],
    occasions: [...item.occasions],
  }));
}

