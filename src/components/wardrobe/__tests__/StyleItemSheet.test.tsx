import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StyleItemSheet } from '../StyleItemSheet';
import { WardrobeItem } from '../../../types';

// Mock useStyleThisItem
const mockUseStyleThisItem = vi.fn();

vi.mock('../../../hooks/useStyleThisItem', () => ({
  useStyleThisItem: (...args: any[]) => mockUseStyleThisItem(...args),
}));

// Mock BottomSheet to render inline without browser portal / useEffect mounted guard
vi.mock('../../common/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, children }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="bottom-sheet">
        <h2>{title}</h2>
        {children}
      </div>
    );
  },
}));

describe('StyleItemSheet UI Component', () => {
  const mockAnchorItem: WardrobeItem = {
    id: 'item_linen_shirt',
    userId: 'user_1',
    name: 'Oatmeal Linen Summer Shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['beige'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    timesWorn: 4,
    favorite: false,
    note: '',
    fabric: 'linen',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    mockUseStyleThisItem.mockReturnValue({
      anchorItem: mockAnchorItem,
      occasion: 'college',
      setOccasion: vi.fn(),
      season: 'summer',
      outfits: [],
      activeOutfit: null,
      activeRoleIndex: 0,
      setActiveRoleIndex: vi.fn(),
      missingRequirements: null,
      laundryWarning: null,
      isLoading: false,
      shuffle: vi.fn(),
      woreToday: vi.fn(),
      saveLook: vi.fn(),
      rejectLook: vi.fn(),
    });

    const html = renderToString(
      <StyleItemSheet
        anchorItem={mockAnchorItem}
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('renders anchor hero card with Anchor Piece · Locked indicator', () => {
    mockUseStyleThisItem.mockReturnValue({
      anchorItem: mockAnchorItem,
      occasion: 'college',
      setOccasion: vi.fn(),
      season: 'summer',
      outfits: [],
      activeOutfit: null,
      activeRoleIndex: 0,
      setActiveRoleIndex: vi.fn(),
      missingRequirements: null,
      laundryWarning: null,
      isLoading: false,
      shuffle: vi.fn(),
      woreToday: vi.fn(),
      saveLook: vi.fn(),
      rejectLook: vi.fn(),
    });

    const html = renderToString(
      <StyleItemSheet
        anchorItem={mockAnchorItem}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('STYLE THIS ITEM');
    expect(html).toContain('Oatmeal Linen Summer Shirt');
    expect(html).toContain('Anchor Piece · Locked');
  });

  it('displays prominent warning banner when anchor needs washing', () => {
    const dirtyAnchor = { ...mockAnchorItem, status: 'needs_washing' as const };
    mockUseStyleThisItem.mockReturnValue({
      anchorItem: dirtyAnchor,
      occasion: 'college',
      setOccasion: vi.fn(),
      season: 'summer',
      outfits: [],
      activeOutfit: null,
      activeRoleIndex: 0,
      setActiveRoleIndex: vi.fn(),
      missingRequirements: null,
      laundryWarning: 'Needs Washing · Clean before wearing today',
      isLoading: false,
      shuffle: vi.fn(),
      woreToday: vi.fn(),
      saveLook: vi.fn(),
      rejectLook: vi.fn(),
    });

    const html = renderToString(
      <StyleItemSheet
        anchorItem={dirtyAnchor}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Needs Washing · Clean before wearing today');
    expect(html).toContain('Styling this item for planning. Clean it before wearing.');
  });

  it('displays prominent warning banner when anchor is in laundry', () => {
    const laundryAnchor = { ...mockAnchorItem, status: 'in_laundry' as const };
    mockUseStyleThisItem.mockReturnValue({
      anchorItem: laundryAnchor,
      occasion: 'college',
      setOccasion: vi.fn(),
      season: 'summer',
      outfits: [],
      activeOutfit: null,
      activeRoleIndex: 0,
      setActiveRoleIndex: vi.fn(),
      missingRequirements: null,
      laundryWarning: 'In Laundry · Clean before wearing today',
      isLoading: false,
      shuffle: vi.fn(),
      woreToday: vi.fn(),
      saveLook: vi.fn(),
      rejectLook: vi.fn(),
    });

    const html = renderToString(
      <StyleItemSheet
        anchorItem={laundryAnchor}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('In Laundry · Clean before wearing today');
  });

  it('renders 3 curated looks and role tabs when outfits exist', () => {
    const mockOutfit = {
      id: 'outfit_test_1',
      template: 'Western',
      role: 'best_match' as const,
      slots: {
        top: [mockAnchorItem],
        bottom: [
          {
            id: 'item_jeans',
            userId: 'user_1',
            name: 'Classic Indigo Denim',
            category: 'Bottoms' as const,
            subcategory: 'jeans',
            colors: ['blue'],
            seasons: ['summer'],
            occasions: ['college'],
            formality: 2,
            status: 'clean' as const,
            timesWorn: 3,
            favorite: false,
            note: '',
          },
        ],
      },
      score: 8.5,
      scoreBreakdown: {
        harmony: 1,
        styleBrain: 1,
        contextFit: 1,
        culturalFit: 1,
        noveltyBonus: 0,
        penalty: 0,
        total: 8.5,
      },
      explanation: {
        headline: 'Best Match · Anchored Ensemble',
        reasons: ['Anchored around your Oatmeal Linen Summer Shirt', 'Breathable cotton denim pairing'],
        evidenceSources: ['compatibility' as const],
      },
    };

    mockUseStyleThisItem.mockReturnValue({
      anchorItem: mockAnchorItem,
      occasion: 'college',
      setOccasion: vi.fn(),
      season: 'summer',
      outfits: [mockOutfit],
      activeOutfit: mockOutfit,
      activeRoleIndex: 0,
      setActiveRoleIndex: vi.fn(),
      missingRequirements: null,
      laundryWarning: null,
      isLoading: false,
      shuffle: vi.fn(),
      woreToday: vi.fn(),
      saveLook: vi.fn(),
      rejectLook: vi.fn(),
    });

    const html = renderToString(
      <StyleItemSheet
        anchorItem={mockAnchorItem}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Best Match');
    expect(html).toContain('Best Match · Anchored Ensemble');
    expect(html).toContain('Classic Indigo Denim');
    expect(html).toContain('Wear Today');
    expect(html).toContain('Shuffle');
  });

  it('renders typed sparse wardrobe guidance when missing requirements exist', () => {
    mockUseStyleThisItem.mockReturnValue({
      anchorItem: mockAnchorItem,
      occasion: 'college',
      setOccasion: vi.fn(),
      season: 'summer',
      outfits: [],
      activeOutfit: null,
      activeRoleIndex: 0,
      setActiveRoleIndex: vi.fn(),
      missingRequirements: [
        {
          templateId: 'western',
          templateName: 'Western',
          missingRole: 'bottom',
          expectedCategory: 'Bottoms',
          compatibleSubcategories: ['trousers', 'jeans', 'skirt'],
          explanation: 'Your Oatmeal Linen Summer Shirt needs a compatible bottom. Add trousers, jeans, or a skirt to your wardrobe to create a complete look.',
        },
      ],
      laundryWarning: null,
      isLoading: false,
      shuffle: vi.fn(),
      woreToday: vi.fn(),
      saveLook: vi.fn(),
      rejectLook: vi.fn(),
    });

    const html = renderToString(
      <StyleItemSheet
        anchorItem={mockAnchorItem}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Complete Your Ensemble');
    expect(html).toContain('needs a compatible bottom');
    expect(html).toContain('Missing Requirement:');
    expect(html).toContain('bottom');
    expect(html).toContain('Bottoms');
    expect(html).toContain('trousers');
    expect(html).toContain('jeans');
  });
});
