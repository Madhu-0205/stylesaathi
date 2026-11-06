// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { SpatialGarmentRail, getMaterialGlintProfile } from '../SpatialGarmentRail';
import { WardrobeItem } from '../../../types';

const mockItems: WardrobeItem[] = [
  {
    id: 'item-1',
    name: 'Raw Silk Bundi',
    category: 'Ethnic',
    subcategory: 'nehru jacket',
    fabric: 'silk',
    colors: ['gold', 'cream'],
    status: 'clean',
    timesWorn: 2,
    occasions: ['festive', 'wedding guest'],
    seasons: ['winter'],
    formality: 4,
    note: '',
    favorite: false,
    createdAt: Date.now(),
  },
  {
    id: 'item-2',
    name: 'Chikankari Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    fabric: 'chanderi',
    colors: ['white', 'ivory'],
    status: 'clean',
    timesWorn: 5,
    occasions: ['everyday', 'office'],
    seasons: ['summer'],
    formality: 3,
    note: '',
    favorite: true,
    createdAt: Date.now(),
  },
  {
    id: 'item-3',
    name: 'Tailored Indigo Trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    fabric: 'linen',
    colors: ['navy'],
    status: 'needs_washing',
    timesWorn: 3,
    occasions: ['everyday', 'office'],
    seasons: ['summer'],
    formality: 3,
    note: '',
    favorite: false,
    createdAt: Date.now(),
  },
  {
    id: 'item-4',
    name: 'Formal Bandhgala Suit',
    category: 'Ethnic',
    subcategory: 'bandhgala',
    fabric: 'wool',
    colors: ['black'],
    status: 'in_laundry',
    timesWorn: 8,
    occasions: ['festive', 'wedding guest'],
    seasons: ['winter'],
    formality: 5,
    note: '',
    favorite: false,
    createdAt: Date.now(),
  },
];

