import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedModel,
  setCachedModel,
  isModelCached,
  clearCachedModel,
  downloadAndCacheModel,
} from '../needleModelCache';

describe('needleModelCache', () => {
  beforeEach(async () => {
    await clearCachedModel();
    vi.restoreAllMocks();
  });

  it('reports isModelCached as false when empty', async () => {
    const cached = await isModelCached();
    expect(cached).toBe(false);
    const model = await getCachedModel();
    expect(model).toBeNull();
  });

  it('caches and retrieves ArrayBuffer correctly', async () => {
    const dummyBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    await setCachedModel(dummyBuffer, { version: 'v3', size: 5 });

    const cached = await isModelCached();
    expect(cached).toBe(true);

    const retrieved = await getCachedModel();
    expect(retrieved).not.toBeNull();
    expect(new Uint8Array(retrieved!)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('clears cached model correctly', async () => {
    const dummyBuffer = new Uint8Array([10, 20, 30]).buffer;
    await setCachedModel(dummyBuffer);
    expect(await isModelCached()).toBe(true);

    await clearCachedModel();
    expect(await isModelCached()).toBe(false);
    expect(await getCachedModel()).toBeNull();
  });

  it('downloads and caches model with progress callback', async () => {
    const mockBytes = new Uint8Array([67, 65, 67, 84, 1, 2, 3]); // "CACT..."
    const progressUpdates: number[] = [];

    // Custom stream to test reader and progress
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(mockBytes.slice(0, 4));
        controller.enqueue(mockBytes.slice(4));
        controller.close();
      },
    });

    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-length': String(mockBytes.byteLength) }),
      body: stream,
      arrayBuffer: async () => mockBytes.buffer,
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const buffer = await downloadAndCacheModel('https://example.com/needle3.cact', (pct) => {
      progressUpdates.push(pct);
    });

    expect(new Uint8Array(buffer)).toEqual(mockBytes);
    expect(await isModelCached()).toBe(true);
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  }, 15000);

  it('loads directly from cache if already cached without downloading', async () => {
    const cachedBytes = new Uint8Array([99, 98, 97]).buffer;
    await setCachedModel(cachedBytes);

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const progressUpdates: number[] = [];

    const buffer = await downloadAndCacheModel('https://example.com/needle3.cact', (pct) => {
      progressUpdates.push(pct);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(new Uint8Array(buffer)).toEqual(new Uint8Array([99, 98, 97]));
    expect(progressUpdates).toContain(100);
  });

  it('throws helpful error if offline and model is not cached', async () => {
    // Simulate offline
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      await expect(downloadAndCacheModel('https://example.com/needle3.cact')).rejects.toThrow(
        /offline/i
      );
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });
});
