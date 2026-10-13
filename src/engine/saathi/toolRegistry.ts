import {
  WardrobeItem,
  Category,
  Subcategory,
  Occasion,
  Season,
  GeneratedOutfit,
  OutfitPlan,
  RecommendedOutfit,
  MissingOutfitRequirement,
} from '../../types';
import {
  SaathiTool,
  SaathiToolContext,
  DomainResultReference,
} from './types';
import { recommendOutfitsWithTelemetry } from '../recommendationEngine';
import { derivePersonalStyleProfile } from '../styleBrain';
import { computeWearAnalytics } from '../analytics';
import { computeWardrobeGaps } from '../smartBuy';
import { fashionKnowledgeEngine } from '../knowledge/fashionKnowledgeEngine';
import { EXPLANATION_REGISTRY } from '../knowledge/explanations';

function getSafeStyleProfile(context: SaathiToolContext) {
  const baseProfile = derivePersonalStyleProfile([]);
  if (!context.styleProfile) return baseProfile;
  return {
    ...baseProfile,
    ...context.styleProfile,
    occasionAffinities: {
      ...baseProfile.occasionAffinities,
      ...(context.styleProfile.occasionAffinities || {}),
    },
  };
}

function getNormalizedWearEvents(context: SaathiToolContext) {
  const rawEvents = context.wearEvents || context.wearLogs || [];
  return rawEvents.map((w: any) => ({
    id: w.id || `wear_${w.itemId || w.wardrobeItemId || 'item'}`,
    userId: w.userId || 'user_1',
    wardrobeItemId: w.wardrobeItemId || w.itemId || '',
    wornAt: w.wornAt || w.timestamp || context.referenceTimestamp,
    createdAt: w.createdAt || context.referenceTimestamp,
  }));
}

// ============================================================================
// 1. TOOL: getWardrobe
// ============================================================================
export interface GetWardrobeInput {
  category?: Category;
  subcategory?: Subcategory;
  color?: string;
  status?: string;
  search?: string;
}

export const getWardrobeTool: SaathiTool<GetWardrobeInput, DomainResultReference> = {
  name: 'getWardrobe',
  description: 'Searches and filters owned garments from user wardrobe.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    let items = [...context.wardrobe];

    if (input.category) {
      items = items.filter((i) => i.category === input.category);
    }
    if (input.subcategory) {
      items = items.filter((i) => i.subcategory === input.subcategory);
    }
    if (input.color) {
      const col = input.color.toLowerCase();
      items = items.filter((i) => i.colors?.some((c) => c.toLowerCase().includes(col)));
    }
    if (input.status) {
      items = items.filter((i) => i.status === input.status);
    }
    if (input.search) {
      const q = input.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.subcategory.toLowerCase().includes(q)
      );
    }

    return {
      type: 'WARDROBE_SEARCH',
      summary: `Found ${items.length} matching piece${items.length === 1 ? '' : 's'} in your wardrobe.`,
      items,
      totalItems: items.length,
      cleanItems: items.filter((i) => i.status === 'clean').length,
    };
  },
};

// ============================================================================
// 2. TOOL: getWardrobeItem
// ============================================================================
export interface GetWardrobeItemInput {
  itemId: string;
}

export const getWardrobeItemTool: SaathiTool<GetWardrobeItemInput, DomainResultReference> = {
  name: 'getWardrobeItem',
  description: 'Retrieves specific garment attributes by ID.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const item = context.wardrobe.find((i) => i.id === input.itemId);
    if (!item) {
      return {
        type: 'ERROR',
        summary: `Garment with ID "${input.itemId}" was not found in your wardrobe.`,
      };
    }
    return {
      type: 'WARDROBE_SEARCH',
      summary: `Located ${item.name} (${item.category} • ${item.subcategory}).`,
      items: [item],
    };
  },
};

// ============================================================================
// 3. TOOL: getCurrentWeather
// ============================================================================
export const getCurrentWeatherTool: SaathiTool<Record<string, unknown>, DomainResultReference> = {
  name: 'getCurrentWeather',
  description: 'Inspects current verified weather snapshot from Phase 4 Weather Engine.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(_input, context) {
    const weatherData = context.weatherSnapshot?.weather || context.weather;
    if (!weatherData) {
      return {
        type: 'WEATHER',
        summary: "I can't verify the current weather right now, so I won't use weather as a recommendation factor.",
        weather: null,
      };
    }

    const temp = weatherData.temperature;
    const desc = weatherData.conditionText || weatherData.condition;
    const thermal = context.weatherSnapshot?.thermalContext || 'comfortable';
    const rain = context.weatherSnapshot?.rainContext || 'none';

    return {
      type: 'WEATHER',
      summary: `Current verified weather: ${temp}°C (${desc}). Thermal feeling: ${thermal}, rain risk: ${rain}.`,
      weather: weatherData,
    };
  },
};

