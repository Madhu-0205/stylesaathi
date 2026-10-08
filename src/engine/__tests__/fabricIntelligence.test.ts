import { describe, it, expect } from 'vitest';
import {
  getFabricBreathability,
  getFabricClimateSuitability,
  getFabricFormality,
} from '../fabricIntelligence';

describe('Fabric Intelligence Engine', () => {
  it('correctly classifies fabric breathability tiers for Indian weather', () => {
    expect(getFabricBreathability('cotton')).toBe('high');
    expect(getFabricBreathability('linen')).toBe('high');
    expect(getFabricBreathability('khadi')).toBe('high');
    expect(getFabricBreathability('mulmul')).toBe('high');

    expect(getFabricBreathability('chiffon')).toBe('medium');
    expect(getFabricBreathability('georgette')).toBe('medium');
    expect(getFabricBreathability('rayon')).toBe('medium');

    expect(getFabricBreathability('silk')).toBe('low');
    expect(getFabricBreathability('velvet')).toBe('low');
    expect(getFabricBreathability('wool')).toBe('low');
    expect(getFabricBreathability('denim')).toBe('low');

    // Unknown defaults to medium safely
    expect(getFabricBreathability(undefined)).toBe('medium');
    expect(getFabricBreathability('unknown')).toBe('medium');
  });

  it('awards climate suitability bonus to breathable fabrics in summer and penalizes heavy fabrics', () => {
    // Cotton/Linen/Khadi in summer gets strong bonus
    expect(getFabricClimateSuitability('cotton', 'summer')).toBeGreaterThan(1.0);
    expect(getFabricClimateSuitability('linen', 'summer')).toBeGreaterThan(1.0);
    expect(getFabricClimateSuitability('khadi', 'summer')).toBeGreaterThan(1.0);

    // Wool/Velvet in summer gets severe penalty
    expect(getFabricClimateSuitability('wool', 'summer')).toBeLessThan(-2.0);
    expect(getFabricClimateSuitability('velvet', 'summer')).toBeLessThan(-2.0);

    // Wool/Velvet in winter gets bonus
    expect(getFabricClimateSuitability('wool', 'winter')).toBeGreaterThan(1.5);
    expect(getFabricClimateSuitability('velvet', 'winter')).toBeGreaterThan(1.5);

    // Linen in winter gets slight penalty
    expect(getFabricClimateSuitability('linen', 'winter')).toBeLessThan(0);
  });

  it('determines craft formality tier appropriately', () => {
    expect(getFabricFormality('banarasi')).toBeCloseTo(4.8, 1);
    expect(getFabricFormality('silk')).toBeGreaterThanOrEqual(4.0);
    expect(getFabricFormality('chanderi')).toBeCloseTo(3.5, 1);
    expect(getFabricFormality('cotton')).toBeCloseTo(2.2, 1);
    expect(getFabricFormality(undefined)).toBe(2.5);
  });
});
