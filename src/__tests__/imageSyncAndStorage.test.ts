import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncService } from '../lib/sync/syncService';
import { syncQueue } from '../lib/sync/syncQueue';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { saveImage } from '../services/imageStore';
import { User, WardrobeItem } from '../types';

const { mockUpload, mockSignedUrl, mockRemove } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockSignedUrl: vi.fn(),
  mockRemove: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
    storage: {
      from: () => ({
        upload: mockUpload,
        createSignedUrl: mockSignedUrl,
        remove: mockRemove,
      }),
    },
  }),
}));

describe('Production Image Synchronization & Storage Security', () => {
  const user: User = {
    id: 'user_img_test_1',
    email: 'test@example.com',
    name: 'Test Stylist',
    isGuest: false,
    createdAt: Date.now(),
  };

  const sampleItem: WardrobeItem = {
    id: 'item-img-01',
    name: 'Banarasi Saree',
    category: 'Ethnic',
    subcategory: 'saree',
    colors: ['gold', 'red'],
    seasons: ['winter'],
    occasions: ['festive', 'wedding guest'],
    formality: 5,
    status: 'clean',
    favorite: true,
    note: '',
    timesWorn: 0,
    photoId: 'photo-v1',
    photoUrl: 'https://storage.supabase/wardrobe/user_img_test_1/item-img-01/photo-v1.jpg',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await syncQueue.clear();
    await wardrobeRepository.clear();
    syncService.setCurrentUser(user);
    await wardrobeRepository.addItem(sampleItem);

    // Save dummy blob in local image store
    const blob = new Blob(['image content'], { type: 'image/jpeg' });
    await saveImage('photo-v1', blob);
    await saveImage('photo-v2', blob);
  });

  it('uploads, verifies, and activates new image URL upon successful upload', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase/verified-signed-url.jpg' },
      error: null,
    });

    await syncQueue.enqueue({
      entityType: 'wardrobe_image',
      entityId: 'photo-v1',
      operation: 'UPLOAD_IMAGE',
      payload: {
        itemId: 'item-img-01',
        photoId: 'photo-v1',
        storagePath: `wardrobe/${user.id}/item-img-01/photo-v1.jpg`,
      },
    });

    await syncService.processQueue();

    expect(mockUpload).toHaveBeenCalledWith(
      `wardrobe/${user.id}/item-img-01/photo-v1.jpg`,
      expect.any(File),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true })
    );
    expect(mockSignedUrl).toHaveBeenCalledWith(
      `wardrobe/${user.id}/item-img-01/photo-v1.jpg`,
      60
    );

    // Local item updated with verified URL
    const updated = await wardrobeRepository.getItem('item-img-01');
    expect(updated?.photoUrl).toBe('https://storage.supabase/verified-signed-url.jpg');
  });

  // ==========================================================================
  // I. Image Upload Failure
  // ==========================================================================
  describe('I. Image upload failure', () => {
    it('preserves existing local image if cloud upload fails, and retries mutation', async () => {
      mockUpload.mockRejectedValue(new Error('Network timeout during file upload'));

      await syncQueue.enqueue({
        entityType: 'wardrobe_image',
        entityId: 'photo-v1',
        operation: 'UPLOAD_IMAGE',
        payload: {
          itemId: 'item-img-01',
          photoId: 'photo-v1',
          storagePath: `wardrobe/${user.id}/item-img-01/photo-v1.jpg`,
        },
      });

      await syncService.processQueue();

      // Mutation is marked failed for retry
      const allMutations = await syncQueue.getAllMutations();
      expect(allMutations[0].attemptCount).toBe(1);
      expect(allMutations[0].lastError).toContain('Network timeout');

      // Local item still exists and has original image reference intact
      const item = await wardrobeRepository.getItem('item-img-01');
      expect(item?.photoUrl).toBe(sampleItem.photoUrl);
    });
  });

  // ==========================================================================
  // J. Image Replacement Failure
  // ==========================================================================
  describe('J. Image replacement failure (Safe 2-Phase Swap)', () => {
    it('keeps previous active image version if replacement image fails verification', async () => {
      const originalUrl = sampleItem.photoUrl;

      // Upload succeeds, but verification fails (e.g. object not readable / permission issue)
      mockUpload.mockResolvedValue({ error: null });
      mockSignedUrl.mockResolvedValue({ data: null, error: new Error('Verification failed') });

      await syncQueue.enqueue({
        entityType: 'wardrobe_image',
        entityId: 'photo-v2',
        operation: 'UPLOAD_IMAGE',
        payload: {
          itemId: 'item-img-01',
          photoId: 'photo-v2',
          storagePath: `wardrobe/${user.id}/item-img-01/photo-v2.jpg`,
        },
      });

      await syncService.processQueue();

      // Item photoUrl must NOT be overwritten with an unverified URL!
      const item = await wardrobeRepository.getItem('item-img-01');
      expect(item?.photoUrl).toBe(originalUrl);
    });

    it('does NOT break active image if cleanup of retired image version fails', async () => {
      mockRemove.mockResolvedValue({ error: new Error('Failed to delete old version') });

      await syncQueue.enqueue({
        entityType: 'wardrobe_image',
        entityId: 'photo-v1',
        operation: 'DELETE_IMAGE',
        payload: {
          itemId: 'item-img-01',
          photoId: 'photo-v1',
          storagePath: `wardrobe/${user.id}/item-img-01/photo-v1.jpg`,
        },
      });

      // Cleanup failure should be caught gracefully without crashing
      await expect(syncService.processQueue()).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // 2. Authoritative Image Version vs Obsolete photo_url
  // ==========================================================================
  describe('2. Authoritative Image Version vs Obsolete photo_url', () => {
    it('proves an obsolete/stale photo_url cannot override the active image version', async () => {
      // Set active image version on local item
      await wardrobeRepository.updateItem('item-img-01', {
        activeImageVersionId: 'photo-v1',
        storagePath: `wardrobe/${user.id}/item-img-01/photo-v1.jpg`,
        photoUrl: 'https://storage.supabase/verified-v1.jpg',
      });

      const { resolveWardrobeItemConflict } = await import('../lib/sync/conflictResolvers');
      const current = (await wardrobeRepository.getItem('item-img-01'))!;
      const staleIncoming: WardrobeItem = {
        ...current,
        activeImageVersionId: undefined,
        storagePath: undefined,
        photoUrl: 'https://obsolete-legacy-bucket.com/stale-unverified.jpg',
      };

      const resolved = resolveWardrobeItemConflict(current, staleIncoming);

      // Active image version MUST win as authoritative cloud identity
      expect(resolved.activeImageVersionId).toBe('photo-v1');
      expect(resolved.storagePath).toBe(`wardrobe/${user.id}/item-img-01/photo-v1.jpg`);
      expect(resolved.photoUrl).toBe('https://storage.supabase/verified-v1.jpg');
      expect(resolved.photoUrl).not.toBe('https://obsolete-legacy-bucket.com/stale-unverified.jpg');
    });
  });
});

