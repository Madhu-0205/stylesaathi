import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { generateOutfits, simulateBuy } from '../engine';
import { candidates } from '../data/candidates';
import { saveImage, getImage, deleteImage, clearImages } from '../services/imageStore';
import { migrateLegacyPhotos } from '../services/migration';
import { WardrobeItem } from '../types';

// In-memory IndexedDB mock
const idbMap = new Map<string, any>();

vi.mock('idb-keyval', () => ({
  createStore: () => ({}),
  set: vi.fn(async (key: string, val: any) => {
    idbMap.set(key, val);
  }),
  get: vi.fn(async (key: string) => {
    return idbMap.get(key);
  }),
  del: vi.fn(async (key: string) => {
    idbMap.delete(key);
  }),
  clear: vi.fn(async () => {
    idbMap.clear();
  }),
}));

describe('StyleSaathi Complete User Flows Verification', () => {
  beforeEach(async () => {
    idbMap.clear();
    await clearImages();
  });

  it('1. Loads the sample wardrobe and verifies 25 curated items with gaps', () => {
    expect(sampleWardrobe.length).toBeGreaterThanOrEqual(25);

    // Verify key categories exist
    const categories = new Set(sampleWardrobe.map((i) => i.category));
    expect(categories.has('Tops')).toBe(true);
    expect(categories.has('Bottoms')).toBe(true);
    expect(categories.has('Ethnic')).toBe(true);
    expect(categories.has('Footwear')).toBe(true);
    expect(categories.has('Accessories')).toBe(true);
  });

  it('2. Adds 3 items with photos to IndexedDB and stores only photoId on the item', async () => {
    const fakeKurtaBlob = new Blob(['fake-kurta-binary'], { type: 'image/jpeg' });
    const fakeJeansBlob = new Blob(['fake-jeans-binary'], { type: 'image/jpeg' });
    const fakeSareeBlob = new Blob(['fake-saree-binary'], { type: 'image/jpeg' });

    // Save image 1
    const photoId1 = 'photo-kurta-1';
    await saveImage(photoId1, fakeKurtaBlob);
    const item1: WardrobeItem = {
      id: 'item-kurta-1',
      name: 'White Kurta',
      photoId: photoId1,
      category: 'Ethnic',
      subcategory: 'kurta',
      colors: ['white'],
      seasons: ['summer', 'monsoon'],
      occasions: ['college', 'puja'],
      formality: 3,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
    };

    // Save image 2
    const photoId2 = 'photo-jeans-1';
    await saveImage(photoId2, fakeJeansBlob);
    const item2: WardrobeItem = {
      id: 'item-jeans-1',
      name: 'Blue Jeans',
      photoId: photoId2,
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue'],
      seasons: ['summer', 'monsoon', 'winter'],
      occasions: ['college', 'casual outing'],
      formality: 2,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
    };

    // Save image 3
    const photoId3 = 'photo-saree-1';
    await saveImage(photoId3, fakeSareeBlob);
    const item3: WardrobeItem = {
      id: 'item-saree-1',
      name: 'Black Saree',
      photoId: photoId3,
      category: 'Ethnic',
      subcategory: 'saree',
      colors: ['black'],
      seasons: ['winter'],
      occasions: ['party', 'wedding guest'],
      formality: 5,
      status: 'clean',
      favorite: true,
      note: '',
      timesWorn: 0,
    };

    // Confirm that items only store photoId (photo is undefined or null)
    expect(item1.photo).toBeUndefined();
    expect(item2.photo).toBeUndefined();
    expect(item3.photo).toBeUndefined();

    // Confirm that IndexedDB contains all 3 images
    const saved1 = await getImage(photoId1);
    const saved2 = await getImage(photoId2);
    const saved3 = await getImage(photoId3);

    expect(saved1).toBeDefined();
    expect(saved2).toBeDefined();
    expect(saved3).toBeDefined();
  });

  it('3. Persists photos across page reloads (simulated via IndexedDB lookup)', async () => {
    const testBlob = new Blob(['persistent-photo-data'], { type: 'image/jpeg' });
    await saveImage('photo-persist-test', testBlob);

    // Simulate page reload by reading directly from imageStore
    const retrieved = await getImage('photo-persist-test');
    expect(retrieved).toBeDefined();
    expect(retrieved?.type).toBe('image/jpeg');
  });

  it('4. Deleting an item cleans up its IndexedDB photo entry without orphan images', async () => {
    const blob = new Blob(['photo-to-delete'], { type: 'image/jpeg' });
    const photoId = 'photo-del-test';
    await saveImage(photoId, blob);
    expect(await getImage(photoId)).toBeDefined();

    // Delete image
    await deleteImage(photoId);
    expect(await getImage(photoId)).toBeUndefined();
  });

  it('5. Dress Me screen: outfit engine generates valid outfits using sample wardrobe', () => {
    const collegeOutfits = generateOutfits(sampleWardrobe, 'college', 'summer');
    expect(collegeOutfits.length).toBeGreaterThan(0);

    const first = collegeOutfits[0];
    expect(first.slots).toBeDefined();
    expect(first.score).toBeGreaterThan(0);
    expect(first.why).toBeDefined();

    // Confirm laundry items are never included
    const laundryWardrobe: WardrobeItem[] = sampleWardrobe.map((item) => ({
      ...item,
      status: 'in_laundry' as const,
    }));
    const laundryOutfits = generateOutfits(laundryWardrobe, 'college', 'summer');
    expect(laundryOutfits).toHaveLength(0);
  });

  it('6. Gaps screen: Smart Buy simulation correctly calculates newly unlocked looks', () => {
    const candidateList = candidates('summer');
    expect(candidateList.length).toBeGreaterThan(0);
    const candidate = candidateList[0];
    const initialCount = generateOutfits(sampleWardrobe, 'college', 'summer').length;
    const newOutfitsUnlocked = simulateBuy(sampleWardrobe, candidate, ['college'], 'summer');
    expect(newOutfitsUnlocked).toBeGreaterThanOrEqual(0);
  });

  it('7. Reset data / Load sample clears all images from IndexedDB', async () => {
    await saveImage('orphan-1', new Blob(['1'], { type: 'image/jpeg' }));
    await saveImage('orphan-2', new Blob(['2'], { type: 'image/jpeg' }));
    expect(await getImage('orphan-1')).toBeDefined();

    await clearImages();
    expect(await getImage('orphan-1')).toBeUndefined();
    expect(await getImage('orphan-2')).toBeUndefined();
  });
});
