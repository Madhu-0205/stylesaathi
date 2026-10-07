import { describe, it, expect } from 'vitest';
import {
  getConfidenceTier,
  isNeedleToolName,
  NEEDLE_TOOL_NAMES,
  type NeedleToolName,
  type RecommendOutfitArgs,
  type SearchWardrobeArgs,
  type RecordWearArgs,
  type CreateStylePlanArgs,
  type SearchStylePreferencesArgs,
} from '../needleTypes';

describe('needleTypes & confidence tiers', () => {
  it('exposes the 5 approved tool names', () => {
    expect(NEEDLE_TOOL_NAMES).toEqual([
      'recommend_outfit',
      'search_wardrobe',
      'record_wear',
      'create_style_plan',
      'search_style_preferences',
    ]);
  });

  it('validates tool name typeguards', () => {
    expect(isNeedleToolName('recommend_outfit')).toBe(true);
    expect(isNeedleToolName('search_wardrobe')).toBe(true);
    expect(isNeedleToolName('record_wear')).toBe(true);
    expect(isNeedleToolName('create_style_plan')).toBe(true);
    expect(isNeedleToolName('search_style_preferences')).toBe(true);
    expect(isNeedleToolName('delete_everything')).toBe(false);
    expect(isNeedleToolName('')).toBe(false);
    expect(isNeedleToolName(null)).toBe(false);
  });

  it('classifies confidence scores according to approved tiers', () => {
    // High tier: >= 0.80
    expect(getConfidenceTier(0.80)).toBe('HIGH');
    expect(getConfidenceTier(0.95)).toBe('HIGH');
    expect(getConfidenceTier(1.0)).toBe('HIGH');

    // Medium tier: 0.50 <= score < 0.80
    expect(getConfidenceTier(0.50)).toBe('MEDIUM');
    expect(getConfidenceTier(0.65)).toBe('MEDIUM');
    expect(getConfidenceTier(0.799)).toBe('MEDIUM');

    // Low tier: < 0.50
    expect(getConfidenceTier(0.499)).toBe('LOW');
    expect(getConfidenceTier(0.25)).toBe('LOW');
    expect(getConfidenceTier(0.0)).toBe('LOW');
    expect(getConfidenceTier(-0.5)).toBe('LOW');
  });

  it('enforces argument types structure', () => {
    const recArgs: RecommendOutfitArgs = {
      occasion: 'college',
      style: 'casual',
      season: 'summer',
    };
    expect(recArgs.occasion).toBe('college');

    const searchArgs: SearchWardrobeArgs = {
      category: 'Tops',
      color: 'navy',
    };
    expect(searchArgs.category).toBe('Tops');

    const wearArgs: RecordWearArgs = {
      itemName: 'Ivory Kurta',
      date: '2026-10-07',
    };
    expect(wearArgs.itemName).toBe('Ivory Kurta');

    const planArgs: CreateStylePlanArgs = {
      date: '2026-10-08',
      occasion: 'college',
      notes: 'Midterm presentation',
    };
    expect(planArgs.date).toBe('2026-10-08');

    const prefArgs: SearchStylePreferencesArgs = {
      preferenceType: 'aesthetics',
    };
    expect(prefArgs.preferenceType).toBe('aesthetics');
  });
});
