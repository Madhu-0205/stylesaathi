import { NeedleToolName } from './needleTypes';

export interface NeedleToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface NeedleToolParameters {
  type: 'object';
  properties: Record<string, NeedleToolParameterProperty>;
  required?: string[];
}

export interface NeedleToolDefinition {
  name: NeedleToolName;
  description: string;
  parameters: NeedleToolParameters;
}

export const NEEDLE_TOOLS: NeedleToolDefinition[] = [
  {
    name: 'recommend_outfit',
    description:
      'Generate an outfit recommendation based on occasion, style vibe, or weather season from the user wardrobe.',
    parameters: {
      type: 'object',
      properties: {
        occasion: {
          type: 'string',
          description: 'The occasion or event for the outfit.',
          enum: [
            'college',
            'everyday',
            'office',
            'interview',
            'casual outing',
            'date',
            'party',
            'family function',
            'family gathering',
            'puja',
            'festive',
            'wedding guest',
            'celebration',
            'Diwali',
            'Holi',
            'Eid',
            'travel',
          ],
        },
        style: {
          type: 'string',
          description:
            'Desired aesthetic or vibe, e.g. casual, elegant, indo-western, minimal, bold, traditional.',
        },
        season: {
          type: 'string',
          description: 'Seasonal context.',
          enum: ['summer', 'monsoon', 'winter'],
        },
      },
      required: ['occasion'],
    },
  },
  {
    name: 'search_wardrobe',
    description:
      'Search and filter garments in the user wardrobe by category, color, subcategory, or status.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Garment category.',
          enum: [
            'Tops',
            'Bottoms',
            'Ethnic',
            'Dresses',
            'Outerwear',
            'Footwear',
            'Accessories',
          ],
        },
        color: {
          type: 'string',
          description: 'Color of the item (e.g., black, white, navy, red, gold, beige).',
        },
        subcategory: {
          type: 'string',
          description: 'Specific garment type (e.g., kurta, jeans, sneakers, saree, blazer).',
        },
        status: {
          type: 'string',
          description: 'Laundry or cleanliness status of the garment.',
          enum: ['clean', 'needs_washing', 'in_laundry'],
        },
      },
    },
  },
  {
    name: 'record_wear',
    description: 'Record that an item or outfit was worn today or on a specified date.',
    parameters: {
      type: 'object',
      properties: {
        itemName: {
          type: 'string',
          description: 'Name or keyword of the garment worn.',
        },
        date: {
          type: 'string',
          description: 'ISO date string (YYYY-MM-DD). Defaults to today if omitted.',
        },
      },
      required: ['itemName'],
    },
  },
  {
    name: 'create_style_plan',
    description:
      'Schedule and plan an outfit on the Style Calendar for a given date and occasion.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'ISO date string (YYYY-MM-DD) for the scheduled plan.',
        },
        occasion: {
          type: 'string',
          description: 'The occasion for the plan.',
          enum: [
            'college',
            'everyday',
            'office',
            'interview',
            'casual outing',
            'date',
            'party',
            'family function',
            'family gathering',
            'puja',
            'festive',
            'wedding guest',
            'celebration',
            'Diwali',
            'Holi',
            'Eid',
            'travel',
          ],
        },
        notes: {
          type: 'string',
          description: 'Optional notes or styling instructions.',
        },
      },
      required: ['date', 'occasion'],
    },
  },
  {
    name: 'search_style_preferences',
    description:
      'Inspect or review current style preferences, active aesthetic vibes, and styling modes.',
    parameters: {
      type: 'object',
      properties: {
        preferenceType: {
          type: 'string',
          description: 'Which preference attribute to query.',
          enum: ['contexts', 'aesthetics', 'stylingMode', 'all'],
        },
      },
    },
  },
];

export const NEEDLE_TOOLS_JSON = JSON.stringify(NEEDLE_TOOLS);

export function getNeedleToolSchema(name: NeedleToolName): NeedleToolDefinition | undefined {
  return NEEDLE_TOOLS.find((t) => t.name === name);
}
