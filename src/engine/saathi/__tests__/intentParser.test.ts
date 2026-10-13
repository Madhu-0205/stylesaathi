import { describe, it, expect } from 'vitest';
import { parseSaathiIntent, normalizeEntityInput } from '../intentParser';

describe('Phase 10: AI Saathi Intent Parser', () => {
  describe('Intent Classification', () => {
    it('classifies RECOMMEND_OUTFIT from natural language queries', () => {
      const inputs = [
        'What should I wear today?',
        'Suggest an outfit for office',
        'Help me pick clothes for a party tonight',
        'Recommend an outfit for college tomorrow',
        'Need look ideas for a wedding',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('RECOMMEND_OUTFIT');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      }
    });

    it('classifies STYLE_ITEM and extracts target garment details', () => {
      const result = parseSaathiIntent('Style this blue linen shirt for office');
      expect(result.intent).toBe('STYLE_ITEM');
      expect(result.entities.color).toBe('blue');
      expect(result.entities.garmentType).toBe('shirt');
      expect(result.entities.occasion).toBe('office');

      const kurtaResult = parseSaathiIntent('How can I style my black kurta?');
      expect(kurtaResult.intent).toBe('STYLE_ITEM');
      expect(kurtaResult.entities.color).toBe('black');
      expect(kurtaResult.entities.garmentType).toBe('kurta');
    });

    it('classifies CHECK_WARDROBE intent', () => {
      const inputs = [
        'Show my wardrobe',
        'What clothes do I have?',
        'View my closet inventory',
        'List my wardrobe items',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('CHECK_WARDROBE');
      }
    });

    it('classifies CHECK_WEATHER intent', () => {
      const inputs = [
        "What's the weather like today?",
        'Is it raining outside?',
        'Current temperature in Mumbai',
        'Check weather forecast',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('CHECK_WEATHER');
      }
    });

    it('classifies ANALYZE_WEAR intent', () => {
      const inputs = [
        'Show my wear analytics',
        'Which clothes are dormant?',
        'What items have I never worn?',
        'Show my rotation health',
        'Check cost per wear',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('ANALYZE_WEAR');
      }
    });

    it('classifies UNDERSTAND_STYLE intent', () => {
      const inputs = [
        'What is my style profile?',
        'Show my style brain',
        'What are my color preferences?',
        'Analyze my fashion style',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('UNDERSTAND_STYLE');
      }
    });

    it('classifies CHECK_WARDROBE_GAPS intent', () => {
      const inputs = [
        'What are my wardrobe gaps?',
        'Check wardrobe missing essentials',
        'Do I have any clothing shortages?',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('CHECK_WARDROBE_GAPS');
      }
    });

    it('classifies ASSESS_PURCHASE_NEED (Smart Buy) intent', () => {
      const inputs = [
        'Do I need to buy anything?',
        'Should I buy a new jacket?',
        'Do I need a new formal shirt?',
        'Is it worth buying this?',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('ASSESS_PURCHASE_NEED');
      }
    });

    it('classifies PLAN_OUTFIT intent', () => {
      const inputs = [
        'Plan outfit for tomorrow',
        'Schedule this look for Saturday',
        'Add outfit to calendar for office',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('PLAN_OUTFIT');
      }
    });

    it('classifies RECORD_WEAR intent', () => {
      const inputs = [
        'I wore this look today',
        'Log wear for my navy blazer',
        'Mark this outfit as worn',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('RECORD_WEAR');
      }
    });

    it('classifies FEEDBACK_POSITIVE and FEEDBACK_NEGATIVE intents', () => {
      const pos = parseSaathiIntent('I love this outfit! Perfect match.');
      expect(pos.intent).toBe('FEEDBACK_POSITIVE');

      const neg = parseSaathiIntent("I don't like this look at all, hate the colors");
      expect(neg.intent).toBe('FEEDBACK_NEGATIVE');
    });

    it('classifies EXPLAIN_RECOMMENDATION intent', () => {
      const inputs = [
        'Why did you recommend this outfit?',
        'Why this look?',
        'Explain why you suggested these clothes',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('EXPLAIN_RECOMMENDATION');
      }
    });

    it('classifies GENERAL_FASHION_QUESTION intent', () => {
      const inputs = [
        'Can I wear a kurta with jeans?',
        'How do I pair colors according to Indian fashion?',
        'What fabrics work best for humid weather?',
      ];

      for (const text of inputs) {
        const result = parseSaathiIntent(text);
        expect(result.intent).toBe('GENERAL_FASHION_QUESTION');
      }
    });

    it('returns UNKNOWN for unrecognizable gibberish queries', () => {
      const result = parseSaathiIntent('xyzqwerty12345 foo bar baz');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('Entity & Context Extraction', () => {
    it('extracts occasions accurately', () => {
      const res1 = parseSaathiIntent('Suggest clothes for a wedding');
      expect(res1.entities.occasion).toBe('wedding guest');

      const res2 = parseSaathiIntent('Outfit for casual outing with friends');
      expect(res2.entities.occasion).toBe('casual outing');

      const res3 = parseSaathiIntent('What to wear to office on Monday?');
      expect(res3.entities.occasion).toBe('office');
    });

    it('extracts relative dates', () => {
      const todayRes = parseSaathiIntent('What to wear today?');
      expect(todayRes.entities.date).toBe('today');

      const tomorrowRes = parseSaathiIntent('Style a look for tomorrow');
      expect(tomorrowRes.entities.date).toBe('tomorrow');

      const weekendRes = parseSaathiIntent('Outfit ideas for this weekend');
      expect(weekendRes.entities.date).toBe('this weekend');
    });

    it('extracts colors and garment subcategories', () => {
      const res = parseSaathiIntent('Pair my green silk saree with something nice');
      expect(res.entities.color).toBe('green');
      expect(res.entities.garmentType).toBe('saree');
      expect(res.entities.garmentCategory).toBe('Ethnic');
    });

    it('normalizes entity inputs cleanly', () => {
      expect(normalizeEntityInput('  Dark Blue Jeans  ')).toBe('dark blue jeans');
      expect(normalizeEntityInput('Kurta-Pyjama')).toBe('kurta-pyjama');
    });
  });
});
