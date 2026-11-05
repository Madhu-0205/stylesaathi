// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { SpatialGarmentRail } from '../SpatialGarmentRail';
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
];

describe('SpatialGarmentRail — Interactive 3D Fashion Rail', () => {
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

  it('supports keyboard navigation with ArrowRight and ArrowLeft', async () => {
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

    // ArrowLeft goes back
    await act(async () => {
      stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(container.querySelector('[data-testid="spatial-card-item-1"]')?.getAttribute('data-active')).toBe('true');
  });

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

  it('triggers onUpdateItem when clicking quick wear button', async () => {
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
});
