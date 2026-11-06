import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NeedleService, needleService } from '../needleService';
import { WardrobeItem, StylePreferences } from '../../../types';
import { clearCachedModel, setCachedModel } from '../needleModelCache';

const sampleItems: WardrobeItem[] = [
  {
    id: 'item-1',
    name: 'Casual White T-Shirt',
    category: 'Tops',
    subcategory: 't-shirt',
    status: 'clean',
    seasons: ['summer'],
    occasions: ['college', 'casual outing', 'everyday'],
    colors: ['white'],
    formality: 1,
    favorite: false,
    note: '',
    timesWorn: 3,
    createdAt: Date.now(),
  },
  {
    id: 'item-2',
    name: 'Classic Black Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    status: 'clean',
    seasons: ['summer', 'winter'],
    occasions: ['college', 'casual outing', 'everyday'],
    colors: ['black'],
    formality: 2,
    favorite: false,
    note: '',
    timesWorn: 5,
    createdAt: Date.now(),
  },
  {
    id: 'item-3',
    name: 'White Sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    status: 'clean',
    seasons: ['summer', 'winter'],
    occasions: ['college', 'casual outing', 'everyday'],
    colors: ['white'],
    formality: 1,
    favorite: false,
    note: '',
    timesWorn: 8,
    createdAt: Date.now(),
  },
];

const mockPreferences: StylePreferences = {
  stylingMode: 'variety',
  preferredAesthetics: ['minimal', 'casual'],
  preferredContexts: ['college'],
  updatedAt: Date.now(),
};

describe('NeedleService', () => {
  let service: NeedleService;

  beforeEach(async () => {
    await clearCachedModel();
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    service = new NeedleService();
    vi.restoreAllMocks();
  });

  it('initializes and reports ready state', async () => {
    const states: string[] = [];
    service.subscribe((st) => states.push(st.serviceStatus));

    await service.initialize();

    expect(service.getState().serviceStatus).toBe('ready');
    expect(service.getState().modelStatus).toBe('ready');
  }, 15000);

  it('executes "Show me something casual for college." with HIGH confidence', async () => {
    await service.initialize();

    const result = await service.executeCommand('Show me something casual for college.', {
      items: sampleItems,
      preferences: mockPreferences,
    });

    expect(result.executionStatus).toBe('executed');
    expect(result.toolCall).toBeDefined();
    expect(result.toolCall?.name).toBe('recommend_outfit');
    expect(result.toolCall?.arguments.occasion).toBe('college');
    expect(result.data?.outfits).toBeDefined();
    expect(result.data?.outfits?.length).toBeGreaterThan(0);
    expect(result.message).toContain('college');
  }, 15000);

  it('executes wardrobe search "Find my black jeans"', async () => {
    await service.initialize();

    const result = await service.executeCommand('Find my black jeans', {
      items: sampleItems,
    });

    expect(result.executionStatus).toBe('executed');
    expect(result.toolCall?.name).toBe('search_wardrobe');
    expect(result.data?.items).toBeDefined();
    expect(result.data?.items?.length).toBe(1);
    expect(result.data?.items?.[0].id).toBe('item-2');
  }, 15000);

  it('gates destructive query with explicit confirmation requirement', async () => {
    await service.initialize();

    const result = await service.executeCommand('delete my entire wardrobe', {
      items: sampleItems,
    });

    expect(result.executionStatus).toBe('pending_confirmation');
    expect(service.getState().pendingConfirmation).not.toBeNull();
    expect(service.getState().pendingConfirmation?.toolCall.isDestructive).toBe(true);
  }, 15000);

  it('gates medium-confidence ambiguous query with pending confirmation', async () => {
    await service.initialize();

    const result = await service.executeCommand('maybe something nice for later', {
      items: sampleItems,
    });

    expect(result.executionStatus).toBe('pending_confirmation');
    expect(result.toolCall?.confidenceLevel).toBe('MEDIUM');
    expect(service.getState().pendingConfirmation).not.toBeNull();
  }, 15000);

  it('executes pending action upon confirmAction()', async () => {
    await service.initialize();

    const initial = await service.executeCommand('maybe something nice for later', {
      items: sampleItems,
    });
    expect(initial.executionStatus).toBe('pending_confirmation');

    const pending = service.getState().pendingConfirmation!;
    expect(pending).toBeDefined();

    const confirmed = await service.confirmAction(pending.id, {
      items: sampleItems,
    });

    expect(confirmed.executionStatus).toBe('executed');
    expect(service.getState().pendingConfirmation).toBeNull();
  }, 15000);

  it('discards pending action upon cancelAction()', async () => {
    await service.initialize();

    await service.executeCommand('maybe something nice for later', {
      items: sampleItems,
    });

    const pending = service.getState().pendingConfirmation!;
    expect(pending).toBeDefined();

    service.cancelAction(pending.id);
    expect(service.getState().pendingConfirmation).toBeNull();
  }, 15000);

  it('rejects low confidence queries (< 0.50)', async () => {
    await service.initialize();

    const result = await service.executeCommand('xyzzy 1234 foobar quantum rocket', {
      items: sampleItems,
    });

    expect(result.executionStatus).toBe('rejected');
    expect(result.message).toContain('clarify');
  }, 15000);

  it('rejects record_wear when garment needs washing or is in laundry', async () => {
    await service.initialize();

    const dirtyItems: WardrobeItem[] = [
      {
        ...sampleItems[0],
        id: 'dirty-1',
        name: 'Muddy White T-Shirt',
        status: 'needs_washing',
      },
      {
        ...sampleItems[1],
        id: 'laundry-2',
        name: 'Dry Clean Black Jeans',
        status: 'in_laundry',
      },
    ];

    const mockUpdateItem = vi.fn().mockResolvedValue(undefined);

    // 1. Garment needing wash is rejected
    const dirtyResult = await service.executeCommand('I wore my Muddy White T-Shirt today', {
      items: dirtyItems,
      updateItem: mockUpdateItem,
    });

    expect(dirtyResult.executionStatus).toBe('rejected');
    expect(dirtyResult.message).toContain('needs washing');
    expect(dirtyResult.reasoning).toContain('needs washing');
    expect(mockUpdateItem).not.toHaveBeenCalled();

    // 2. Garment in laundry is rejected
    const laundryResult = await service.executeCommand('I wore my Dry Clean Black Jeans today', {
      items: dirtyItems,
      updateItem: mockUpdateItem,
    });

    expect(laundryResult.executionStatus).toBe('rejected');
    expect(laundryResult.message).toContain('in laundry');
    expect(laundryResult.reasoning).toContain('in laundry');
    expect(mockUpdateItem).not.toHaveBeenCalled();
  }, 15000);

  it('executes record_wear and updates item when garment is clean', async () => {
    await service.initialize();

    const mockUpdateItem = vi.fn().mockResolvedValue(undefined);

    const result = await service.executeCommand('I wore my Casual White T-Shirt today', {
      items: sampleItems,
      updateItem: mockUpdateItem,
    });

    expect(result.executionStatus).toBe('executed');
    expect(result.message).toContain('Logged wear');
    expect(mockUpdateItem).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({
        timesWorn: 4,
      })
    );
  }, 15000);
});
