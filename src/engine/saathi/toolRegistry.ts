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
import {
  DiscoveryClassification,
  CuratedActiveTrend,
  TrendEvidence,
} from '../trends/types';
import {
  getBundledCuratedTrends,
  getBundledTrendById,
} from '../trends/trendCatalog';
import {
  evaluateWardrobeDiscoveryOpportunities,
  exploreTrendWithWardrobe,
} from '../trends/discoveryEngine';
import { evaluateTrendEvidence } from '../trends/evidenceEvaluator';

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
  occasion?: Occasion;
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
      if (input.status === 'in_laundry') {
        items = items.filter((i) => i.status === 'in_laundry' || i.status === 'needs_washing');
      } else {
        items = items.filter((i) => i.status === input.status);
      }
    }
    if (input.occasion) {
      items = items.filter((i) => i.occasions && i.occasions.includes(input.occasion!));
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
export interface GetCurrentWeatherInput {
  relativeDate?: string;
  dateStr?: string;
}

export const getCurrentWeatherTool: SaathiTool<GetCurrentWeatherInput, DomainResultReference> = {
  name: 'getCurrentWeather',
  description: 'Inspects current or relative forecast weather snapshot from Phase 4 Weather Engine.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const isTomorrow = input?.relativeDate === 'tomorrow';
    const periods = context.forecast?.periods || [];
    const tomorrowPeriod = periods.find(
      (p: any) => p.period === 'tomorrow' || (input?.dateStr && p.date === input.dateStr)
    );

    if (isTomorrow) {
      if (tomorrowPeriod) {
        const freshness = context.freshness || 'fresh';
        const freshnessBadge = freshness === 'fresh' ? 'Verified Live Forecast' : 'Cached Forecast';
        const minTemp = tomorrowPeriod.temperatureMin;
        const maxTemp = tomorrowPeriod.temperatureMax;
        const condition = tomorrowPeriod.summary || tomorrowPeriod.condition;
        const rainChance = tomorrowPeriod.precipitationProbability ?? 0;
        const thermal = maxTemp > 32 ? 'warm to hot' : minTemp < 18 ? 'cool to mild' : 'pleasant';

        const summary = `Tomorrow's forecast: ${minTemp}°–${maxTemp}°C (${condition}). Rain risk: ${rainChance}% (${freshnessBadge}). Thermal expectation: ${thermal}.`;
        return {
          type: 'WEATHER',
          summary,
          weather: {
            ...tomorrowPeriod,
            temperature: maxTemp,
            relativeDate: 'tomorrow',
            freshness,
          },
        };
      }

      const weatherData = context.weatherSnapshot?.weather || context.weather;
      const city = weatherData?.location?.city || 'your region';
      const summary = `Tomorrow's live forecast for ${city} is currently unavailable offline (honest offline fallback). Expect seasonal conditions; light breathable cotton or adaptable layers are recommended.`;
      return {
        type: 'WEATHER',
        summary,
        weather: null,
      };
    }

    const weatherData = context.weatherSnapshot?.weather || context.weather;
    const isExpired = Boolean(
      weatherData?.expiresAt &&
        context.referenceTimestamp &&
        weatherData.expiresAt < context.referenceTimestamp
    );

    if (!weatherData || isExpired) {
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
  anchorItemId?: string;
  allowPlanningMode?: boolean;
  recentWornItemIds?: string[];
}

export const recommendOutfitsTool: SaathiTool<RecommendOutfitsInput, DomainResultReference> = {
  name: 'recommendOutfits',
  description: 'Invokes Phase 5 Recommendation Engine 2.0 to rank compatible outfits.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const localDate = input.dateStr || context.localDate || '2026-10-13';
    const limit = input.limit || 3;

    const filteredWardrobe =
      input.recentWornItemIds && input.recentWornItemIds.length > 0
        ? context.wardrobe.filter((i) => !input.recentWornItemIds!.includes(i.id))
        : context.wardrobe;

    const itemsToPass = filteredWardrobe.length > 0 ? filteredWardrobe : context.wardrobe;

    const result = recommendOutfitsWithTelemetry({
      items: itemsToPass,
      occasion: input.occasion,
      season: input.season,
      localDate,
      preferences: context.preferences,
      styleProfile: getSafeStyleProfile(context),
      context: context.weatherSnapshot || undefined,
      limit,
      anchorItemId: input.anchorItemId,
      allowPlanningMode: input.allowPlanningMode,
      recentWornItemIds: input.recentWornItemIds,
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
export interface GetPurchaseAssessmentInput {
  category?: Category;
  subcategory?: Subcategory;
  search?: string;
  targetPriceINR?: number;
  occasion?: Occasion;
  occasionSubtype?: string;
  anchorItemId?: string;
  explicitNoPurchase?: boolean;
}

export const getPurchaseAssessmentTool: SaathiTool<GetPurchaseAssessmentInput, DomainResultReference> = {
  name: 'getPurchaseAssessment',
  description: 'Answers "Do I actually need to buy anything?" via Phase 9 Smart Buy and Occasion-Scoped Intelligence.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    // 1. Explicit No Purchase Flag
    if (input?.explicitNoPurchase) {
      const summary =
        'Understood! StyleSaathi focuses 100% on creative combinations from your existing wardrobe. No purchases are recommended.';
      return {
        type: 'PURCHASE_ASSESSMENT',
        summary,
        purchaseAssessment: {
          verdict: 'NO_PURCHASE_NEEDED',
          purchaseVerdict: 'NO_PURCHASE_NEEDED',
          purchaseAssessment: 'NO_PURCHASE_NEEDED',
          headline: 'Zero Purchase Philosophy',
          summary,
          primaryReason: summary,
          rediscoveryOpportunitiesCount: 0,
          details: ['Working strictly with existing wardrobe garments.'],
        } as any,
      };
    }

    const queriedTerm = input?.search || input?.subcategory || input?.category;

    // 2. Occasion-Scoped Purchase Assessment (Critical Phase 1.10 Trust Mandate)
    if (input?.occasion) {
      const occasion = input.occasion;
      const cleanItems = context.wardrobe.filter((i) => i.status === 'clean');

      // Attempt recommendation using clean owned garments
      const cleanRecResult = recommendOutfitsWithTelemetry({
        items: cleanItems,
        occasion,
        season: 'summer',
        localDate: context.localDate || '2026-10-13',
        anchorItemId: input?.anchorItemId,
        preferences: context.preferences,
        styleProfile: getSafeStyleProfile(context),
        limit: 3,
      });

      const cleanOutfits = cleanRecResult.set.outfits;

      if (cleanOutfits.length > 0) {
        const topOutfit = cleanOutfits[0];
        const pieces = Object.values(topOutfit.slots || {}).flat();
        const pieceNames = pieces.map((p) => p.name).join(' + ');

        // Check if user queried a specific item (e.g. "Do I need a blazer for party?")
        if (queriedTerm) {
          const q = queriedTerm.toLowerCase();
          const matchingOwned = context.wardrobe.filter((i) => {
            if (input?.subcategory && i.subcategory !== input.subcategory) return false;
            if (input?.category && i.category !== input.category) return false;
            if (input?.search) {
              const s = input.search.toLowerCase();
              return (
                i.name.toLowerCase().includes(s) ||
                i.subcategory.toLowerCase().includes(s) ||
                i.category.toLowerCase().includes(s)
              );
            }
            return true;
          });

          if (matchingOwned.length > 0) {
            const ownedNames = matchingOwned.slice(0, 3).map((i) => i.name).join(', ');
            const summary = `You already own ${matchingOwned.length} matching piece${
              matchingOwned.length === 1 ? '' : 's'
            } (${ownedNames}) that can be styled for ${occasion}. No purchase is needed.`;
            return {
              type: 'PURCHASE_ASSESSMENT',
              summary,
              purchaseAssessment: {
                verdict: 'NO_PURCHASE_NEEDED',
                purchaseVerdict: 'NO_PURCHASE_NEEDED',
                purchaseAssessment: 'NO_PURCHASE_NEEDED',
                headline: 'No Purchase Needed',
                summary,
                primaryReason: summary,
                occasion,
                evaluatedPieces: matchingOwned,
                recommendedLook: topOutfit,
                rediscoveryOpportunitiesCount: 0,
                details: [`Ready look available: ${pieceNames}`],
              } as any,
            };
          }

          // Item is absent from wardrobe, but is it an optional layer or accessory?
          const isOptionalRole =
            input?.category === 'Outerwear' ||
            ['blazer', 'jacket', 'cardigan', 'shrug', 'sweater'].includes(
              input?.subcategory || ''
            ) ||
            q.includes('blazer') ||
            q.includes('jacket') ||
            q.includes('shrug') ||
            q.includes('cardigan') ||
            q.includes('accessory') ||
            q.includes('watch') ||
            q.includes('belt');

          if (isOptionalRole) {
            const summary = `Your core look for ${occasion} is fully complete with ${pieceNames}. An optional ${queriedTerm} could add extra flair, but you do not need to buy anything.`;
            return {
              type: 'PURCHASE_ASSESSMENT',
              summary,
              purchaseAssessment: {
                verdict: 'OPTIONAL_GAP',
                purchaseVerdict: 'PURCHASE_OPTIONAL',
                purchaseAssessment: 'NO_PURCHASE_NEEDED',
                headline: 'Optional Enhancement Only',
                summary,
                primaryReason: summary,
                occasion,
                evaluatedPieces: pieces,
                recommendedLook: topOutfit,
                rediscoveryOpportunitiesCount: 0,
                details: [
                  `Complete baseline outfit: ${pieceNames}`,
                  `No essential clothing shortage exists for ${occasion}.`,
                ],
              } as any,
            };
          }
        }

        // Standard Occasion Query: "I was likely to go to Party tonight then is anything I have to buy for it?"
        const summary = `You already have a complete look for ${occasion} in your closet: ${pieceNames}. No purchase is needed.`;
        return {
          type: 'PURCHASE_ASSESSMENT',
          summary,
          purchaseAssessment: {
            verdict: 'NO_PURCHASE_NEEDED',
            purchaseVerdict: 'NO_PURCHASE_NEEDED',
            purchaseAssessment: 'NO_PURCHASE_NEEDED',
            headline: 'No Purchase Needed',
            summary,
            primaryReason: summary,
            occasion,
            evaluatedPieces: pieces,
            recommendedLook: topOutfit,
            rediscoveryOpportunitiesCount: 0,
            details: [
              `Core requirements (top, bottom, and footwear) are satisfied by owned clean garments.`,
              `Styling with existing wardrobe pieces provides a polished look.`,
            ],
          } as any,
        };
      }

      // If cleanOutfits.length === 0, investigate why:
      // A. Insufficient wardrobe baseline data: evaluate required role coverage across closet
      const hasTopOrHero = context.wardrobe.some(
        (i) => i.category === 'Tops' || i.category === 'Ethnic'
      );
      const hasBottomOrHero = context.wardrobe.some(
        (i) =>
          i.category === 'Bottoms' ||
          (i.category === 'Ethnic' &&
            ['saree', 'lehenga', 'salwar set', 'anarkali'].includes(i.subcategory || ''))
      );
      const hasFootwear = context.wardrobe.some((i) => i.category === 'Footwear');

      const unpopulatedRoles: string[] = [];
      if (!hasTopOrHero) unpopulatedRoles.push('tops');
      if (!hasBottomOrHero) unpopulatedRoles.push('bottoms');
      if (!hasFootwear) unpopulatedRoles.push('footwear');

      // If wardrobe is empty or lacks multiple essential roles across the entire closet, metadata is insufficient to judge gaps
      if (context.wardrobe.length === 0 || unpopulatedRoles.length >= 2) {
        const summary = `Your wardrobe catalog lacks baseline registered pieces (${unpopulatedRoles.join(
          ', '
        )}). Add your core wardrobe essentials so I can accurately assess occasion gaps.`;
        return {
          type: 'PURCHASE_ASSESSMENT',
          summary,
          purchaseAssessment: {
            verdict: 'INSUFFICIENT_INFORMATION',
            purchaseVerdict: 'INSUFFICIENT_INFORMATION',
            purchaseAssessment: 'NO_PURCHASE_NEEDED',
            headline: 'More Wardrobe Information Needed',
            summary,
            primaryReason: summary,
            occasion,
            rediscoveryOpportunitiesCount: 0,
            details: [
              `Unpopulated wardrobe roles: ${unpopulatedRoles.join(', ')}`,
              'Register your core wardrobe garments before assessing occasion shopping needs.',
            ],
          } as any,
        };
      }

      // B. Check if in-laundry garments would form an outfit if clean
      const asIfCleanItems = context.wardrobe.map((item) =>
        item.status === 'in_laundry' || item.status === 'needs_washing'
          ? { ...item, status: 'clean' as const }
          : item
      );
      const allItemsRec = recommendOutfitsWithTelemetry({
        items: asIfCleanItems,
        occasion,
        season: 'summer',
        localDate: context.localDate || '2026-10-13',
        anchorItemId: input?.anchorItemId,
        preferences: context.preferences,
        styleProfile: getSafeStyleProfile(context),
        limit: 3,
      });

      if (allItemsRec.set.outfits.length > 0) {
        const potentialOutfit = allItemsRec.set.outfits[0];
        const dirtyPieces = Object.values(potentialOutfit.slots || {})
          .flat()
          .map((p) => context.wardrobe.find((w) => w.id === p.id) || p)
          .filter((p) => p.status !== 'clean');
        const dirtyNames = dirtyPieces.map((p) => p.name).join(', ') || 'essential pieces';

        const summary = `No purchase needed. Your wardrobe has pieces for ${occasion}, but key garments (${dirtyNames}) are currently in laundry. Washing them gives you a complete ready look.`;
        return {
          type: 'PURCHASE_ASSESSMENT',
          summary,
          purchaseAssessment: {
            verdict: 'NO_VALID_OUTFIT',
            purchaseVerdict: 'NO_PURCHASE_NEEDED',
            purchaseAssessment: 'NO_PURCHASE_NEEDED',
            headline: 'No Purchase Needed (Laundry Bottleneck)',
            summary,
            primaryReason: summary,
            occasion,
            laundryNotice: `Washing ${dirtyNames} will complete this outfit.`,
            evaluatedPieces: Object.values(potentialOutfit.slots || {}).flat(),
            recommendedLook: potentialOutfit,
            rediscoveryOpportunitiesCount: 0,
            details: [`In-laundry pieces needed: ${dirtyNames}`],
          } as any,
        };
      }

      // C. Genuine Wardrobe Gap: Essential role genuinely missing across entire closet
      const missingRolesList = (cleanRecResult.set.missingRequirements || []).map(
        (r: any) => r.missingRole || r.role
      );
      const missingRoles = missingRolesList.join(', ') || 'essential footwear or coordinates';

      const isCriticalStructuralMissing = missingRolesList.some((r: any) =>
        ['top', 'bottom', 'footwear', 'tops', 'bottoms', 'shoe', 'shoes'].includes(
          String(r).toLowerCase()
        )
      );
      const purchaseVerdict = isCriticalStructuralMissing
        ? 'PURCHASE_STRONGLY_RECOMMENDED'
        : 'PURCHASE_RECOMMENDED';

      const summary = `A necessary component is missing for ${occasion}: you do not have suitable ${missingRoles} in your closet.`;
      return {
        type: 'PURCHASE_ASSESSMENT',
        summary,
        purchaseAssessment: {
          verdict: 'WARDROBE_GAP',
          purchaseVerdict,
          purchaseAssessment: 'PURCHASE_JUSTIFIED',
          headline: 'Verified Wardrobe Gap',
          summary,
          primaryReason: summary,
          occasion,
          missingRoles: missingRolesList,
          rediscoveryOpportunitiesCount: 0,
          details: [`Essential role missing for ${occasion}: ${missingRoles}`],
        } as any,
      };
    }

    // 3. General Fallback Assessment (when no specific occasion requested)
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

    // If user queried a specific item in general context (e.g. "Should I buy blue jeans?")
    let specificItemCheck: { ownedCount: number; cleanCount: number; matchingItems: WardrobeItem[] } | undefined;

    if (queriedTerm) {
      const q = queriedTerm.toLowerCase();
      const matching = context.wardrobe.filter((i) => {
        if (input?.subcategory && i.subcategory === input.subcategory) return true;
        if (input?.category && i.category === input.category) return true;
        return (
          i.name.toLowerCase().includes(q) ||
          i.subcategory.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
        );
      });
      if (matching.length > 0) {
        specificItemCheck = {
          ownedCount: matching.length,
          cleanCount: matching.filter((i) => i.status === 'clean').length,
          matchingItems: matching,
        };
      }
    }

    const isNeeded = specificItemCheck ? false : report.purchaseAssessment === 'PURCHASE_JUSTIFIED';

    let summary = report.negativeEvidence.primaryReason;
    if (specificItemCheck && specificItemCheck.ownedCount > 0) {
      const itemNames = specificItemCheck.matchingItems.slice(0, 3).map((i) => i.name).join(', ');
      summary = `You already own ${specificItemCheck.ownedCount} ${queriedTerm || 'matching'} piece${specificItemCheck.ownedCount === 1 ? '' : 's'} (${itemNames}) in your wardrobe. No additional purchase is justified.`;
    } else if (isNeeded) {
      const topGap = report.gaps.find((g) => g.purchaseAssessment === 'PURCHASE_JUSTIFIED');
      summary = `A verified wardrobe gap was identified: ${topGap?.headline || 'Required capability missing'}.`;
    }

    const topGap = report.gaps.find((g) => g.purchaseAssessment === 'PURCHASE_JUSTIFIED');
    const isCritical =
      topGap?.gapState === 'CRITICAL_GAP' ||
      topGap?.expectedCategory === 'Bottoms' ||
      topGap?.expectedCategory === 'Footwear';
    const generalPurchaseVerdict = isNeeded
      ? isCritical
        ? 'PURCHASE_STRONGLY_RECOMMENDED'
        : 'PURCHASE_RECOMMENDED'
      : 'NO_PURCHASE_NEEDED';

    const assessmentObj = {
      verdict: isNeeded ? 'PURCHASE_JUSTIFIED' : 'NO_PURCHASE_NEEDED',
      purchaseVerdict: generalPurchaseVerdict,
      purchaseAssessment: isNeeded ? 'PURCHASE_JUSTIFIED' : 'NO_PURCHASE_NEEDED',
      headline: isNeeded
        ? isCritical
          ? 'Essential Structural Gap'
          : 'Purchase Justified'
        : 'No Purchase Needed',
      summary,
      rediscoveryOpportunitiesCount: report.negativeEvidence.rediscoveryOpportunitiesCount,
      primaryReason: summary,
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

// ============================================================================
// 13. TOOL: getRelevantTrends (Phase 11 - Trend Intelligence)
// ============================================================================
export interface GetRelevantTrendsInput {
  occasion?: Occasion;
  classification?: DiscoveryClassification;
}

export const getRelevantTrendsTool: SaathiTool<GetRelevantTrendsInput, DomainResultReference> = {
  name: 'getRelevantTrends',
  description: 'Discovers active curated fashion trends evaluated against existing wardrobe pieces.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const refDateStr = new Date(context.referenceTimestamp).toISOString().split('T')[0];
    const trends = getBundledCuratedTrends().filter((t) => {
      if (!input.occasion) return true;
      return t.concept.targetAttributes.occasions.includes(input.occasion);
    });

    const styleProfile = getSafeStyleProfile(context);
    const wearEvents = getNormalizedWearEvents(context);
    const analytics = computeWearAnalytics(context.wardrobe, wearEvents, context.referenceTimestamp);
    const dormantItems = analytics.dormantItems.map((d) => d.item);

    const opportunities = evaluateWardrobeDiscoveryOpportunities(
      trends,
      context.wardrobe,
      styleProfile,
      context.weatherSnapshot?.weather || context.weather || undefined,
      context.culturalSignals,
      dormantItems,
      refDateStr
    );

    const filtered = input.classification
      ? opportunities.filter((o) => o.evidence.classification === input.classification)
      : opportunities;

    const evidenceList = filtered.map((o) => o.evidence);

    return {
      type: 'TREND_INTELLIGENCE',
      summary: `Found ${evidenceList.length} relevant trends matching your style and wardrobe.`,
      trends: evidenceList,
      data: {
        trends: evidenceList,
      },
    };
  },
};

// ============================================================================
// 14. TOOL: exploreTrendWithWardrobe (Phase 11 - Phase 5 Wardrobe Exploration)
// ============================================================================
export interface ExploreTrendWithWardrobeInput {
  trendId: string;
  occasion?: Occasion;
}

export const exploreTrendWithWardrobeTool: SaathiTool<ExploreTrendWithWardrobeInput, DomainResultReference> = {
  name: 'exploreTrendWithWardrobe',
  description: 'Generates wardrobe outfit recommendations that style a specific curated trend.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const refDateStr = new Date(context.referenceTimestamp).toISOString().split('T')[0];
    const trend = getBundledTrendById(input.trendId);
    if (!trend) {
      return {
        type: 'ERROR',
        summary: `Trend with ID "${input.trendId}" was not found in the curated catalog.`,
      };
    }

    const styleProfile = getSafeStyleProfile(context);
    const result = exploreTrendWithWardrobe(
      trend,
      context.wardrobe,
      styleProfile,
      context.weatherSnapshot?.weather || context.weather || undefined,
      context.culturalSignals,
      refDateStr,
      input.occasion
    );

    if (result.outfits.length === 0) {
      return {
        type: 'RECOMMENDATION',
        summary: `No complete outfits could be generated with your current clean wardrobe for "${trend.concept.name}".`,
        outfits: [],
        missingRequirements: result.missingRequirements,
      };
    }

    return {
      type: 'RECOMMENDATION',
      summary: `Generated ${result.outfits.length} outfit recommendations exploring "${trend.concept.name}".`,
      outfits: result.outfits,
      missingRequirements: result.missingRequirements,
    };
  },
};

// ============================================================================
// 15. TOOL: explainTrend (Phase 11 - Transparent Trend Telemetry & Provenance)
// ============================================================================
export interface ExplainTrendInput {
  trendId: string;
}

export const explainTrendTool: SaathiTool<ExplainTrendInput, DomainResultReference> = {
  name: 'explainTrend',
  description: 'Explains provenance, editorial corroboration, evidence dimensions, and limitations for a trend.',
  isMutation: false,
  requiresConfirmation: false,
  async execute(input, context) {
    const refDateStr = new Date(context.referenceTimestamp).toISOString().split('T')[0];
    const trend = getBundledTrendById(input.trendId);
    if (!trend) {
      return {
        type: 'ERROR',
        summary: `Trend with ID "${input.trendId}" was not found in the curated catalog.`,
      };
    }

    const styleProfile = getSafeStyleProfile(context);
    const wearEvents = getNormalizedWearEvents(context);
    const analytics = computeWearAnalytics(context.wardrobe, wearEvents, context.referenceTimestamp);
    const dormantItems = analytics.dormantItems.map((d) => d.item);

    const evidence = evaluateTrendEvidence(
      trend,
      context.wardrobe,
      styleProfile,
      context.weatherSnapshot?.weather || context.weather || undefined,
      context.culturalSignals,
      dormantItems,
      refDateStr
    );

    return {
      type: 'TREND_INTELLIGENCE',
      summary: `Provenance, corroboration, and evidence details for "${trend.concept.name}".`,
      data: {
        trendId: trend.concept.id,
        trendName: trend.concept.name,
        provenance: evidence.provenance,
        corroboration: evidence.temporalFreshness.corroboratingSignalsCount,
        evidenceDimensions: {
          provenanceAndTrust: evidence.provenanceAndTrust,
          temporalFreshness: evidence.temporalFreshness,
          wardrobeCoverage: evidence.wardrobeCoverage,
          personalStyleAlignment: evidence.personalStyleAlignment,
          culturalModestyContext: evidence.culturalModestyContext,
          contextThermalFit: evidence.contextThermalFit,
          rotationOpportunity: evidence.rotationOpportunity,
        },
        limitations: evidence.limitations,
      },
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
  getRelevantTrends: getRelevantTrendsTool,
  exploreTrendWithWardrobe: exploreTrendWithWardrobeTool,
  explainTrend: explainTrendTool,
};

export const saathiToolRegistry = new Map<string, SaathiTool<any, any>>(
  Object.entries(SAATHI_TOOLS)
);