describe('SpatialGarmentRail — Milestone B: Material Glint & Tactical Micro-interactions', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSelectItem = vi.fn();
  const onToggleFavorite = vi.fn();
  const onUpdateItem = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('1. Material-Aware Glint Profiling', () => {
    it('classifies lustrous weaves (silk, chanderi, banarasi, satin) with warm gold sheen', () => {
      const silkProfile = getMaterialGlintProfile('silk', 'Ethnic');
      expect(silkProfile.type).toBe('lustrous');
      expect(silkProfile.label).toBe('Lustrous Weave');
      expect(silkProfile.sheenGradient).toContain('rgba(254, 243, 199');

      const chanderiProfile = getMaterialGlintProfile('chanderi', 'Ethnic');
      expect(chanderiProfile.type).toBe('lustrous');
    });

    it('classifies matte natural fibres (cotton, linen, khadi) with soft diffuse lighting', () => {
      const cottonProfile = getMaterialGlintProfile('cotton', 'Tops');
      expect(cottonProfile.type).toBe('matte');
      expect(cottonProfile.label).toBe('Matte Natural Fibre');

      const linenProfile = getMaterialGlintProfile('linen', 'Bottoms');
      expect(linenProfile.type).toBe('matte');
    });

    it('classifies structured fabrics (denim, wool) with grazing rim highlight', () => {
      const denimProfile = getMaterialGlintProfile('denim', 'Bottoms');
      expect(denimProfile.type).toBe('structured');
      expect(denimProfile.label).toBe('Structured Texture');

      const woolProfile = getMaterialGlintProfile('wool', 'Outerwear');
      expect(woolProfile.type).toBe('structured');
    });

    it('classifies sheer weaves (chiffon, georgette, organza) with airy draped light', () => {
      const chiffonProfile = getMaterialGlintProfile('chiffon', 'Ethnic');
      expect(chiffonProfile.type).toBe('sheer');
      expect(chiffonProfile.label).toBe('Airy & Draped');
    });
  });

  describe('2. 3D Perspective & Selection Dynamics', () => {
    it('renders the 3D perspective rail container with brushed brass hardware', () => {
      const html = renderToString(
        <SpatialGarmentRail
          items={mockItems}
          onSelectItem={onSelectItem}
          onToggleFavorite={onToggleFavorite}
          onUpdateItem={onUpdateItem}
        />
      );

      expect(html).toContain('Interactive 3D Spatial Garment Rail');
      expect(html).toContain('perspective:1100px');
      expect(html).toContain('transform-style:preserve-3d');
      expect(html).toContain('SPATIAL STUDIO · HANGING RAIL');
    });

    it('renders active garment card facing the user with rotateY(0deg) and forward translateZ', async () => {
      await act(async () => {
        root.render(
          <SpatialGarmentRail
            items={mockItems}
            onSelectItem={onSelectItem}
            onToggleFavorite={onToggleFavorite}
            onUpdateItem={onUpdateItem}
          />
        );
      });

      const activeCard = container.querySelector('[data-testid="spatial-card-item-1"]') as HTMLElement;
      expect(activeCard).toBeTruthy();
      expect(activeCard.getAttribute('data-active')).toBe('true');

      const transform = activeCard.style.transform;
      expect(transform).toContain('rotateY(0deg)');
      expect(transform).toContain('55px'); // translateZ: 55px forward
    });

    it('angles neighboring garments in 3D perspective depth', async () => {
      await act(async () => {
        root.render(
          <SpatialGarmentRail
            items={mockItems}
            onSelectItem={onSelectItem}
            onToggleFavorite={onToggleFavorite}
            onUpdateItem={onUpdateItem}
          />
        );
      });

      const nextCard = container.querySelector('[data-testid="spatial-card-item-2"]') as HTMLElement;
      expect(nextCard).toBeTruthy();
      expect(nextCard.getAttribute('data-active')).toBe('false');

      const transform = nextCard.style.transform;
      expect(transform).toContain('rotateY(-22deg)');
      expect(transform).toContain('-5px'); // recessed translateZ
    });

    it('navigates with chevron buttons and updates the active focal piece', async () => {
      await act(async () => {
        root.render(
          <SpatialGarmentRail
            items={mockItems}
            onSelectItem={onSelectItem}
            onToggleFavorite={onToggleFavorite}
            onUpdateItem={onUpdateItem}
          />
        );
      });

      const nextBtn = container.querySelector('button[aria-label="Next garment in rail"]') as HTMLButtonElement;
      expect(nextBtn).toBeTruthy();

      await act(async () => {
        nextBtn.click();
      });

      const card2 = container.querySelector('[data-testid="spatial-card-item-2"]') as HTMLElement;
      expect(card2.getAttribute('data-active')).toBe('true');
      expect(card2.style.transform).toContain('rotateY(0deg)');
    });

    it('supports keyboard navigation with ArrowRight, ArrowLeft and W for wear logging', async () => {
      await act(async () => {
        root.render(
          <SpatialGarmentRail
            items={mockItems}
            onSelectItem={onSelectItem}
            onToggleFavorite={onToggleFavorite}
            onUpdateItem={onUpdateItem}
          />
        );
      });

      const stage = container.querySelector('div[role="region"]') as HTMLElement;
      expect(stage).toBeTruthy();

      // ArrowRight advances
      await act(async () => {
        stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      expect(container.querySelector('[data-testid="spatial-card-item-2"]')?.getAttribute('data-active')).toBe('true');

      // 'w' key logs wear on active piece
      await act(async () => {
        stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
      });
      expect(onUpdateItem).toHaveBeenCalledWith(
        'item-2',
        expect.objectContaining({
          timesWorn: 6,
        })
      );
    });
  });

  describe('3. Tactical Micro-interactions & Laundry Safeguards', () => {
    it('triggers onSelectItem when clicking "Inspect Piece" button', async () => {
      await act(async () => {
        root.render(
          <SpatialGarmentRail
            items={mockItems}
            onSelectItem={onSelectItem}
            onToggleFavorite={onToggleFavorite}
            onUpdateItem={onUpdateItem}
          />
        );
      });

      const inspectBtn = container.querySelector('button[aria-label="Inspect Raw Silk Bundi details"]') as HTMLButtonElement;
      expect(inspectBtn).toBeTruthy();

      await act(async () => {
        inspectBtn.click();
      });

      expect(onSelectItem).toHaveBeenCalledWith(mockItems[0]);
    });

    it('triggers onUpdateItem when clicking quick wear button for clean garment', async () => {
      await act(async () => {
        root.render(
          <SpatialGarmentRail
            items={mockItems}
            onSelectItem={onSelectItem}
            onToggleFavorite={onToggleFavorite}
            onUpdateItem={onUpdateItem}
          />
        );
      });

      const wearBtn = container.querySelector('button[aria-label="Log wearing Raw Silk Bundi"]') as HTMLButtonElement;
      expect(wearBtn).toBeTruthy();

      await act(async () => {
        wearBtn.click();
      });

      expect(onUpdateItem).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({
          timesWorn: 3,
        })
      );
    });

    it('enforces Laundry Safeguard when attempting to wear a garment in laundry', async () => {
      // Navigate to item-4 which is 'in_laundry'
      await act(async () => {
        root.render(
          <SpatialGarmentRail
            items={mockItems}
            onSelectItem={onSelectItem}
            onToggleFavorite={onToggleFavorite}
            onUpdateItem={onUpdateItem}
          />
        );
      });

      const stage = container.querySelector('div[role="region"]') as HTMLElement;

      // Advance to item-4 (3 steps: item 1 -> 2 -> 3 -> 4)
      await act(async () => {
        stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      await act(async () => {
        stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      await act(async () => {
        stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });

      expect(container.querySelector('[data-testid="spatial-card-item-4"]')?.getAttribute('data-active')).toBe('true');

      // Click wear button on garment in laundry
      const inLaundryWearBtn = container.querySelector('button[aria-label="Log wearing Formal Bandhgala Suit"]') as HTMLButtonElement;
      expect(inLaundryWearBtn).toBeTruthy();

      await act(async () => {
        inLaundryWearBtn.click();
      });

      // Does not immediately wear without washing
      expect(onUpdateItem).not.toHaveBeenCalled();

      // Safeguard prompt appears
      expect(container.textContent).toContain('Laundry Safeguard');
      expect(container.textContent).toContain('Mark Clean & Wear');

      // Click "Mark Clean & Wear" override action
      const markCleanBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Mark Clean & Wear')
      );
      expect(markCleanBtn).toBeTruthy();

      await act(async () => {
        markCleanBtn?.click();
      });

      // Now onUpdateItem is called with status clean AND timesWorn incremented
      expect(onUpdateItem).toHaveBeenCalledWith(
        'item-4',
        expect.objectContaining({
          status: 'clean',
          timesWorn: 9,
        })
      );
    });

    it('enforces Laundry Safeguard when attempting to wear a garment that needs washing', async () => {
      // Navigate to item-3 which is 'needs_washing'
      await act(async () => {
        root.render(
          <SpatialGarmentRail
            items={mockItems}
            onSelectItem={onSelectItem}
            onToggleFavorite={onToggleFavorite}
            onUpdateItem={onUpdateItem}
          />
        );
      });

      const stage = container.querySelector('div[role="region"]') as HTMLElement;

      // Advance to item-3 (2 steps: item 1 -> 2 -> 3)
      await act(async () => {
        stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      await act(async () => {
        stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });

      expect(container.querySelector('[data-testid="spatial-card-item-3"]')?.getAttribute('data-active')).toBe('true');

      // Check button text shows "Needs Washing"
      const needsWashingWearBtn = container.querySelector('button[aria-label="Log wearing Tailored Indigo Trousers"]') as HTMLButtonElement;
      expect(needsWashingWearBtn).toBeTruthy();
      expect(needsWashingWearBtn.textContent).toContain('Needs Washing');

      // Click wear button on garment needing wash
      await act(async () => {
        needsWashingWearBtn.click();
      });

      // Does not immediately wear without washing
      expect(onUpdateItem).not.toHaveBeenCalled();

      // Safeguard prompt appears
      expect(container.textContent).toContain('Laundry Safeguard');
      expect(container.textContent).toContain('needs washing before wear');

      // Click "Mark Clean & Wear" override action
      const markCleanBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Mark Clean & Wear')
      );
      expect(markCleanBtn).toBeTruthy();

      await act(async () => {
        markCleanBtn?.click();
      });

      // Now onUpdateItem is called with status clean AND timesWorn incremented
      expect(onUpdateItem).toHaveBeenCalledWith(
        'item-3',
        expect.objectContaining({
          status: 'clean',
          timesWorn: 4,
        })
      );
    });
  });
});
