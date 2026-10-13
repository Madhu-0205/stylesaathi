import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isQuotaExceededError,
  isIndexedDBAvailable,
  requestPersistentStorage,
  checkStorageStatus,
  getStorageRecoveryModel,
} from '../storageResilience';

describe('Storage Resilience & Recovery Service', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('isQuotaExceededError', () => {
    it('detects standard DOMException QuotaExceededError', () => {
      const err = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      expect(isQuotaExceededError(err)).toBe(true);
    });

    it('detects legacy error code 22 for quota exceeded', () => {
      const err = { name: 'QuotaExceededError', code: 22 };
      expect(isQuotaExceededError(err)).toBe(true);
    });

    it('detects Firefox NS_ERROR_DOM_QUOTA_REACHED', () => {
      const err = { name: 'NS_ERROR_DOM_QUOTA_REACHED' };
      expect(isQuotaExceededError(err)).toBe(true);
    });

    it('returns false for generic errors or other DOM exceptions', () => {
      expect(isQuotaExceededError(new Error('Network failure'))).toBe(false);
      expect(isQuotaExceededError(new DOMException('Not found', 'NotFoundError'))).toBe(false);
      expect(isQuotaExceededError(null)).toBe(false);
      expect(isQuotaExceededError(undefined)).toBe(false);
    });
  });

  describe('isIndexedDBAvailable', () => {
    it('returns boolean indicating indexedDB support in environment', () => {
      const available = isIndexedDBAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('requestPersistentStorage', () => {
    it('requests persistent storage when navigator.storage.persist is available', async () => {
      const mockPersist = vi.fn().mockResolvedValue(true);
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          storage: {
            persist: mockPersist,
          },
        },
        writable: true,
        configurable: true,
      });

      const granted = await requestPersistentStorage();
      expect(granted).toBe(true);
      expect(mockPersist).toHaveBeenCalledTimes(1);
    });

    it('handles rejection or exception gracefully without throwing', async () => {
      const mockPersist = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          storage: {
            persist: mockPersist,
          },
        },
        writable: true,
        configurable: true,
      });

      const granted = await requestPersistentStorage();
      expect(granted).toBe(false);
    });

    it('returns false if storage API is unavailable', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });

      const granted = await requestPersistentStorage();
      expect(granted).toBe(false);
    });
  });

  describe('checkStorageStatus', () => {
    it('correctly calculates usage and quota percentages', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          storage: {
            persisted: vi.fn().mockResolvedValue(true),
            estimate: vi.fn().mockResolvedValue({
              usage: 25000000, // 25 MB
              quota: 100000000, // 100 MB
            }),
          },
        },
        writable: true,
        configurable: true,
      });

      const status = await checkStorageStatus();
      expect(status.isPersisted).toBe(true);
      expect(status.usageBytes).toBe(25000000);
      expect(status.quotaBytes).toBe(100000000);
      expect(status.percentageUsed).toBe(25);
    });
  });

  describe('getStorageRecoveryModel', () => {
    it('honestly reports unrecoverable data on local eviction for guest users', () => {
      const guestModel = getStorageRecoveryModel(true);
      expect(guestModel.strategy).toBe('UNRECOVERABLE_LOCAL_EVICTION');
      expect(guestModel.description).toContain('As a guest, your wardrobe is saved strictly on this device');
      expect(guestModel.description).toContain('cannot be recovered');
    });

    it('reports Supabase cloud rehydration for authenticated users', () => {
      const authModel = getStorageRecoveryModel(false);
      expect(authModel.strategy).toBe('SUPABASE_REHYDRATION');
      expect(authModel.description).toContain('synchronized with the cloud');
      expect(authModel.description).toContain('automatically rehydrate from Supabase');
    });
  });
});
