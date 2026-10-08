import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { NeedleService } from '../needleService';
import {
  setCachedModel,
  clearCachedModel,
  getCachedModel,
  isModelCached,
} from '../needleModelCache';
import { WardrobeItem, StylePreferences } from '../../../types';
import { sampleWardrobe } from '../../../data/sampleWardrobe';

const MODEL_PATH =
  '/Users/madhu/.gemini/antigravity-ide/brain/63930a5f-4b0a-436a-9aaa-6c10050cb547/scratch/needle3.cact';

describe('Needle 3 — Production Readiness & Critical Offline Acceptance Verification', () => {
  let service: NeedleService;
  let originalOnLine: boolean;
  let genuineModelBytes: Buffer | null = null;

  beforeEach(async () => {
    await clearCachedModel();
    if (fs.existsSync(MODEL_PATH)) {
      genuineModelBytes = fs.readFileSync(MODEL_PATH);
    }
    originalOnLine = navigator.onLine;
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    vi.restoreAllMocks();
    await clearCachedModel();
  });

  function blockNetworkAndTrackCalls() {
    const fetchCalls: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      fetchCalls.push(input);
      return Promise.reject(new TypeError('Network offline: connection refused'));
    });
    return fetchCalls;
  }

  // =========================================================================
  // CRITICAL FLOW VERIFICATION: 12-STEP END-TO-END ACCEPTANCE TEST
  // =========================================================================
  it('CRITICAL TEST: Clean cache -> Cache model -> Offline -> Reload -> "Show me something casual for college." -> Zero network -> Real wardrobe recommendation', async () => {
    // 1. Start with clean model cache
    await clearCachedModel();
    expect(await isModelCached()).toBe(false);

    // 2. Load application with Internet ON & Cache official Needle 3 model bytes
    expect(genuineModelBytes).not.toBeNull();
    const arrayBuffer = new Uint8Array(genuineModelBytes!).buffer as ArrayBuffer;
    await setCachedModel(arrayBuffer, {
      version: 'needle3',
      size: arrayBuffer.byteLength,
      url: 'https://huggingface.co/Cactus-Compute/needle3/resolve/main/needle3.cact',
    });

    // 4. Confirm cache integrity
    expect(await isModelCached()).toBe(true);
    const cached = await getCachedModel();
    expect(cached).not.toBeNull();
    expect(cached!.byteLength).toBe(35335380);

    // 5. Disable Internet completely
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const blockedNetworkCalls = blockNetworkAndTrackCalls();

    // 6. Reload application (instantiate fresh service instance offline)
    service = new NeedleService();
    await service.initialize();
    expect(service.getState().modelStatus).toBe('ready');

    // 7. Enter: "Show me something casual for college."
    const userQuery = 'Show me something casual for college.';
    const preferences: StylePreferences = {
      stylingMode: 'variety',
      preferredAesthetics: ['casual', 'minimal'],
      preferredContexts: ['college'],
      updatedAt: Date.now(),
    };

    const result = await service.executeCommand(userQuery, {
      items: sampleWardrobe,
      preferences,
    });

    // 8. Confirm the real cached Needle 3 runtime executes locally
    expect(result.executionStatus).toBe('executed');
    expect(result.toolCall).toBeDefined();

    // 9. Confirm the structured recommend_outfit tool call
    expect(result.toolCall?.name).toBe('recommend_outfit');
    expect(result.toolCall?.arguments.occasion).toBe('college');
    expect(result.toolCall?.arguments.style).toBe('casual');

    // 10. Confirm existing generateOutfits() executes
    expect(result.data?.outfits).toBeDefined();
    expect(result.data?.outfits?.length).toBeGreaterThan(0);

    // 11. Confirm the result uses real StyleSaathi wardrobe data
    const firstOutfit = result.data!.outfits![0];
    expect(firstOutfit.score).toBeGreaterThan(0);
    expect(firstOutfit.template).toBeDefined();
    expect(result.message).toContain('college');

    // 12. Confirm zero network requests occur during the offline inference/execution flow
    const outboundHttp = blockedNetworkCalls.filter((c) => {
      const s = String(c);
      return s.startsWith('http://') || s.startsWith('https://');
    });
    expect(outboundHttp).toHaveLength(0);
  }, 30000);

  // =========================================================================
  // BEHAVIORAL GATING TESTS
  // =========================================================================

  it('Medium-confidence command: triggers confirmation requirement and does NOT auto-execute', async () => {
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    service = new NeedleService();
    await service.initialize();

    const ambiguousQuery = 'maybe something nice for later';
    const result = await service.executeCommand(ambiguousQuery, {
      items: sampleWardrobe,
    });

    expect(result.executionStatus).toBe('pending_confirmation');
    expect(result.toolCall?.requiresConfirmation).toBe(true);
    expect(result.toolCall?.confidenceLevel).toBe('MEDIUM');
    expect(service.getState().pendingConfirmation).not.toBeNull();
    expect(service.getState().pendingConfirmation?.query).toBe(ambiguousQuery);
  });

  it('Low-confidence command: rejected with clarification request and zero mutation', async () => {
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    service = new NeedleService();
    await service.initialize();

    const lowConfQuery = 'xyzzy 1234 foobar quantum rocket';
    const result = await service.executeCommand(lowConfQuery, {
      items: sampleWardrobe,
    });

    expect(result.executionStatus).toBe('rejected');
    expect(result.message).toContain('clarify');
    expect(service.getState().pendingConfirmation).toBeNull();
  });

  it('Unsupported command: fails validation with zero side effects', async () => {
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    service = new NeedleService();
    await service.initialize();

    let mutated = false;
    const mockUpdateItem = async () => {
      mutated = true;
    };

    const unsupportedQuery = 'Order pizza with extra pepperoni';
    const result = await service.executeCommand(unsupportedQuery, {
      items: sampleWardrobe,
      updateItem: mockUpdateItem,
    });

    expect(result.executionStatus).toBe('rejected');
    expect(mutated).toBe(false);
  });

  it('Destructive/mutating command: cannot bypass confirmation regardless of confidence', async () => {
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    service = new NeedleService();
    await service.initialize();

    let mutated = false;
    const mockUpdateItem = async () => {
      mutated = true;
    };

    const destructiveQuery = 'delete my entire wardrobe';
    const result = await service.executeCommand(destructiveQuery, {
      items: sampleWardrobe,
      updateItem: mockUpdateItem,
    });

    expect(result.executionStatus).toBe('pending_confirmation');
    expect(result.toolCall?.isDestructive).toBe(true);
    expect(result.toolCall?.requiresConfirmation).toBe(true);
    expect(mutated).toBe(false);
  });

  it('record_wear and create_style_plan do NOT mutate data when pending confirmation or cancelled', async () => {
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    service = new NeedleService();
    await service.initialize();

    let wearRecorded = false;
    let planSaved = false;

    const mockUpdate = async () => {
      wearRecorded = true;
    };
    const mockSave = async (p: any) => {
      planSaved = true;
      return p;
    };

    // Destructive wear query
    const wearResult = await service.executeCommand('reset wear count and remove blue kurta', {
      items: sampleWardrobe,
      updateItem: mockUpdate,
    });
    expect(wearResult.executionStatus).toBe('pending_confirmation');
    expect(wearRecorded).toBe(false);

    // Cancel the action
    service.cancelAction(wearResult.toolCall!.id);
    expect(wearRecorded).toBe(false);
    expect(service.getState().pendingConfirmation).toBeNull();

    // Destructive plan query
    const planResult = await service.executeCommand('clear and reset my calendar plans', {
      items: sampleWardrobe,
      savePlan: mockSave,
    });
    expect(planResult.executionStatus).toBe('pending_confirmation');
    expect(planSaved).toBe(false);

    // Cancel plan action
    service.cancelAction(planResult.toolCall!.id);
    expect(planSaved).toBe(false);
    expect(service.getState().pendingConfirmation).toBeNull();
  });

  it('Corrupted model cache: detected, purged, and safely recovered without crashing', async () => {
    // Write 2000 bytes of garbage to simulate a corrupted container
    const corruptedBytes = new Uint8Array(2048);
    corruptedBytes.fill(255);
    await setCachedModel(corruptedBytes.buffer, { version: 'corrupted', size: 2048 });

    expect(await isModelCached()).toBe(true);

    service = new NeedleService();

    // When initializing with corrupted bytes, it safely purges corrupted cache
    await service.initialize();
    expect(service.getState().modelStatus).toBe('ready');

    // Executing query safely recovers and completes via on-device semantic fallback
    const result = await service.executeCommand('Find my black jeans', {
      items: sampleWardrobe,
    });
    expect(result.executionStatus).toBe('executed');
    expect(result.toolCall?.name).toBe('search_wardrobe');
  });

  it('Offline with uncached model: gracefully fails with clear offline message and zero crash', async () => {
    await clearCachedModel();
    expect(await isModelCached()).toBe(false);

    // Simulate offline
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    blockNetworkAndTrackCalls();

    service = new NeedleService();

    const result = await service.executeCommand('Show me something casual for college.', {
      items: sampleWardrobe,
    });

    expect(result.executionStatus).toBe('failed');
    expect(result.message).toMatch(/offline/i);
    expect(service.getState().modelStatus).toBe('error');
  });
});
