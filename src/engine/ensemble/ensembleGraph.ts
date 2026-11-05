import {
  WardrobeItem,
  OutfitSlotRole,
  Occasion,
  Season,
  ContextSnapshot,
  StylePreferences,
  PersonalStyleProfile,
} from '../../types';
import { pairwiseCompatibilityEngine } from '../pairwise/pairwiseCompatibilityEngine';
import { GarmentPairType } from '../pairwise/types';
import { EnsembleEdge, EnsembleGraph, EnsembleNode } from './types';

export interface BuildGraphOptions {
  outfitId?: string;
  anchorItemId?: string;
  occasion?: Occasion;
  season?: Season;
  context?: ContextSnapshot;
  preferences?: StylePreferences;
  styleProfile?: PersonalStyleProfile;
  allowPlanningMode?: boolean;
  slotRoles?: Record<string, OutfitSlotRole>;
}

/**
 * Returns structural role weight for a pair relationship.
 * Primary structural relationships carry heavier weight in the ensemble graph.
 */
export function getStructuralRoleWeight(pairType: GarmentPairType): number {
  switch (pairType) {
    case 'top_bottom':
    case 'ethnic_drape_base':
      return 1.0;
    case 'dress_outerwear':
      return 0.85;
    case 'top_outerwear':
      return 0.8;
    case 'bottom_footwear':
      return 0.7;
    case 'bottom_outerwear':
      return 0.6;
    case 'top_footwear':
      return 0.4;
    case 'accessory_garment':
      return 0.35;
    case 'structural_duplicate_conflict':
      return 1.0;
    default:
      return 0.3;
  }
}

/**
 * Resolves an approximate slot role for a wardrobe item based on category and subcategory.
 */
export function inferSlotRole(item: WardrobeItem): OutfitSlotRole {
  const cat = item.category;
  const sub = (item.subcategory || '').toLowerCase();

  if (cat === 'Ethnic') {
    if (sub === 'saree' || sub === 'lehenga') return 'dress';
    if (sub === 'blouse' || sub === 'kurta' || sub === 'kurti' || sub === 'sherwani') return 'top';
    if (sub === 'churidar' || sub === 'salwar' || sub === 'palazzo' || sub === 'dhoti' || sub === 'lungi' || sub === 'pajama') return 'bottom';
    if (sub === 'dupatta') return 'dupatta';
    if (sub === 'nehru jacket') return 'layer';
  }

  if (cat === 'Dresses') return 'dress';
  if (cat === 'Tops') return 'top';
  if (cat === 'Bottoms') return 'bottom';
  if (cat === 'Outerwear') return 'layer';
  if (cat === 'Footwear') return 'footwear';
  if (cat === 'Accessories') {
    if (['dupatta', 'scarf', 'shawl', 'stole'].includes(sub)) return 'dupatta';
    return 'accessory';
  }

  return 'top';
}

/**
 * Constructs an EnsembleGraph from an ensemble of wardrobe garments.
 * Evaluates nodes, builds pairwise edges, and computes graph topology metrics.
 */
