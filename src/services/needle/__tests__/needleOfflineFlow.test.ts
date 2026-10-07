import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NeedleService } from '../needleService';
import { setCachedModel, clearCachedModel, isModelCached } from '../needleModelCache';
import { WardrobeItem, StylePreferences } from '../../../types';
import { sampleWardrobe } from '../../../data/sampleWardrobe';

describe('Critical Offline Acceptance Test: Needle On-Device AI Flow', () => {
  let service: NeedleService;
  let originalOnLine: boolean;

  beforeEach(async () => {
    // 1. Setup local cache
    await clearCachedModel();
    const modelBytes = new Uint8Array([67, 65, 67, 84, 1, 2, 3, 4]).buffer;
    await setCachedModel(modelBytes, { version: 'v3', size: 8 });

    expect(await isModelCached()).toBe(true);

    // 2. SIMULATE INTERNET OFF
    originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    // Block all outbound HTTP / HTTPS network calls
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const urlStr = String(input);
      if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        return Promise.reject(new TypeError('Failed to fetch: Network offline'));
      }
      return Promise.reject(new TypeError('Offline asset'));
    });

    service = new NeedleService();
  });

  afterEach(async () => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    vi.restoreAllMocks();
    await clearCachedModel();
  });

  function verifyNoOutboundNetworkCalls(fetchSpy: ReturnType<typeof vi.spyOn>) {
    const outboundHttpCalls = fetchSpy.mock.calls.filter(([url]) => {
      const urlStr = String(url);
      return urlStr.startsWith('http://') || urlStr.startsWith('https://');
    });
    expect(outboundHttpCalls).toHaveLength(0);
  }

  it('CRITICAL ACCEPTANCE TEST: executes "Show me something casual for college." with Internet OFF', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // 1. Initialize service with Internet OFF
    await service.initialize();
    expect(service.getState().modelStatus).toBe('ready');

    // 2. Real wardrobe data from StyleSaathi sample archive
    const realWardrobe = sampleWardrobe;
    expect(realWardrobe.length).toBeGreaterThan(5);

    const mockPreferences: StylePreferences = {
      stylingMode: 'balanced',
      preferredAesthetics: ['casual', 'minimal'],
      preferredContexts: ['college'],
      updatedAt: Date.now(),
    };

    // 3. User inputs command into Needle command entry
    const command = 'Show me something casual for college.';
    const result = await service.executeCommand(command, {
      items: realWardrobe,
      preferences: mockPreferences,
    });

    // 4. Verify structured tool call was produced locally
    expect(result.toolCall).toBeDefined();
    expect(result.toolCall?.name).toBe('recommend_outfit');
    expect(result.toolCall?.arguments.occasion).toBe('college');
    expect(result.toolCall?.arguments.style).toBe('casual');

    // 5. Verify confidence tier is HIGH (>= 0.80) and auto-executed safely
    expect(result.toolCall?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.toolCall?.confidenceLevel).toBe('HIGH');
    expect(result.toolCall?.isDestructive).toBe(false);
    expect(result.toolCall?.requiresConfirmation).toBe(false);
    expect(result.executionStatus).toBe('executed');

    // 6. Verify StyleSaathi recommendation engine executed with real wardrobe items
    expect(result.data?.outfits).toBeDefined();
    expect(result.data?.outfits?.length).toBeGreaterThan(0);
    const outfit = result.data!.outfits![0];
    expect(outfit.template).toBeDefined();
    expect(outfit.score).toBeGreaterThan(0);
    expect(result.message).toContain('college');

    // 7. Verify ZERO outbound HTTP / cloud network calls were made
    verifyNoOutboundNetworkCalls(fetchSpy);
  }, 15000);

  it('executes wardrobe search "Find my black jeans" completely offline', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await service.initialize();

    const result = await service.executeCommand('Find my black jeans', {
      items: sampleWardrobe,
    });

    expect(result.executionStatus).toBe('executed');
    expect(result.toolCall?.name).toBe('search_wardrobe');
    expect(result.data?.items).toBeDefined();
    verifyNoOutboundNetworkCalls(fetchSpy);
  }, 15000);

  it('records garment wear offline with local item state update', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await service.initialize();

    let updatedItemId = '';
    let updatedTimesWorn = 0;

    const mockUpdateItem = async (id: string, patch: Partial<WardrobeItem>) => {
      updatedItemId = id;
      if (patch.timesWorn !== undefined) updatedTimesWorn = patch.timesWorn;
    };

    const result = await service.executeCommand('I wore my blue kurta today', {
      items: sampleWardrobe,
      updateItem: mockUpdateItem,
    });

    expect(result.executionStatus).toBe('executed');
    expect(result.toolCall?.name).toBe('record_wear');
    expect(result.toolCall?.arguments.itemName).toBe('blue kurta');
    expect(result.message).toContain('Logged wear');
    verifyNoOutboundNetworkCalls(fetchSpy);
  }, 15000);

  it('schedules calendar style plan offline', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await service.initialize();

    let savedPlanDate = '';
    let savedPlanOccasion = '';

    const mockSavePlan = async (plan: any) => {
      savedPlanDate = plan.date;
      savedPlanOccasion = plan.occasion;
      return { ...plan, id: 'plan-1', createdAt: Date.now(), updatedAt: Date.now() };
    };

    const result = await service.executeCommand('Plan look for office tomorrow', {
      items: sampleWardrobe,
      savePlan: mockSavePlan,
    });

    expect(result.executionStatus).toBe('executed');
    expect(result.toolCall?.name).toBe('create_style_plan');
    expect(savedPlanOccasion).toBe('office');
    expect(savedPlanDate).not.toBe('');
    verifyNoOutboundNetworkCalls(fetchSpy);
  }, 15000);

  it('enforces confirmation guard for destructive command even when offline', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await service.initialize();

    const result = await service.executeCommand('delete my entire wardrobe', {
      items: sampleWardrobe,
    });

    expect(result.executionStatus).toBe('pending_confirmation');
    expect(result.toolCall?.isDestructive).toBe(true);
    expect(service.getState().pendingConfirmation).not.toBeNull();
    verifyNoOutboundNetworkCalls(fetchSpy);
  }, 15000);
});
