// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutfitFeedbackSheet } from '../OutfitFeedbackSheet';
import { GeneratedOutfit, Occasion } from '../../../types';
import { styleSignalsRepository } from '../../../repositories/LocalStorageStyleSignalsRepository';

describe('OutfitFeedbackSheet', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockOutfit: GeneratedOutfit = {
    id: 'outfit_test_01',
    template: 'Contemporary Western',
    score: 8.8,
    why: 'Balanced silhouette and color harmony',
    slots: {
      top: [
        {
          id: 'item-top-1',
          name: 'Crisp White Shirt',
          category: 'Tops',
          subcategory: 'shirt',
          colors: ['white'],
          occasions: ['office', 'college'],
          seasons: ['summer', 'monsoon', 'winter'],
          formality: 4,
          status: 'clean',
          favorite: false,
          note: '',
          timesWorn: 3,
          createdAt: Date.now(),
        },
      ],
      bottom: [
        {
          id: 'item-bottom-1',
          name: 'Navy Tailored Trousers',
          category: 'Bottoms',
          subcategory: 'trousers',
          colors: ['navy'],
          occasions: ['office'],
          seasons: ['summer', 'monsoon', 'winter'],
          formality: 4,
          status: 'clean',
          favorite: false,
          note: '',
          timesWorn: 2,
          createdAt: Date.now(),
        },
      ],
    },
  };

  const defaultOccasion: Occasion = 'office';

  beforeEach(async () => {
    vi.clearAllMocks();
    await styleSignalsRepository.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders null when isOpen is false', async () => {
    await act(async () => {
      root.render(
        <OutfitFeedbackSheet
          isOpen={false}
          onClose={vi.fn()}
          outfit={mockOutfit}
          occasion={defaultOccasion}
        />
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders null when outfit is null/undefined', async () => {
    await act(async () => {
      root.render(
        <OutfitFeedbackSheet
          isOpen={true}
          onClose={vi.fn()}
          outfit={null as any}
          occasion={defaultOccasion}
        />
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders styling feedback options when open', async () => {
    await act(async () => {
      root.render(
        <OutfitFeedbackSheet
          isOpen={true}
          onClose={vi.fn()}
          outfit={mockOutfit}
          occasion={defaultOccasion}
        />
      );
    });

    expect(document.body.textContent).toContain('Styling Feedback');
    expect(document.body.textContent).toContain('I Love This Look (Reinforce Affinity)');
    expect(document.body.textContent).toContain('Too formal');
    expect(document.body.textContent).toContain('Too casual');
    expect(document.body.textContent).toContain('Wrong color palette');
    expect(document.body.textContent).toContain('Not weather appropriate');
    expect(document.body.textContent).toContain('Already worn recently');
    expect(document.body.textContent).toContain('Change a garment');
    expect(document.body.textContent).toContain('Not my personal style');
  });

  it('records positive feedback and transitions to confirmation view with Undo', async () => {
    const handleApplied = vi.fn();
    await act(async () => {
      root.render(
        <OutfitFeedbackSheet
          isOpen={true}
          onClose={vi.fn()}
          outfit={mockOutfit}
          occasion={defaultOccasion}
          onFeedbackApplied={handleApplied}
        />
      );
    });

    const loveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('I Love This Look')
    );
    expect(loveBtn).toBeDefined();

    await act(async () => {
      loveBtn?.click();
    });

    expect(document.body.textContent).toContain('Saved your positive affinity for this look');
    expect(document.body.textContent).toContain('Undo Feedback');
    expect(document.body.textContent).toContain('Done');

    const signals = await styleSignalsRepository.getSignals();
    expect(signals.length).toBe(1);
    expect(signals[0].signalType).toBe('liked');
    expect(signals[0].itemIds).toEqual(['item-top-1', 'item-bottom-1']);
  });

  it('records rejection reason and transitions to confirmation view with Undo', async () => {
    await act(async () => {
      root.render(
        <OutfitFeedbackSheet
          isOpen={true}
          onClose={vi.fn()}
          outfit={mockOutfit}
          occasion={defaultOccasion}
        />
      );
    });

    const tooFormalBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Too formal')
    );
    expect(tooFormalBtn).toBeDefined();

    await act(async () => {
      tooFormalBtn?.click();
    });

    expect(document.body.textContent).toContain('Too formal');
    expect(document.body.textContent).toContain('Rejection Recorded');
    expect(document.body.textContent).toContain('Undo Feedback');

    const signals = await styleSignalsRepository.getSignals();
    expect(signals.length).toBe(1);
    expect(signals[0].signalType).toBe('rejected');
    expect(signals[0].rejectionReason).toBe('too_formal');
  });

  it('allows user to undo feedback immediately', async () => {
    const handleUndone = vi.fn();
    await act(async () => {
      root.render(
        <OutfitFeedbackSheet
          isOpen={true}
          onClose={vi.fn()}
          outfit={mockOutfit}
          occasion={defaultOccasion}
          onFeedbackUndone={handleUndone}
        />
      );
    });

    const wrongColorBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Wrong color palette')
    );
    await act(async () => {
      wrongColorBtn?.click();
    });

    expect(document.body.textContent).toContain('Undo Feedback');

    const undoBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Undo Feedback')
    );
    await act(async () => {
      undoBtn?.click();
    });

    expect(document.body.textContent).toContain('Styling Feedback');
    expect(handleUndone).toHaveBeenCalled();
    const signals = await styleSignalsRepository.getSignals();
    expect(signals.length).toBe(0);
  });

  it('calls onClose and onFeedbackApplied when user clicks Done', async () => {
    const handleClose = vi.fn();
    const handleApplied = vi.fn();
    await act(async () => {
      root.render(
        <OutfitFeedbackSheet
          isOpen={true}
          onClose={handleClose}
          outfit={mockOutfit}
          occasion={defaultOccasion}
          onFeedbackApplied={handleApplied}
        />
      );
    });

    const tooCasualBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Too casual')
    );
    await act(async () => {
      tooCasualBtn?.click();
    });

    const doneBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Done')
    );
    await act(async () => {
      doneBtn?.click();
    });

    expect(handleClose).toHaveBeenCalled();
    expect(handleApplied).toHaveBeenCalledWith(
      expect.objectContaining({
        signalType: 'rejected',
        rejectionReason: 'too_casual',
      })
    );
  });
});
