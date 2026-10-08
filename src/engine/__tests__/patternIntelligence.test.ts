import { describe, it, expect } from 'vitest';
import { getPatternCompatibilityScore } from '../patternIntelligence';

describe('Pattern Intelligence Engine', () => {
  it('rewards classic solid + solid pairing', () => {
    expect(getPatternCompatibilityScore('solid', 'solid')).toBe(1.5);
  });

  it('rewards anchor solid + ethnic print pairing (focal point harmony)', () => {
    expect(getPatternCompatibilityScore('solid', 'floral')).toBe(2.0);
    expect(getPatternCompatibilityScore('solid', 'ikat')).toBe(2.0);
    expect(getPatternCompatibilityScore('solid', 'bandhani')).toBe(2.0);
    expect(getPatternCompatibilityScore('solid', 'block_print')).toBe(2.0);
    expect(getPatternCompatibilityScore('striped', 'solid')).toBe(2.0);
  });

  it('rewards zari / brocade with solid or embroidered pairing', () => {
    expect(getPatternCompatibilityScore('zari_brocade', 'solid')).toBe(2.0);
    expect(getPatternCompatibilityScore('zari_brocade', 'embroidered')).toBe(1.8);
  });

  it('penalizes competing heavy prints without solid anchor', () => {
    expect(getPatternCompatibilityScore('floral', 'ikat')).toBeLessThan(0);
    expect(getPatternCompatibilityScore('bandhani', 'kalamkari')).toBeLessThan(0);
  });

  it('handles unknown and missing patterns gracefully without throwing', () => {
    expect(getPatternCompatibilityScore(undefined, 'solid')).toBe(0);
    expect(getPatternCompatibilityScore('solid', undefined)).toBe(0);
    expect(getPatternCompatibilityScore('unknown', 'unknown')).toBe(0);
  });
});
