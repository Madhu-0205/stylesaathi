import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SavedOutfitsModal } from '../components/dressme/SavedOutfitsModal';
import { CalendarScreen } from '../screens/CalendarScreen';
import { AISaathiChatView } from '../components/saathi/AISaathiChatView';
import { GeneratedOutfit, WardrobeItem, SavedOutfit, OutfitPlan } from '../types';

// Mock WardrobeContext
const mockSavedOutfits: SavedOutfit[] = [
  {
    id: 'saved-1',
    outfit: {
      template: 'Ethnic Festive Coordination',
      slots: {
        hero: [
          {
            id: 'item-1',
            name: 'Royal Blue Raw Silk Kurta',
            category: 'Ethnic',
            subcategory: 'kurta',
            colors: ['Navy'],
            fabric: 'silk',
            pattern: 'solid',
            fit: 'tailored',
            seasons: ['winter'],
            formality: 4,
            occasions: ['festive'],
            status: 'clean',
            favorite: true,
            note: '',
            timesWorn: 3,
            createdAt: Date.now(),
          },
        ],
        bottom: [
          {
            id: 'item-2',
            name: 'Ivory Churidhar Pyjama',
            category: 'Bottoms',
            subcategory: 'pajama',
            colors: ['White'],
            fabric: 'cotton',
            pattern: 'solid',
            fit: 'slim',
            seasons: ['winter'],
            formality: 4,
            occasions: ['festive'],
            status: 'clean',
            favorite: false,
            note: '',
            timesWorn: 2,
            createdAt: Date.now(),
          },
        ],
      },
      score: 92,
      why: 'Regal raw silk contrast creates timeless ceremonial elegance.',
      explanation: {
        headline: 'Festive Sovereign Coordination',
        reasons: ['Regal raw silk contrast creates timeless ceremonial elegance.'],
        evidenceSources: [],
      },
    },
    savedAt: Date.now() - 86400000,
  },
];

const mockPlans: OutfitPlan[] = [
  {
    id: 'plan-1',
    date: '2026-11-10',
    occasion: 'festive',
    status: 'planned',
    outfit: mockSavedOutfits[0].outfit,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'plan-2',
    date: '2026-11-04',
    occasion: 'office',
    status: 'worn',
    outfit: mockSavedOutfits[0].outfit,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const mockItems: WardrobeItem[] = [
  ...mockSavedOutfits[0].outfit.slots.hero,
  ...mockSavedOutfits[0].outfit.slots.bottom,
  {
    id: 'item-3',
    name: 'Tan Leather Mojaris',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['Brown'],
    fabric: 'silk',
    pattern: 'solid',
    fit: 'regular',
    seasons: ['winter'],
    formality: 4,
    occasions: ['festive'],
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 1,
    createdAt: Date.now(),
  },
];

vi.mock('../components/common/BottomSheet', () => ({
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

vi.mock('../context/WardrobeContext', () => ({
  useWardrobeContext: () => ({
    savedOutfits: mockSavedOutfits,
    plans: mockPlans,
    items: mockItems,
    deleteSavedOutfit: vi.fn(),
    markOutfitWornOnDate: vi.fn(),
    deletePlan: vi.fn(),
    showToast: vi.fn(),
    theme: 'light',
    toggleTheme: vi.fn(),
    preferences: {
      preferredContexts: ['Everyday'],
      preferredAesthetics: ['Contemporary'],
    },
    updatePreferences: vi.fn(),
    resetWardrobe: vi.fn(),
    resetAll: vi.fn(),
    resetLearnedStyle: vi.fn(),
  }),
  useWardrobeSafe: () => ({
    savedOutfits: mockSavedOutfits,
    plans: mockPlans,
    items: mockItems,
  }),
  useWardrobe: () => ({
    savedOutfits: mockSavedOutfits,
    plans: mockPlans,
    items: mockItems,
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isGuest: false,
    isAuthenticated: true,
    user: { name: 'Aarav Sharma', email: 'aarav@example.com' },
    signOut: vi.fn(),
    deleteAccount: vi.fn(),
  }),
}));

vi.mock('../context/WeatherContext', () => ({
  useWeather: () => ({
    forecast: {
      periods: [
        {
          date: '2026-11-10',
          summary: 'Mild and pleasant, 24°C',
          precipitationProbability: 10,
        },
      ],
    },
  }),
}));

vi.mock('../hooks/useSaathi', () => ({
  useSaathi: () => ({
    messages: [],
    isLoading: false,
    sendMessage: vi.fn(),
    confirmAction: vi.fn(),
    cancelAction: vi.fn(),
    selectClarificationOption: vi.fn(),
    resetConversation: vi.fn(),
  }),
}));

describe('Milestone E: Spatial Lookbook & Wardrobe Intelligence Exhibition Verification', () => {
  describe('1. Spatial Lookbook (SavedOutfitsModal)', () => {
    it('renders Lookbook title, archive badge, and curated ensembles', () => {
      const html = renderToString(
        <SavedOutfitsModal
          isOpen={true}
          onClose={() => {}}
          onPlanLook={() => {}}
          onOpenInAtelier={() => {}}
        />
      );

      expect(html).toContain('SPATIAL LOOKBOOK');
      expect(html).toContain('PERSONAL ARCHIVE');
      expect(html).toContain('Royal Blue Raw Silk Kurta');
      expect(html).toContain('Ivory Churidhar Pyjama');
      expect(html).toContain('Festive Sovereign Coordination');
    });

    it('renders 3D Atelier bridge action button when onOpenInAtelier prop is provided', () => {
      const html = renderToString(
        <SavedOutfitsModal
          isOpen={true}
          onClose={() => {}}
          onPlanLook={() => {}}
          onOpenInAtelier={() => {}}
        />
      );

      expect(html).toContain('3D Atelier');
      expect(html).toContain('Wear Today');
      expect(html).toContain('Schedule');
    });
  });

  describe('2. Outfit Calendar (CalendarScreen)', () => {
    it('renders editorial header, month/agenda switcher, and monthly schedule KPI strip', () => {
      const html = renderToString(<CalendarScreen onGoToDress={() => {}} />);

      expect(html).toContain('STYLE CALENDAR');
      expect(html).toContain('Outfit Planner &amp; Wear Journal');
      expect(html).toContain('MONTHLY SCHEDULE');
      expect(html).toContain('WORN TO DATE');
      expect(html).toContain('WARDROBE RHYTHM');
    });

    it('renders calendar cells with interactive indicators for planned vs worn outfits', () => {
      const html = renderToString(<CalendarScreen onGoToDress={() => {}} />);

      expect(html).toContain('Planned');
      expect(html).toContain('Worn');
      expect(html).toContain('Today');
    });
  });

  describe('3. AI Stylist Salon (AISaathiChatView)', () => {
    it('renders AI Saathi with privacy badge and quick prompts', () => {
      const html = renderToString(
        <AISaathiChatView isOpen={true} onClose={() => {}} />
      );

      expect(html).toContain('AI SAATHI');
      expect(html).toContain('Privacy-First Orchestrator');
      expect(html).toContain('Zero Cloud Tracking • Local Domain Engines');
      expect(html).toContain('What should I wear today?');
      expect(html).toContain('Style my blue kurta');
    });
  });
});
