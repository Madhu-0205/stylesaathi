import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AISaathiChatView } from '../AISaathiChatView';
import { SaathiClarificationPrompt } from '../SaathiClarificationPrompt';
import { SaathiRecommendationCard } from '../SaathiRecommendationCard';
import { SaathiSmartBuyCard, SaathiSmartBuyAssessmentData } from '../SaathiSmartBuyCard';
import { SaathiMessageItem } from '../SaathiMessageItem';
import { SaathiMessage } from '../../../engine/saathi/types';
import { RecommendedOutfit } from '../../../types';

const mockUseSaathi = vi.fn();

vi.mock('../../../hooks/useSaathi', () => ({
  useSaathi: () => mockUseSaathi(),
}));

describe('Phase 10: AI Saathi UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AISaathiChatView Modal', () => {
    it('returns null when isOpen is false', () => {
      mockUseSaathi.mockReturnValue({
        messages: [],
        isLoading: false,
        error: null,
        pendingClarification: undefined,
        pendingConfirmation: undefined,
        sendMessage: vi.fn(),
        respondToClarification: vi.fn(),
        confirmPendingAction: vi.fn(),
        cancelPendingAction: vi.fn(),
        resetConversation: vi.fn(),
      });

      const html = renderToString(<AISaathiChatView isOpen={false} onClose={vi.fn()} />);
      expect(html).toBe('');
    });

    it('renders header, title, badges, and quick prompts when open', () => {
      mockUseSaathi.mockReturnValue({
        messages: [
          {
            id: 'msg_1',
            sender: 'assistant',
            text: "Hello! I'm AI Saathi, your privacy-first styling companion.",
            timestamp: 1791892800000,
          },
        ],
        isLoading: false,
        error: null,
        pendingClarification: undefined,
        pendingConfirmation: undefined,
        sendMessage: vi.fn(),
        respondToClarification: vi.fn(),
        confirmPendingAction: vi.fn(),
        cancelPendingAction: vi.fn(),
        resetConversation: vi.fn(),
      });

      const html = renderToString(<AISaathiChatView isOpen={true} onClose={vi.fn()} />);

      expect(html).toContain('AI SAATHI');
      expect(html).toContain('Privacy-First Orchestrator');
      expect(html).toContain('Hello! I&#x27;m AI Saathi');
      expect(html).toContain('What should I wear today?');
      expect(html).toContain('Do I need to buy anything?');
    });

    it('renders loading state indicator when isLoading is true', () => {
      mockUseSaathi.mockReturnValue({
        messages: [],
        isLoading: true,
        error: null,
        pendingClarification: undefined,
        pendingConfirmation: undefined,
        sendMessage: vi.fn(),
        respondToClarification: vi.fn(),
        confirmPendingAction: vi.fn(),
        cancelPendingAction: vi.fn(),
        resetConversation: vi.fn(),
      });

      const html = renderToString(<AISaathiChatView isOpen={true} onClose={vi.fn()} />);
      expect(html).toContain('Consulting domain intelligence...');
    });
  });

  describe('SaathiClarificationPrompt', () => {
    it('renders question and interactive option pills with min 44px targets', () => {
      const clarification = {
        id: 'clar_1',
        field: 'occasion' as const,
        question: 'Which occasion are you dressing for?',
        requiredFields: ['occasion'],
        options: [
          { label: 'College', value: 'college' },
          { label: 'Office', value: 'office' },
          { label: 'Wedding', value: 'wedding' },
        ],
      };

      const html = renderToString(
        <SaathiClarificationPrompt clarification={clarification} onSelect={vi.fn()} />
      );

      expect(html).toContain('Which occasion are you dressing for?');
      expect(html).toContain('College');
      expect(html).toContain('Office');
      expect(html).toContain('Wedding');
      expect(html).toContain('min-h-11'); // 44px minimum touch target
    });
  });

  describe('SaathiRecommendationCard', () => {
    it('renders curated outfit pieces and verified reasons from Phase 5', () => {
      const outfit: RecommendedOutfit = {
        id: 'outfit_123',
        template: 'Smart Casual',
        slots: {
          top: [
            {
              id: 'top_1',
              name: 'Linen Shirt',
              category: 'Tops',
              subcategory: 'shirt',
              colors: ['white'],
              seasons: ['summer'],
              occasions: ['office'],
              formality: 3,
              timesWorn: 0,
              status: 'clean',
              favorite: false,
              note: '',
            },
          ],
          bottom: [
            {
              id: 'bot_1',
              name: 'Chino Trousers',
              category: 'Bottoms',
              subcategory: 'trousers',
              colors: ['navy'],
              seasons: ['summer'],
              occasions: ['office'],
              formality: 3,
              timesWorn: 0,
              status: 'clean',
              favorite: false,
              note: '',
            },
          ],
        },
        score: 0.92,
        why: 'Verified thermal match and color harmony',
        role: 'best_match',
        scoreBreakdown: {
          baseCompatibility: 0.9,
          personalStyle: 0.95,
          contextFit: 0.9,
          culturalFit: 0.9,
          noveltyBonus: 0.0,
          penalty: 0.0,
          total: 0.92,
        },
        explanation: {
          headline: 'Optimal for office',
          reasons: ['Breathable cotton for 28°C', 'High personal style affinity'],
          evidenceSources: ['weather', 'personal_style'],
        },
      };

      const html = renderToString(<SaathiRecommendationCard outfit={outfit} onPlanLook={vi.fn()} />);

      expect(html).toContain('Smart Casual');
      expect(html).toContain('92% Match');
      expect(html).toContain('Linen Shirt');
      expect(html).toContain('Chino Trousers');
      expect(html).toContain('Breathable cotton for 28°C');
      expect(html).toContain('Plan this look in Calendar');
    });
  });

  describe('SaathiSmartBuyCard', () => {
    it('renders Phase 9 purchase assessment without commercial product links', () => {
      const assessment: SaathiSmartBuyAssessmentData = {
        verdict: 'NO_PURCHASE_NEEDED',
        headline: 'No Purchase Needed',
        summary: 'Your existing wardrobe covers current needs sufficiently.',
        dormantRediscoveries: [],
        occasionGaps: [],
        evidenceHierarchy: ['Adequate rotation health', 'Zero unfilled demand'],
        confidenceScore: 0.9,
      };

      const html = renderToString(<SaathiSmartBuyCard assessment={assessment} />);

      expect(html).toContain('SMART BUY ASSESSMENT');
      expect(html).toContain('No Purchase Needed');
      expect(html).toContain('Your existing wardrobe covers current needs sufficiently.');
      expect(html).toContain('Zero commercial links');
      // Verify no commercial shop link
      expect(html).not.toContain('buy now');
      expect(html).not.toContain('shop here');
    });
  });

  describe('SaathiMessageItem', () => {
    it('renders confirmation prompt with Confirm and Cancel buttons for mutations', () => {
      const message: SaathiMessage = {
        id: 'msg_conf_1',
        sender: 'assistant',
        text: 'I can schedule this look for tomorrow.',
        timestamp: 1791892800000,
        confirmation: {
          id: 'conf_123',
          actionType: 'PLAN_OUTFIT',
          title: 'Schedule Look',
          description: 'Add outfit to calendar for office tomorrow?',
          payload: {},
          status: 'pending',
        },
      };

      const html = renderToString(
        <SaathiMessageItem
          message={message}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain('Schedule Look');
      expect(html).toContain('Add outfit to calendar for office tomorrow?');
      expect(html).toContain('Confirm &amp; Execute');
      expect(html).toContain('Cancel');
    });
  });
});
