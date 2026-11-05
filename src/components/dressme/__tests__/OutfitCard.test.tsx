// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { OutfitCard } from '../OutfitCard';
import { WardrobeItem, GeneratedOutfit } from '../../../types';

const mockUseWardrobeContext = vi.fn();
vi.mock('../../../context/WardrobeContext', () => ({
  useWardrobeContext: () => mockUseWardrobeContext(),
}));

const mockHeroKurta: WardrobeItem = {
  id: 'item-kurta-1',
  name: 'Chikankari Cotton Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  fabric: 'cotton',
  colors: ['white'],
  status: 'clean',
  timesWorn: 3,
  occasions: ['everyday', 'office'],
  seasons: ['summer'],
  formality: 3,
  note: '',
  favorite: true,
  createdAt: Date.now(),
};

const mockBottomJeans: WardrobeItem = {
  id: 'item-jeans-1',
  name: 'Slim Indigo Denim',
  category: 'Bottoms',
  subcategory: 'jeans',
  fabric: 'denim',
  colors: ['blue'],
  status: 'clean',
  timesWorn: 7,
  occasions: ['everyday', 'casual outing'],
  seasons: ['summer', 'winter'],
  formality: 2,
  note: '',
  favorite: false,
  createdAt: Date.now(),
};

const mockFootwearJuttis: WardrobeItem = {
  id: 'item-juttis-1',
  name: 'Handcrafted Tan Juttis',
  category: 'Footwear',
  subcategory: 'juttis',
  fabric: 'silk',
  colors: ['tan'],
  status: 'clean',
  timesWorn: 4,
  occasions: ['everyday', 'festive'],
  seasons: ['summer'],
  formality: 3,
  note: '',
  favorite: false,
  createdAt: Date.now(),
};

const mockOutfit: GeneratedOutfit = {
  template: 'indo_western_casual',
  score: 92,
  why: 'Breathable white kurta paired with relaxed denim and tan juttis',
  slots: {
    top: [mockHeroKurta],
    bottom: [mockBottomJeans],
    footwear: [mockFootwearJuttis],
  },
  explanation: {
    headline: 'Indo-Western Everyday Refinement',
    reasons: [
      'Crisp cotton kurta keeps you cool in summer heat',
      'Denim anchors the silhouette in casual versatility',
    ],
    evidenceSources: ['cultural', 'compatibility'],
    confidenceLevel: 'HIGH',
    culturalRationale: 'Modern Indo-Western synthesis appropriate for college or studio work',
    weatherComfortRationale: 'Lightweight breathable cotton suited for warm conditions',
  },
};

describe('OutfitCard — Milestone D: Cinematic Recommendation Storytelling', () => {
  let container: HTMLDivElement;
  let root: Root;

  const onOpenAccessoryDrawer = vi.fn();
  const onMarkWorn = vi.fn().mockResolvedValue(undefined);
  const onSaveOutfit = vi.fn().mockResolvedValue(true);
  const onChangeLook = vi.fn();
  const onPlanLook = vi.fn();
  const onRejectLook = vi.fn().mockResolvedValue(undefined);
  const onOpenInAtelier = vi.fn();
  const onInspectItem = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockUseWardrobeContext.mockReturnValue({
      preferences: {
        preferredColors: ['white', 'blue'],
        dislikedColors: [],
      },
      styleProfile: {
        dominantFormality: 3,
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

  it('renders storytelling with anchor garment identification and occasion calibration', () => {
    act(() => {
      root.render(
        <OutfitCard
          outfit={mockOutfit}
          index={0}
          occasion="everyday"
          accessory={null}
          anchorItem={mockHeroKurta}
          onOpenAccessoryDrawer={onOpenAccessoryDrawer}
          onMarkWorn={onMarkWorn}
          onSaveOutfit={onSaveOutfit}
          onChangeLook={onChangeLook}
          onPlanLook={onPlanLook}
          onRejectLook={onRejectLook}
          onOpenInAtelier={onOpenInAtelier}
          onInspectItem={onInspectItem}
        />
      );
    });

    expect(container.textContent).toContain('WHY THIS WORKS');
    expect(container.textContent).toContain('Anchor:');
    expect(container.textContent).toContain('Chikankari Cotton Kurta');
    expect(container.textContent).toContain('Occasion Fit:');
    expect(container.textContent).toContain('everyday');
    expect(container.textContent).toContain('Crisp cotton kurta keeps you cool in summer heat');
    expect(container.textContent).toContain('Cultural Rationale:');
    expect(container.textContent).toContain('Climate & Comfort:');
  });

  it('provides a 3D Atelier transition button that invokes onOpenInAtelier', () => {
    act(() => {
      root.render(
        <OutfitCard
          outfit={mockOutfit}
          index={0}
          occasion="everyday"
          accessory={null}
          onOpenAccessoryDrawer={onOpenAccessoryDrawer}
          onMarkWorn={onMarkWorn}
          onSaveOutfit={onSaveOutfit}
          onOpenInAtelier={onOpenInAtelier}
        />
      );
    });

    const atelierBtn = container.querySelector('button[aria-label="Open in 3D Atelier"]');
    expect(atelierBtn).toBeTruthy();

    act(() => {
      atelierBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenInAtelier).toHaveBeenCalledTimes(1);
    expect(onOpenInAtelier).toHaveBeenCalledWith(mockOutfit);
  });

  it('invokes onInspectItem when clicking hero piece or secondary piece images', () => {
    act(() => {
      root.render(
        <OutfitCard
          outfit={mockOutfit}
          index={0}
          occasion="everyday"
          accessory={null}
          onOpenAccessoryDrawer={onOpenAccessoryDrawer}
          onMarkWorn={onMarkWorn}
          onSaveOutfit={onSaveOutfit}
          onInspectItem={onInspectItem}
        />
      );
    });

    // Inspect hero piece
    const heroFrame = container.querySelector('[title="Inspect Chikankari Cotton Kurta"]');
    expect(heroFrame).toBeTruthy();

    act(() => {
      heroFrame?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onInspectItem).toHaveBeenCalledWith(mockHeroKurta);

    // Inspect secondary piece (bottom)
    const bottomFrame = container.querySelector('[title="Inspect Slim Indigo Denim"]');
    expect(bottomFrame).toBeTruthy();

    act(() => {
      bottomFrame?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onInspectItem).toHaveBeenCalledWith(mockBottomJeans);
  });
});
