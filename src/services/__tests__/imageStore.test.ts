import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveImage,
  getImage,
  deleteImage,
  clearImages,
  getImageUrl,
  revokeImageUrl,
} from '../imageStore';

const mockDb = new Map<string, any>();

vi.mock('idb-keyval', () => ({
  createStore: () => ({}),
  set: vi.fn(async (key: string, val: any) => {
    mockDb.set(key, val);
  }),
  get: vi.fn(async (key: string) => {
    return mockDb.get(key);
  }),
  del: vi.fn(async (key: string) => {
    mockDb.delete(key);
  }),
  clear: vi.fn(async () => {
    mockDb.clear();
  }),
}));

describe('imageStore Service', () => {
  beforeEach(async () => {
    await clearImages();
    mockDb.clear();
    vi.clearAllMocks();
  });

  const testBlob = new Blob(['sample-image-content'], { type: 'image/jpeg' });

  it('saves and retrieves an image blob from IndexedDB', async () => {
    await saveImage('photo-123', testBlob);
    const retrieved = await getImage('photo-123');

    expect(retrieved).toBeDefined();
    expect(retrieved).toBeInstanceOf(Blob);
    expect(retrieved?.type).toBe('image/jpeg');
  });

  it('deletes an image from IndexedDB', async () => {
    await saveImage('photo-to-delete', testBlob);
    expect(await getImage('photo-to-delete')).toBeDefined();

    await deleteImage('photo-to-delete');
    expect(await getImage('photo-to-delete')).toBeUndefined();
  });

  it('clears all stored images', async () => {
    await saveImage('photo-a', testBlob);
    await saveImage('photo-b', testBlob);

    await clearImages();
    expect(await getImage('photo-a')).toBeUndefined();
    expect(await getImage('photo-b')).toBeUndefined();
  });

  it('caches and returns an object URL via getImageUrl', async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    const mockCreateObjectURL = vi.fn((blob: Blob) => `blob:http://localhost/${Math.random()}`);
    const mockRevokeObjectURL = vi.fn();

    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    try {
      await saveImage('photo-cached', testBlob);

      const url1 = await getImageUrl('photo-cached');
      expect(url1).toBeDefined();
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);

      // Second call should return cached URL without calling createObjectURL again
      const url2 = await getImageUrl('photo-cached');
      expect(url2).toBe(url1);
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);

      // Revoking should clear the cached URL
      revokeImageUrl('photo-cached');
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url1);

      // Subsequent call creates a new object URL
      const url3 = await getImageUrl('photo-cached');
      expect(url3).toBeDefined();
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(2);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