// ============================================================================
// 4. TOOL: recommendOutfits (Phase 5 Recommendation Engine 2.0)
// ============================================================================
export interface RecommendOutfitsInput {
  occasion: Occasion;
  season: Season;
  dateStr?: string;
  limit?: number;
}

export const recommendOutfitsTool: SaathiTool<RecommendOutfitsInput, DomainResultReference> = {
  name: 'recommendOutfits',
  description: 'Invokes Phase 5 Recommendation Engine 2.0 to rank compatible outfits.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const localDate = input.dateStr || context.localDate || '2026-10-13';
    const limit = input.limit || 3;

    const result = recommendOutfitsWithTelemetry({
      items: context.wardrobe,
      occasion: input.occasion,
      season: input.season,
      localDate,
      preferences: context.preferences,
      styleProfile: getSafeStyleProfile(context),
      context: context.weatherSnapshot || undefined,
      limit,
    });

    const outfits = result.set.outfits;
    const missing = result.set.missingRequirements;

    if (outfits.length === 0) {
      return {
        type: 'RECOMMENDATION',
        summary: `No complete outfits could be formed for ${input.occasion} from clean wardrobe pieces.`,
        outfits: [],
        missingRequirements: missing,
      };
    }

    return {
      type: 'RECOMMENDATION',
      summary: `Generated ${outfits.length} look${outfits.length === 1 ? '' : 's'} tailored for ${input.occasion}.`,
      outfits,
      missingRequirements: missing,
    };
  },
};

// ============================================================================
// 5. TOOL: styleItem (Phase 7 Style This Item)
// ============================================================================
export interface StyleItemInput {
  anchorItemId: string;
  occasion: Occasion;
  season: Season;
  dateStr?: string;
  limit?: number;
}

export const styleItemTool: SaathiTool<StyleItemInput, DomainResultReference> = {
  name: 'styleItem',
  description: 'Invokes Phase 7 Style This Item to build looks anchored to a specific garment.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const anchor = context.wardrobe.find((i) => i.id === input.anchorItemId);
    if (!anchor) {
      return {
        type: 'ERROR',
        summary: `Cannot style garment: Item "${input.anchorItemId}" not found.`,
      };
    }

    const localDate = input.dateStr || context.localDate || '2026-10-13';
    const limit = input.limit || 3;

    const result = recommendOutfitsWithTelemetry({
      items: context.wardrobe,
      occasion: input.occasion,
      season: input.season,
      localDate,
      preferences: context.preferences,
      styleProfile: getSafeStyleProfile(context),
      context: context.weatherSnapshot || undefined,
      limit,
      anchorItemId: input.anchorItemId,
    });

    const outfits = result.set.outfits;
    const missing = result.set.missingRequirements;

    return {
      type: 'STYLE_ITEM',
      summary: `Styled ${anchor.name} into ${outfits.length} look${outfits.length === 1 ? '' : 's'} for ${input.occasion}.`,
      outfits,
      missingRequirements: missing,
      items: [anchor],
    };
  },
};

// ============================================================================
// 6. TOOL: getWearAnalytics (Phase 8 Wear Analytics)
// ============================================================================
export const getWearAnalyticsTool: SaathiTool<Record<string, unknown>, DomainResultReference> = {
  name: 'getWearAnalytics',
  description: 'Computes Phase 8 wear analytics, rotation health, and dormant pieces.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(_input, context) {
    const wearEvents = getNormalizedWearEvents(context);
    const report = computeWearAnalytics(
      context.wardrobe,
      wearEvents,
      context.referenceTimestamp
    );

    const mostWorn = report.mostWornItems.slice(0, 3).map((w) => `${w.item.name} (${w.effectiveWears} wears)`);
    const dormantCount = report.rotation.dormantCount + report.rotation.neverWornCount;

    return {
      type: 'WEAR_ANALYTICS',
      summary: `Total ${report.totalLifetimeWears} wear logs recorded. ${dormantCount} dormant/never-worn pieces. Top worn: ${mostWorn.join(', ') || 'None'}.`,
      wearReport: report,
      metrics: {
        totalWardrobeItems: context.wardrobe.length,
        totalLifetimeWears: report.totalLifetimeWears,
        ...report.rotation,
        unwornOrDormantCount: dormantCount,
      },
    };
  },
};

