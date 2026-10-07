import { describe, it, expect } from 'vitest';
import {
  NEEDLE_TOOLS,
  NEEDLE_TOOLS_JSON,
  getNeedleToolSchema,
} from '../needleSchemas';
import { NEEDLE_TOOL_NAMES } from '../needleTypes';

describe('needleSchemas', () => {
  it('defines exactly the 5 approved tools', () => {
    expect(NEEDLE_TOOLS).toHaveLength(5);
    const names = NEEDLE_TOOLS.map((t) => t.name);
    expect(names).toEqual(NEEDLE_TOOL_NAMES);
  });

  it('validates schema compliance for OpenAI / Needle function-calling format', () => {
    for (const tool of NEEDLE_TOOLS) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties).toBeDefined();
      if (tool.parameters.required) {
        expect(Array.isArray(tool.parameters.required)).toBe(true);
      }
    }
  });

  it('verifies recommend_outfit schema properties and enums', () => {
    const schema = getNeedleToolSchema('recommend_outfit');
    expect(schema).toBeDefined();
    expect(schema?.parameters.required).toContain('occasion');

    const occasionProp = schema?.parameters.properties.occasion as { enum?: string[] };
    expect(occasionProp.enum).toContain('college');
    expect(occasionProp.enum).toContain('office');
    expect(occasionProp.enum).toContain('casual outing');
    expect(occasionProp.enum).toContain('festive');
    expect(occasionProp.enum).toContain('wedding guest');

    const seasonProp = schema?.parameters.properties.season as { enum?: string[] };
    expect(seasonProp.enum).toEqual(['summer', 'monsoon', 'winter']);
  });

  it('verifies search_wardrobe schema categories and statuses', () => {
    const schema = getNeedleToolSchema('search_wardrobe');
    expect(schema).toBeDefined();

    const catProp = schema?.parameters.properties.category as { enum?: string[] };
    expect(catProp.enum).toEqual([
      'Tops',
      'Bottoms',
      'Ethnic',
      'Dresses',
      'Outerwear',
      'Footwear',
      'Accessories',
    ]);

    const statusProp = schema?.parameters.properties.status as { enum?: string[] };
    expect(statusProp.enum).toEqual(['clean', 'needs_washing', 'in_laundry']);
  });

  it('verifies record_wear schema requiring itemName', () => {
    const schema = getNeedleToolSchema('record_wear');
    expect(schema).toBeDefined();
    expect(schema?.parameters.required).toContain('itemName');
  });

  it('verifies create_style_plan schema requiring date and occasion', () => {
    const schema = getNeedleToolSchema('create_style_plan');
    expect(schema).toBeDefined();
    expect(schema?.parameters.required).toContain('date');
    expect(schema?.parameters.required).toContain('occasion');
  });

  it('verifies search_style_preferences schema options', () => {
    const schema = getNeedleToolSchema('search_style_preferences');
    expect(schema).toBeDefined();
    const prefProp = schema?.parameters.properties.preferenceType as { enum?: string[] };
    expect(prefProp.enum).toEqual(['contexts', 'aesthetics', 'stylingMode', 'all']);
  });

  it('provides a valid JSON string for WebAssembly model ingestion', () => {
    expect(typeof NEEDLE_TOOLS_JSON).toBe('string');
    const parsed = JSON.parse(NEEDLE_TOOLS_JSON);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(5);
    expect(parsed[0].name).toBe('recommend_outfit');
  });
});
