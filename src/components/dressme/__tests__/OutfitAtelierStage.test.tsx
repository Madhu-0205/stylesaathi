// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { OutfitAtelierStage } from '../OutfitAtelierStage';
import { WardrobeItem, GeneratedOutfit } from '../../../types';

const mockUseWardrobeContext = vi.fn();
vi.mock('../../../context/WardrobeContext', () => ({
  useWardrobeContext: () => mockUseWardrobeContext(),
}));

const mockAnchorItem: WardrobeItem = {
  id: 'anchor-kurta-1',
  name: 'Handloom Raw Silk Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  fabric: 'silk',
  colors: ['ivory', 'gold'],
  status: 'clean',
  timesWorn: 3,
  occasions: ['festive', 'wedding guest'],
  seasons: ['winter', 'summer'],
  formality: 4,
  note: 'Heritage piece',
  favorite: true,
  createdAt: Date.now(),
};

const mockBottomItem: WardrobeItem = {
  id: 'bottom-trousers-1',
  name: 'Tailored Cream Churidar',
  category: 'Ethnic',
  subcategory: 'churidar',
  fabric: 'cotton',
  colors: ['cream'],
  status: 'clean',
  timesWorn: 2,
  occasions: ['festive', 'wedding guest'],
  seasons: ['summer', 'winter'],
  formality: 4,
  note: '',
  favorite: false,
  createdAt: Date.now(),
};

const mockBottomItemAlt: WardrobeItem = {
  id: 'bottom-dhoti-2',
  name: 'Raw Silk Tussar Dhoti',
  category: 'Ethnic',
  subcategory: 'dhoti',
  fabric: 'silk',
  colors: ['gold'],
  status: 'clean',
  timesWorn: 1,
  occasions: ['festive', 'wedding guest'],
  seasons: ['winter'],
  formality: 5,
  note: '',
  favorite: false,
  createdAt: Date.now(),
};

const mockOuterItem: WardrobeItem = {
  id: 'outer-nehru-1',
  name: 'Brocade Nehru Jacket',
  category: 'Ethnic',
  subcategory: 'nehru jacket',
  fabric: 'banarasi',
  colors: ['maroon', 'gold'],
  status: 'clean',
  timesWorn: 4,
  occasions: ['festive', 'wedding guest'],
  seasons: ['winter'],
  formality: 5,
  note: '',
  favorite: true,
  createdAt: Date.now(),
};

const mockAccessoryItem: WardrobeItem = {
  id: 'acc-mojari-1',
  name: 'Embroidered Mojaris',
  category: 'Footwear',
  subcategory: 'juttis',
  fabric: 'silk',
  colors: ['gold'],
  status: 'clean',
  timesWorn: 2,
  occasions: ['festive'],
  seasons: ['winter'],
  formality: 4,
  note: '',
  favorite: false,
  createdAt: Date.now(),
};

const mockOutfit1: GeneratedOutfit = {
  template: 'festive_royal_heritage',
  score: 96,
  why: 'Silk kurta pairs harmoniously with brocade Nehru jacket',
  slots: {
    top: [mockAnchorItem],
    bottom: [mockBottomItem],
    outerwear: [mockOuterItem],
  },
  explanation: {
    headline: 'Festive Royal Heritage',
    reasons: [
      'Silk kurta pairs harmoniously with brocade Nehru jacket',
      'Cream churidar provides balanced neutral foundation',
    ],
    evidenceSources: ['cultural', 'compatibility'],
  },
};

const mockOutfit2: GeneratedOutfit = {
  template: 'ceremonial_tussar_luxe',
  score: 93,
  why: 'Tussar dhoti elevates cultural formality',
  slots: {
    top: [mockAnchorItem],
    bottom: [mockBottomItemAlt],
    outerwear: [mockOuterItem],
  },
  explanation: {
    headline: 'Ceremonial Tussar Luxe',
    reasons: ['Tussar dhoti elevates cultural formality'],
    evidenceSources: ['cultural'],
  },
};