// ============================================================================
// 7. TOOL: getStyleProfile (Phase 3 Personal Style Brain)
// ============================================================================
export const getStyleProfileTool: SaathiTool<Record<string, unknown>, DomainResultReference> = {
  name: 'getStyleProfile',
  description: 'Inspects learned Personal Style Profile preferences and affinities.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(_input, context) {
    const profile = context.styleProfile;
    if (!profile) {
      return {
        type: 'STYLE_PROFILE',
        summary: 'Your Personal Style Profile is currently establishing as you interact with outfits.',
      };
    }

    const topColors = profile.topColors?.slice(0, 4).join(', ') || 'Varied palette';
    const avoidedFabrics = profile.avoidedFabrics?.join(', ') || 'None';
    const topAesthetics = context.preferences?.preferredAesthetics?.slice(0, 3).join(', ') || 'Modern classic';

    return {
      type: 'STYLE_PROFILE',
      summary: `Learned aesthetics: ${topAesthetics}. Favored colors: ${topColors}. Avoided fabrics: ${avoidedFabrics}.`,
      data: { profile },
    };
  },
};

// ============================================================================
// 8. TOOL: getWardrobeGaps (Phase 9 Smart Buy Gap Intelligence)
// ============================================================================
export const getWardrobeGapsTool: SaathiTool<Record<string, unknown>, DomainResultReference> = {
  name: 'getWardrobeGaps',
  description: 'Invokes Phase 9 Smart Buy 2.0 to detect genuine coverage gaps.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(_input, context) {
    const wearEvents = getNormalizedWearEvents(context);
    const wearAnalytics = computeWearAnalytics(
      context.wardrobe,
      wearEvents,
      context.referenceTimestamp
    );

    const report = computeWardrobeGaps({
      wardrobe: context.wardrobe,
      wearAnalytics,
      outfitPlans: context.plans || context.outfitPlans || [],
      styleProfile: getSafeStyleProfile(context),
      stylePreferences: context.preferences,
      contextSnapshot: context.weatherSnapshot || undefined,
      referenceTimestamp: context.referenceTimestamp,
    });

    const gapCount = report.gaps.length;
    const rediscoveryCount = report.negativeEvidence.rediscoveryOpportunitiesCount;

    const assessmentObj = {
      verdict: report.purchaseAssessment,
      purchaseAssessment: report.purchaseAssessment,
      headline: report.purchaseAssessment === 'NO_PURCHASE_NEEDED' ? 'No Purchase Needed' : 'Purchase Justified',
      summary: report.negativeEvidence.primaryReason,
      rediscoveryOpportunitiesCount: report.negativeEvidence.rediscoveryOpportunitiesCount,
      primaryReason: report.negativeEvidence.primaryReason,
      details: report.negativeEvidence.details,
      occasionGaps: report.coverageSummary.occasionReadiness.filter(
        (o) => o.isDeclaredActive && o.readiness !== 'fully_ready'
      ),
      confidenceScore: report.dataSufficiency.confidenceScore,
    };

    return {
      type: 'WARDROBE_GAPS',
      summary: `Wardrobe gap audit complete: ${gapCount} gap notices, ${rediscoveryCount} closet rediscovery opportunities. Assessment: ${report.purchaseAssessment}.`,
      gapReport: report,
      purchaseAssessment: assessmentObj as any,
    };
  },
};

// ============================================================================
// 9. TOOL: getPurchaseAssessment (Phase 9 Smart Buy Decision Support)
// ============================================================================
export const getPurchaseAssessmentTool: SaathiTool<Record<string, unknown>, DomainResultReference> = {
  name: 'getPurchaseAssessment',
  description: 'Answers "Do I actually need to buy anything?" via Phase 9 Smart Buy.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(_input, context) {
    const wearEvents = getNormalizedWearEvents(context);
    const wearAnalytics = computeWearAnalytics(
      context.wardrobe,
      wearEvents,
      context.referenceTimestamp
    );

    const report = computeWardrobeGaps({
      wardrobe: context.wardrobe,
      wearAnalytics,
      outfitPlans: context.plans || context.outfitPlans || [],
      styleProfile: getSafeStyleProfile(context),
      stylePreferences: context.preferences,
      contextSnapshot: context.weatherSnapshot || undefined,
      referenceTimestamp: context.referenceTimestamp,
    });

    const isNeeded = report.purchaseAssessment === 'PURCHASE_JUSTIFIED';

    let summary = report.negativeEvidence.primaryReason;
    if (isNeeded) {
      const topGap = report.gaps.find((g) => g.purchaseAssessment === 'PURCHASE_JUSTIFIED');
      summary = `A verified wardrobe gap was identified: ${topGap?.headline || 'Required capability missing'}.`;
    }

    const assessmentObj = {
      verdict: report.purchaseAssessment,
      purchaseAssessment: report.purchaseAssessment,
      headline: isNeeded ? 'Purchase Justified' : 'No Purchase Needed',
      summary,
      rediscoveryOpportunitiesCount: report.negativeEvidence.rediscoveryOpportunitiesCount,
      primaryReason: report.negativeEvidence.primaryReason,
      details: report.negativeEvidence.details,
      occasionGaps: report.coverageSummary.occasionReadiness.filter(
        (o) => o.isDeclaredActive && o.readiness !== 'fully_ready'
      ),
      confidenceScore: report.dataSufficiency.confidenceScore,
    };

    return {
      type: 'PURCHASE_ASSESSMENT',
      summary,
      gapReport: report,
      purchaseAssessment: assessmentObj as any,
    };
  },
};