export function buildEnsembleGraph(
  items: WardrobeItem[],
  options: BuildGraphOptions = {}
): EnsembleGraph {
  const {
    outfitId = `graph-${items.map((i) => i.id).join('-')}`,
    anchorItemId,
    occasion,
    season,
    context,
    preferences,
    styleProfile,
    allowPlanningMode = false,
    slotRoles = {},
  } = options;

  // 1. Build Nodes
  const nodes: EnsembleNode[] = items.map((item) => {
    const isAnchor = Boolean(anchorItemId && item.id === anchorItemId);
    const role = slotRoles[item.id] || inferSlotRole(item);
    const uncertaintyNotes: string[] = [];

    const isUnverified = !item.userVerified;
    const isLowConfidence =
      typeof item.aiConfidence === 'number' && item.aiConfidence <= 0.35;
    const needsUserConf =
      (item as any).needsUserConfirmation === true || (isUnverified && isLowConfidence);

    if (needsUserConf) {
      uncertaintyNotes.push(`Item "${item.name}" has unverified AI attribute tags.`);
    }

    if (!item.fabric) {
      uncertaintyNotes.push(`Item "${item.name}" has undeclared fabric.`);
    }

    if (!item.colors || item.colors.length === 0) {
      uncertaintyNotes.push(`Item "${item.name}" has undeclared color.`);
    }

    return {
      id: item.id,
      item,
      role,
      isAnchor,
      status: item.status,
      formality: item.formality ?? 2.5,
      colors: item.colors || [],
      fabric: item.fabric,
      pattern: item.pattern,
      fit: item.fit,
      uncertaintyNotes,
      needsUserConfirmation: needsUserConf,
    };
  });

  // Check node-level cleanliness/wearability
  const hardIncompatibilityReasons: string[] = [];
  if (!allowPlanningMode) {
    for (const node of nodes) {
      if (node.status === 'in_laundry' || node.status === 'needs_washing') {
        hardIncompatibilityReasons.push(
          `Item "${node.item.name}" is unwearable (${node.status.replace('_', ' ')}).`
        );
      }
    }
  }

  // Check physical duplicate items in ensemble
  const seenIds = new Set<string>();
  for (const node of nodes) {
    if (seenIds.has(node.id)) {
      hardIncompatibilityReasons.push(`Duplicate item assigned multiple times: "${node.item.name}".`);
    }
    seenIds.add(node.id);
  }

  // 2. Build Pairwise Edges
  const edges: EnsembleEdge[] = [];
  let weightedScoreSum = 0;
  let totalWeight = 0;
  let scoreSum = 0;
  let minScore = 10.0;
  let weakestEdge: EnsembleEdge | undefined;
  let strongestEdge: EnsembleEdge | undefined;
  let maxScore = -1.0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const itemA = items[i];
      const itemB = items[j];

      const pairResult = pairwiseCompatibilityEngine.evaluate(itemA, itemB, {
        occasion,
        season,
        context,
        preferences,
        styleProfile,
        allowPlanningMode,
      });

      const roleWeight = getStructuralRoleWeight(pairResult.pairType);
      const edgeScore = pairResult.overallScore;

      if (pairResult.isHardIncompatible) {
        hardIncompatibilityReasons.push(
          pairResult.hardIncompatibilityReason ||
            `Incompatibility between "${itemA.name}" and "${itemB.name}".`
        );
      }

      const edge: EnsembleEdge = {
        sourceId: itemA.id,
        targetId: itemB.id,
        pairType: pairResult.pairType,
        roleWeight,
        pairwiseResult: pairResult,
        score: edgeScore,
        isHardIncompatible: pairResult.isHardIncompatible,
        clashReason: pairResult.isHardIncompatible
          ? pairResult.hardIncompatibilityReason
          : edgeScore < 5.0
          ? pairResult.explanations[0]
          : undefined,
        explanations: pairResult.explanations,
      };

      edges.push(edge);

      scoreSum += edgeScore;
      weightedScoreSum += edgeScore * roleWeight;
      totalWeight += roleWeight;

      if (edgeScore < minScore) {
        minScore = edgeScore;
        weakestEdge = edge;
      }
      if (edgeScore > maxScore) {
        maxScore = edgeScore;
        strongestEdge = edge;
      }
    }
  }

  const edgeCount = edges.length;
  const nodeCount = nodes.length;
  const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
  const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 1.0;
  const averagePairwiseScore = edgeCount > 0 ? scoreSum / edgeCount : 5.0;
  const weightedPairwiseScore = totalWeight > 0 ? weightedScoreSum / totalWeight : 5.0;
  const minimumPairwiseScore = edgeCount > 0 ? minScore : 5.0;
  const hasHardIncompatibility = hardIncompatibilityReasons.length > 0;

  return {
    outfitId,
    nodes,
    edges,
    nodeCount,
    edgeCount,
    density,
    averagePairwiseScore,
    weightedPairwiseScore,
    minimumPairwiseScore,
    hasHardIncompatibility,
    hardIncompatibilityReasons,
    weakestEdge,
    strongestEdge,
  };
}
