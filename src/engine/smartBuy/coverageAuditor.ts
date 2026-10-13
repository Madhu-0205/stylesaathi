import {
  Category,
  Subcategory,
  Occasion,
  OutfitSlotRole,
  WardrobeItem,
  OutfitPlan,
  StylePreferences,
} from '../../types';
import { TEMPLATES, Template } from '../outfitTemplates';
import { OccasionReadiness, CoverageSummary } from './types';

/**
 * Maps occasion to its valid structural outfit templates (matching Recommendation Engine 2.0).
 */
export function getApplicableTemplatesForOccasion(occasion: Occasion): Template[] {
  return TEMPLATES.filter((t) => {
    if (t.name === 'Indo-western') {
      return ['college', 'casual outing', 'everyday', 'date', 'travel', 'party'].includes(occasion);
    }
    if (t.name === 'Indo-western tailored') {
      return [
        'office',
        'date',
        'party',
        'college',
        'casual outing',
        'family function',
        'family gathering',
      ].includes(occasion);
    }
    if (t.name === 'Kurta & Nehru jacket') {
      return [
        'wedding guest',
        'celebration',
        'festive',
        'Diwali',
        'Eid',
        'family function',
        'family gathering',
        'puja',
      ].includes(occasion);
    }
    if (t.name === 'Tailored Western') {
      return [
        'office',
        'interview',
        'date',
        'party',
        'family function',
        'family gathering',
        'celebration',
      ].includes(occasion);
    }
    if (t.name === 'Lehenga ensemble') {
      return ['wedding guest', 'celebration', 'festive', 'Diwali', 'family function'].includes(occasion);
    }
    if (t.name === 'Kurta with dupatta') {
      return [
        'puja',
        'festive',
        'wedding guest',
        'celebration',
        'Diwali',
        'Eid',
        'family function',
        'family gathering',
        'office',
        'college',
        'everyday',
      ].includes(occasion);
    }
    if (t.name === 'Western dress') {
      return !['puja', 'wedding guest'].includes(occasion);
    }
    return true;
  });
}

/**
 * Checks if a wardrobe item matches a specific template slot role.
 */
export function itemMatchesSlotRole(item: WardrobeItem, slot: string, allowedCategories: string[]): boolean {
  if (slot === 'dupatta') {
    return item.category === 'Ethnic' && item.subcategory === 'dupatta';
  }
  if (slot === 'blouse') {
    return (
      (item.category === 'Ethnic' && item.subcategory === 'blouse') ||
      (item.category === 'Tops' && (item.subcategory === 'crop top' || item.subcategory === 'top'))
    );
  }
  if (slot === 'saree') {
    return item.category === 'Ethnic' && item.subcategory === 'saree';
  }
  if (slot === 'lehenga') {
    return item.category === 'Ethnic' && item.subcategory === 'lehenga';
  }
  if (slot === 'set') {
    return (
      item.category === 'Ethnic' &&
      (item.subcategory === 'salwar set' || item.subcategory === 'anarkali' || (item.subcategory as string) === 'co-ord set')
    );
  }
  if (slot === 'jacket') {
    return (
      item.category === 'Outerwear' ||
      (item.category === 'Ethnic' && item.subcategory === 'nehru jacket')
    );
  }
  if (slot === 'dress') {
    return item.category === 'Dresses';
  }
  return allowedCategories.includes(item.category);
}

/**
 * Maps template slot name to normalized OutfitSlotRole and expected Category & Subcategories.
 */
export function getSlotRoleDetails(slot: string): {
  role: OutfitSlotRole;
  category: Category;
  subcategories: Subcategory[];
} {
  switch (slot) {
    case 'top':
      return {
        role: 'top',
        category: 'Tops',
        subcategories: ['shirt', 't-shirt', 'top', 'kurta', 'crop top'],
      };
    case 'bottom':
      return {
        role: 'bottom',
        category: 'Bottoms',
        subcategories: ['jeans', 'trousers', 'palazzo', 'churidar', 'salwar', 'skirt'],
      };
    case 'footwear':
    case 'shoes':
      return {
        role: 'footwear',
        category: 'Footwear',
        subcategories: ['sneakers', 'formal shoes', 'loafers', 'flats', 'sandals', 'heels', 'juttis'],
      };
    case 'dupatta':
      return {
        role: 'dupatta',
        category: 'Ethnic',
        subcategories: ['dupatta'],
      };
    case 'blouse':
      return {
        role: 'top',
        category: 'Ethnic',
        subcategories: ['blouse', 'crop top'],
      };
    case 'saree':
    case 'lehenga':
    case 'set':
      return {
        role: 'dress',
        category: 'Ethnic',
        subcategories: ['saree', 'lehenga', 'salwar set', 'anarkali'],
      };
    case 'dress':
      return {
        role: 'dress',
        category: 'Dresses',
        subcategories: ['dress', 'western dress', 'co-ord set'],
      };
    case 'outerwear':
    case 'jacket':
    case 'layer':
      return {
        role: 'outerwear',
        category: 'Outerwear',
        subcategories: ['blazer', 'jacket', 'shrug', 'nehru jacket'],
      };
    default:
      return {
        role: 'accessory',
        category: 'Accessories',
        subcategories: ['watch', 'bag', 'belt'],
      };
  }
}

/**
 * Determines active evaluation contexts from actual available evidence.
 * Strict rule: An occasion is active ONLY if present in OutfitPlans, StylePreferences, or recent history.
 */