// ============================================================================
// 10. TOOL: explainFashionKnowledge (Phase 6 IFKG)
// ============================================================================
export interface ExplainFashionKnowledgeInput {
  itemIds: string[];
}

export const explainFashionKnowledgeTool: SaathiTool<ExplainFashionKnowledgeInput, DomainResultReference> = {
  name: 'explainFashionKnowledge',
  description: 'Queries Indian Fashion Knowledge Graph for verified cultural and structural signals.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const items = context.wardrobe.filter((i) => input.itemIds.includes(i.id));
    if (items.length === 0) {
      return {
        type: 'FASHION_KNOWLEDGE',
        summary: 'No specific garments provided for fashion knowledge analysis.',
      };
    }

    const signals = fashionKnowledgeEngine.getSignals(items);
    const explanations = signals
      .map((s) => (s.explanationKey ? EXPLANATION_REGISTRY[s.explanationKey] : undefined))
      .filter(Boolean) as string[];

    return {
      type: 'FASHION_KNOWLEDGE',
      summary: explanations.join(' • ') || 'Ensemble follows balanced proportion and fabric compatibility.',
      knowledgeSignals: signals,
    };
  },
};

// ============================================================================
// 11. TOOL: createPlan (Calendar Mutation - Requires Confirmation!)
// ============================================================================
export interface CreatePlanInput {
  date: string; // YYYY-MM-DD
  occasion: Occasion;
  outfit: GeneratedOutfit;
  notes?: string;
}

export const createPlanTool: SaathiTool<CreatePlanInput, DomainResultReference> = {
  name: 'createPlan',
  description: 'Schedules an outfit look on the user calendar (Requires Confirmation).',
  isMutation: true,
  requiresConfirmation: true,
  async execute(input, context) {
    if (!context.onSavePlan) {
      return {
        type: 'ERROR',
        summary: 'Calendar save handler not available.',
      };
    }

    const plan = await context.onSavePlan({
      date: input.date,
      occasion: input.occasion,
      status: 'planned',
      outfit: input.outfit,
    });

    return {
      type: 'PLAN_CREATED',
      summary: `Outfit successfully planned for ${input.occasion} on ${input.date}.`,
      createdPlan: plan,
    };
  },
};

// ============================================================================
// 12. TOOL: recordWear (Wear Event Mutation - Requires Confirmation!)
// ============================================================================
export interface RecordWearInput {
  outfit: GeneratedOutfit;
  dateStr: string;
  accessoryItem?: WardrobeItem | null;
}

export const recordWearTool: SaathiTool<RecordWearInput, DomainResultReference> = {
  name: 'recordWear',
  description: 'Records wear event in wear history (Requires Confirmation).',
  isMutation: true,
  requiresConfirmation: true,
  async execute(input, context) {
    if (!context.onRecordWear) {
      return {
        type: 'ERROR',
        summary: 'Wear event recording handler not available.',
      };
    }

    await context.onRecordWear(input.outfit, input.dateStr, input.accessoryItem);

    return {
      type: 'WEAR_RECORDED',
      summary: `Logged wear event for ${input.dateStr}. Item wear counts and rotation health updated.`,
    };
  },
};

/**
 * Canonical tool registry map.
 */
export const SAATHI_TOOLS: Record<string, SaathiTool<any, any>> = {
  getWardrobe: getWardrobeTool,
  getWardrobeItem: getWardrobeItemTool,
  getCurrentWeather: getCurrentWeatherTool,
  recommendOutfits: recommendOutfitsTool,
  styleItem: styleItemTool,
  getWearAnalytics: getWearAnalyticsTool,
  getStyleProfile: getStyleProfileTool,
  getWardrobeGaps: getWardrobeGapsTool,
  getPurchaseAssessment: getPurchaseAssessmentTool,
  explainFashionKnowledge: explainFashionKnowledgeTool,
  createPlan: createPlanTool,
  recordWear: recordWearTool,
};

export const saathiToolRegistry = new Map<string, SaathiTool<any, any>>(
  Object.entries(SAATHI_TOOLS)
);
