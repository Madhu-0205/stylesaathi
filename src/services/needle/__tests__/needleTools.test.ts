import { describe, it, expect } from 'vitest';
import {
  normalizeOccasion,
  normalizeDate,
  isDestructiveAction,
  validateAndNormalizeToolCall,
} from '../needleTools';
import { RawNeedleToolCall } from '../needleTypes';

describe('needleTools validation and normalization', () => {
  describe('normalizeOccasion', () => {
    it('normalizes common slang and casual synonyms to canonical Occasion', () => {
      expect(normalizeOccasion('uni')).toBe('college');
      expect(normalizeOccasion('campus')).toBe('college');
      expect(normalizeOccasion('lecture')).toBe('college');
      expect(normalizeOccasion('college')).toBe('college');

      expect(normalizeOccasion('work')).toBe('office');
      expect(normalizeOccasion('meeting')).toBe('office');
      expect(normalizeOccasion('job interview')).toBe('interview');

      expect(normalizeOccasion('shaadi')).toBe('wedding guest');
      expect(normalizeOccasion('wedding')).toBe('wedding guest');

      expect(normalizeOccasion('pooja')).toBe('puja');
      expect(normalizeOccasion('temple')).toBe('puja');
      expect(normalizeOccasion('deepavali')).toBe('Diwali');
    });

    it('returns null for unrecognized occasion', () => {
      expect(normalizeOccasion('outer_space_mission')).toBeNull();
      expect(normalizeOccasion('')).toBeNull();
    });
  });

  describe('normalizeDate', () => {
    it('normalizes relative dates', () => {
      const todayISO = new Date().toISOString().split('T')[0];
      expect(normalizeDate('today')).toBe(todayISO);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString().split('T')[0];
      expect(normalizeDate('tomorrow')).toBe(tomorrowISO);
    });

    it('validates ISO dates', () => {
      expect(normalizeDate('2026-11-15')).toBe('2026-11-15');
      expect(normalizeDate('not-a-date')).toBeNull();
    });
  });

  describe('isDestructiveAction', () => {
    it('detects destructive keywords in queries or parameters', () => {
      expect(isDestructiveAction('search_wardrobe', {}, 'delete my entire wardrobe')).toBe(true);
      expect(isDestructiveAction('create_style_plan', {}, 'clear all plans')).toBe(true);
      expect(isDestructiveAction('record_wear', {}, 'reset all wear counts')).toBe(true);
      expect(isDestructiveAction('recommend_outfit', {}, 'wipe all data')).toBe(true);
    });

    it('flags benign styling queries as non-destructive', () => {
      expect(isDestructiveAction('recommend_outfit', { occasion: 'college' }, 'Show me something casual for college.')).toBe(false);
      expect(isDestructiveAction('search_wardrobe', { color: 'black' }, 'Find my black jeans')).toBe(false);
    });
  });

  describe('validateAndNormalizeToolCall', () => {
    it('successfully validates recommend_outfit call', () => {
      const raw: RawNeedleToolCall = {
        name: 'recommend_outfit',
        arguments: {
          occasion: 'uni',
          style: 'casual',
        },
      };

      const result = validateAndNormalizeToolCall(raw, 0.92, 'Show me something casual for college.');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.toolCall.name).toBe('recommend_outfit');
        expect(result.toolCall.arguments.occasion).toBe('college');
        expect(result.toolCall.arguments.style).toBe('casual');
        expect(result.toolCall.confidence).toBe(0.92);
        expect(result.toolCall.confidenceLevel).toBe('HIGH');
        expect(result.toolCall.isDestructive).toBe(false);
        expect(result.toolCall.requiresConfirmation).toBe(false);
      }
    });

    it('requires confirmation for medium confidence even when valid', () => {
      const raw: RawNeedleToolCall = {
        name: 'recommend_outfit',
        arguments: { occasion: 'party' },
      };

      const result = validateAndNormalizeToolCall(raw, 0.65, 'maybe something for tonight party?');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.toolCall.confidenceLevel).toBe('MEDIUM');
        expect(result.toolCall.requiresConfirmation).toBe(true);
      }
    });

    it('requires confirmation for destructive query regardless of high confidence', () => {
      const raw: RawNeedleToolCall = {
        name: 'create_style_plan',
        arguments: { date: '2026-10-10', occasion: 'college' },
      };

      const result = validateAndNormalizeToolCall(raw, 0.98, 'delete all previous plans and reset');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.toolCall.isDestructive).toBe(true);
        expect(result.toolCall.requiresConfirmation).toBe(true);
      }
    });

    it('fails validation when required parameters are missing', () => {
      const raw: RawNeedleToolCall = {
        name: 'recommend_outfit',
        arguments: {}, // missing required occasion
      };

      const result = validateAndNormalizeToolCall(raw, 0.85);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('occasion');
      }
    });

    it('fails validation for unsupported tool name', () => {
      const raw: RawNeedleToolCall = {
        name: 'send_whatsapp_message',
        arguments: {},
      };

      const result = validateAndNormalizeToolCall(raw, 0.9);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Unknown tool');
      }
    });
  });
});