export function extractActiveOccasions(
  outfitPlans?: readonly OutfitPlan[],
  stylePreferences?: StylePreferences,
  customActiveOccasions?: readonly Occasion[]
): Set<Occasion> {
  const active = new Set<Occasion>();

  if (customActiveOccasions) {
    for (const occ of customActiveOccasions) active.add(occ);
  }

  if (outfitPlans) {
    for (const plan of outfitPlans) {
      if (plan.status !== 'cancelled' && plan.occasion) {
        active.add(plan.occasion);
      }
    }
  }

  if (stylePreferences) {
    const prefsAny = stylePreferences as any;
    if (Array.isArray(prefsAny.occasions)) {
      for (const occ of prefsAny.occasions) {
        active.add(occ as Occasion);
      }
    }
    if (Array.isArray(stylePreferences.preferredContexts)) {
      for (const ctx of stylePreferences.preferredContexts) {
        active.add(ctx as Occasion);
      }
    }
  }

  return active;
}

export interface OccasionSlotFailure {
  occasion: Occasion;
  templateName: string;
  missingSlot: string;
  role: OutfitSlotRole;
  expectedCategory: Category;
  subcategories: Subcategory[];
}

/**
 * Pure lightweight template slot auditor.
 * Checks required slot availability against clean inventory in < 0.2ms.
 */
export function auditOccasionCoverage(
  items: readonly WardrobeItem[],
  activeOccasions: ReadonlySet<Occasion>,
  dormantItemIds?: ReadonlySet<string>
): {
  readinessList: OccasionReadiness[];
  failures: OccasionSlotFailure[];
  coverageSummary: CoverageSummary;
} {
  const activeCleanItems = items.filter(
    (i) => i.status === 'clean' && (!dormantItemIds || !dormantItemIds.has(i.id))
  );
  const failures: OccasionSlotFailure[] = [];
  const readinessList: OccasionReadiness[] = [];

  let coveredCount = 0;
  let unsupportedActiveCount = 0;

  for (const occasion of activeOccasions) {
    const templates = getApplicableTemplatesForOccasion(occasion);
    let viableTemplateCount = 0;
    let minCombosAcrossViable = 0;
    const occasionMissingRoles = new Set<OutfitSlotRole>();

    // For each template, audit required slot availability against active clean inventory
    const templateMissingMap: { template: Template; missing: string[]; combos: number }[] = [];

    for (const template of templates) {
      const missingForTemplate: string[] = [];
      let slotCombos = 1;

      for (const [slot, allowedCategories] of Object.entries(template.required)) {
        const matchingClean = activeCleanItems.filter((i) =>
          itemMatchesSlotRole(i, slot, allowedCategories)
        );

        if (matchingClean.length === 0) {
          missingForTemplate.push(slot);
        } else {
          slotCombos *= matchingClean.length;
        }
      }

      templateMissingMap.push({
        template,
        missing: missingForTemplate,
        combos: missingForTemplate.length === 0 ? slotCombos : 0,
      });

      if (missingForTemplate.length === 0) {
        viableTemplateCount++;
        minCombosAcrossViable += slotCombos;
      }
    }

    let readiness: 'fully_ready' | 'partially_ready' | 'unsupported';
    let summaryText: string;

    if (viableTemplateCount === 0) {
      readiness = 'unsupported';
      unsupportedActiveCount++;

      // Minimum-distance to viability: identify genuine slot shortages from closest viable templates
      const minMissingCount =
        templateMissingMap.length > 0
          ? Math.min(...templateMissingMap.map((t) => t.missing.length))
          : 0;
      const bestTemplates = templateMissingMap.filter((t) => t.missing.length === minMissingCount);

      const addedSlotKeys = new Set<string>();
      for (const { template, missing } of bestTemplates) {
        for (const slot of missing) {
          const { role, category, subcategories } = getSlotRoleDetails(slot);
          occasionMissingRoles.add(role);
          const key = `${occasion}_${role}_${category}`;
          if (!addedSlotKeys.has(key)) {
            addedSlotKeys.add(key);
            failures.push({
              occasion,
              templateName: template.name,
              missingSlot: slot,
              role,
              expectedCategory: category,
              subcategories,
            });
          }
        }
      }

      const missingRolesStr = Array.from(occasionMissingRoles).join(', ');
      summaryText = `Missing required ${missingRolesStr || 'pieces'}`;
    } else if (minCombosAcrossViable <= 2) {
      readiness = 'partially_ready';
      coveredCount++;
      summaryText = `${minCombosAcrossViable} look${minCombosAcrossViable > 1 ? 's' : ''} ready`;
    } else {
      readiness = 'fully_ready';
      coveredCount++;
      summaryText = `${minCombosAcrossViable}+ looks ready ✓`;
    }

    readinessList.push({
      occasion,
      isDeclaredActive: true,
      viableOutfitCount: minCombosAcrossViable,
      readiness,
      missingRoles: Array.from(occasionMissingRoles),
      summaryText,
    });
  }

  const activeOccasionsCount = activeOccasions.size;
  const overallCoverageScore =
    activeOccasionsCount > 0 ? Math.round((coveredCount / activeOccasionsCount) * 100) / 100 : 1.0;

  const coverageSummary: CoverageSummary = {
    totalGarments: items.length,
    activeGarments: activeCleanItems.length,
    overallCoverageScore,
    occasionReadiness: readinessList,
    coveredOccasionsCount: coveredCount,
    unsupportedActiveOccasionsCount: unsupportedActiveCount,
  };

  return {
    readinessList,
    failures,
    coverageSummary,
  };
}
