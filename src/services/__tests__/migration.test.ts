import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateLegacyPhotos } from '../migration';
import { WardrobeItem } from '../../types';

// Mock idb-keyval with an in-memory Map
const memoryStore = new Map<string, any>();

vi.mock('idb-keyval', () => ({
  createStore: () => ({}),
  set: vi.fn(async (key: string, val: any) => {
    memoryStore.set(key, val);
  }),
  get: vi.fn(async (key: string) => {
    return memoryStore.get(key);
  }),
  del: vi.fn(async (key: string) => {
    memoryStore.delete(key);
  }),
  clear: vi.fn(async () => {
    memoryStore.clear();
  }),
}));

describe('Photo Migration Service (migrateLegacyPhotos)', () => {
  beforeEach(() => {
    memoryStore.clear();
    vi.clearAllMocks();
  });

  // Valid 1x1 transparent PNG data URL for testing
  const sampleBase64DataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const legacyItem: WardrobeItem = {
    id: 'legacy-item-1',
    name: 'Vintage Kurta',
    photo: sampleBase64DataUrl,
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['college'],
    formality: 3,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
  };

  const assetItem: WardrobeItem = {
    id: 'sample-item-1',
    name: 'Sample White Tee',
    photo: '/assets/wardrobe/white-tee.jpg',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['college'],
    formality: 2,
    status: 'clean',
    favorite: true,
    note: '',
    timesWorn: 2,
  };

  const modernItem: WardrobeItem = {
    id: 'modern-item-1',
    name: 'Black Trousers',
    photoId: 'photo-modern-1',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['black'],
    seasons: ['winter'],
    occasions: ['office'],
    formality: 4,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 1,
  };

  it('migrates items with base64 data URLs to IndexedDB and strips the photo field', async () => {
    const items = [legacyItem, assetItem, modernItem];
    const result = await migrateLegacyPhotos(items);

    expect(result.hasChanges).toBe(true);
    expect(result.migratedCount).toBe(1);

    const migrated = result.migratedItems.find((i) => i.id === 'legacy-item-1')!;
    expect(migrated.photo).toBeUndefined();
    expect(migrated.photoId).toBeDefined();
    expect(migrated.photoId).toContain('legacy-item-1');

    // Confirm the image was saved to the store
    expect(memoryStore.has(migrated.photoId!)).toBe(true);
    const savedBlob = memoryStore.get(migrated.photoId!);
    expect(savedBlob).toBeInstanceOf(Blob);
    expect(savedBlob.type).toBe('image/png');

    // Confirm other items are unchanged
    const unchangedAsset = result.migratedItems.find((i) => i.id === 'sample-item-1')!;
    expect(unchangedAsset.photo).toBe('/assets/wardrobe/white-tee.jpg');

    const unchangedModern = result.migratedItems.find((i) => i.id === 'modern-item-1')!;
    expect(unchangedModern.photoId).toBe('photo-modern-1');
  });

  it('is idempotent and safe to re-run on already migrated items', async () => {
    // First run
    const firstRun = await migrateLegacyPhotos([legacyItem]);
    expect(firstRun.hasChanges).toBe(true);
    expect(firstRun.migratedCount).toBe(1);

    // Second run with the already migrated items
    const secondRun = await migrateLegacyPhotos(firstRun.migratedItems);
    expect(secondRun.hasChanges).toBe(false);
    expect(secondRun.migratedCount).toBe(0);
    expect(secondRun.migratedItems[0].photoId).toBe(firstRun.migratedItems[0].photoId);
    expect(secondRun.migratedItems[0].photo).toBeUndefined();
  });

  it('handles empty or photo-less items gracefully', async () => {
    const itemWithoutPhoto: WardrobeItem = {
      ...legacyItem,
      id: 'no-photo-1',
      photo: null,
    };
    const result = await migrateLegacyPhotos([itemWithoutPhoto]);
    expect(result.hasChanges).toBe(false);
    expect(result.migratedCount).toBe(0);
    expect(result.migratedItems[0].id).toBe('no-photo-1');
  });
});