describe('OutfitAtelierStage — Milestone C: 3D Layered Composition', () => {
  let container: HTMLDivElement;
  let root: Root;

  const onSelectAnchor = vi.fn();
  const onUnlockAnchor = vi.fn();
  const onSelectAccessory = vi.fn();
  const onSaveOutfit = vi.fn().mockResolvedValue(true);
  const onMarkWorn = vi.fn().mockResolvedValue(undefined);
  const onPlanLook = vi.fn();
  const onInspectItem = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockUseWardrobeContext.mockReturnValue({
      preferences: {
        preferredColors: ['gold', 'cream'],
        dislikedColors: [],
      },
      styleProfile: {
        dominantFormality: 4,
        styleVibes: ['Classic Indian', 'Modern Heritage'],
      },
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the empty atelier stage when no anchor item is locked', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={null}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={null}
          allOutfits={[]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
        />
      );
    });

    expect(container.textContent).toContain('Lock an Anchor Piece');
    expect(container.textContent).toContain('Choose Anchor Garment');

    const selectBtn = container.querySelector('button[aria-label="Select anchor garment to begin composition"]');
    expect(selectBtn).toBeTruthy();

    act(() => {
      selectBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelectAnchor).toHaveBeenCalledTimes(1);
  });

  it('renders locked anchor piece with 3D elevation and anchor badge', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1, mockOutfit2]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[mockAccessoryItem]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
          onPlanLook={onPlanLook}
          onInspectItem={onInspectItem}
        />
      );
    });

    // Anchor slot must be marked
    const anchorSlot = container.querySelector('[data-anchor="true"]');
    expect(anchorSlot).toBeTruthy();
    expect(anchorSlot?.textContent).toContain('Handloom Raw Silk Kurta');
    expect(anchorSlot?.textContent).toContain('ANCHOR');

    // Anchor piece 3D transform contains translate3d(..., 60px) and scale3d(1.04, ...)
    const anchorStyle = (anchorSlot as HTMLElement).style.transform;
    expect(anchorStyle).toContain('60px');
    expect(anchorStyle).toContain('1.04');

    // Section should have 3D perspective styling
    const stageContainer = container.querySelector('[style*="perspective"]');
    expect(stageContainer).toBeTruthy();
  });

  it('allows cycling alternative candidates within a slot without altering the anchor', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1, mockOutfit2]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[mockAccessoryItem]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
        />
      );
    });

    // Initially bottom slot shows Tailored Cream Churidar
    const bottomSlot = container.querySelector('[data-testid="atelier-slot-bottom"]');
    expect(bottomSlot).toBeTruthy();
    expect(bottomSlot?.textContent).toContain('Tailored Cream Churidar');

    // Bottom slot has candidate cycler buttons (2 options: Churidar and Dhoti)
    const nextBottomBtn = bottomSlot?.querySelector('button[aria-label="Next bottom option"]');
    expect(nextBottomBtn).toBeTruthy();

    act(() => {
      nextBottomBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // After cycling, bottom slot now shows Raw Silk Tussar Dhoti
    expect(container.querySelector('[data-testid="atelier-slot-bottom"]')?.textContent).toContain(
      'Raw Silk Tussar Dhoti'
    );

    // Anchor piece remains untouched
    const anchorSlot = container.querySelector('[data-anchor="true"]');
    expect(anchorSlot?.textContent).toContain('Handloom Raw Silk Kurta');
  });

  it('allows removing an optional layer and provides a restore pill', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
        />
      );
    });

    // Outerwear slot is initially present
    const outerSlot = container.querySelector('[data-testid="atelier-slot-outerwear"]');
    expect(outerSlot).toBeTruthy();

    const removeOuterBtn = outerSlot?.querySelector('button[aria-label*="Remove outerwear layer"]');
    expect(removeOuterBtn).toBeTruthy();

    act(() => {
      removeOuterBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Outerwear slot is removed from composition
    expect(container.querySelector('[data-testid="atelier-slot-outerwear"]')).toBeNull();

    // A restore pill appears
    expect(container.textContent).toContain('Restore removed layer');
    const restoreBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('outerwear')
    );
    expect(restoreBtn).toBeTruthy();

    // Click restore
    act(() => {
      restoreBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Outerwear slot is restored
    expect(container.querySelector('[data-testid="atelier-slot-outerwear"]')).toBeTruthy();
  });

  it('does not show a remove button for the locked anchor slot', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
        />
      );
    });

    const anchorSlot = container.querySelector('[data-anchor="true"]');
    const removeBtn = anchorSlot?.querySelector('button[aria-label*="Remove"]');
    expect(removeBtn).toBeNull();
  });

  it('triggers onSaveOutfit when clicking Save to Lookbook', async () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
        />
      );
    });

    const saveBtn = container.querySelector('button[aria-label="Save this outfit to your lookbook"]');
    expect(saveBtn).toBeTruthy();

    await act(async () => {
      saveBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSaveOutfit).toHaveBeenCalledTimes(1);
    expect(onSaveOutfit.mock.calls[0][0].template).toBe('festive_royal_heritage');
    expect(container.textContent).toContain('Saved to Lookbook');
  });

  it('triggers onMarkWorn when clicking Log Wear Today', async () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
        />
      );
    });

    const wearBtn = container.querySelector('button[aria-label="Log that you wore this ensemble today"]');
    expect(wearBtn).toBeTruthy();

    await act(async () => {
      wearBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onMarkWorn).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Worn Today (+1)');
  });

  it('triggers onPlanLook when clicking Plan in Calendar', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
          onPlanLook={onPlanLook}
        />
      );
    });

    const planBtn = container.querySelector('button[aria-label="Plan this outfit in calendar"]');
    expect(planBtn).toBeTruthy();

    act(() => {
      planBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onPlanLook).toHaveBeenCalledTimes(1);
  });

  it('triggers onUnlockAnchor when clicking the Unlock button in the header', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
        />
      );
    });

    const unlockBtn = container.querySelector('button[aria-label="Unlock anchor piece"]');
    expect(unlockBtn).toBeTruthy();

    act(() => {
      unlockBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onUnlockAnchor).toHaveBeenCalledTimes(1);
  });

  it('triggers onInspectItem when clicking a garment image in the composition', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
          onInspectItem={onInspectItem}
        />
      );
    });

    const inspectableKurta = container.querySelector('[aria-label="Inspect Handloom Raw Silk Kurta"]');
    expect(inspectableKurta).toBeTruthy();

    act(() => {
      inspectableKurta?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onInspectItem).toHaveBeenCalledTimes(1);
    expect(onInspectItem).toHaveBeenCalledWith(mockAnchorItem);
  });

  it('displays compatibility match percentage and grounded why reasons', () => {
    act(() => {
      root.render(
        <OutfitAtelierStage
          anchorItem={mockAnchorItem}
          onSelectAnchor={onSelectAnchor}
          onUnlockAnchor={onUnlockAnchor}
          outfit={mockOutfit1}
          allOutfits={[mockOutfit1]}
          accessory={null}
          onSelectAccessory={onSelectAccessory}
          availableAccessories={[]}
          occasion="festive"
          season="winter"
          onSaveOutfit={onSaveOutfit}
          onMarkWorn={onMarkWorn}
        />
      );
    });

    expect(container.textContent).toContain('96% Compatibility Match');
    expect(container.textContent).toContain('Silk kurta pairs harmoniously with brocade Nehru jacket');
  });
});
