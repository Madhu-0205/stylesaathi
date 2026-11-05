import { WardrobeItem } from '../../types';
import { GarmentPairType } from './types';

// ============================================================================
// HELPER CLASSIFICATION PREDICATES
// ============================================================================

export function isTopGarment(item: WardrobeItem): boolean {
  if (item.category === 'Tops') return true;
  const sub = (item.subcategory || '').toLowerCase();
  if (
    item.category === 'Ethnic' &&
    ['kurta', 'kurti', 'anarkali', 'sherwani', 'achkan', 'angrakha', 'blouse'].includes(sub)
  ) {
    return true;
  }
  return false;
}

export function isBottomGarment(item: WardrobeItem): boolean {
  if (item.category === 'Bottoms') return true;
  const sub = (item.subcategory || '').toLowerCase();
  if (
    item.category === 'Ethnic' &&
    ['churidar', 'salwar', 'palazzo', 'pajama', 'dhoti', 'lungi', 'lehenga'].includes(sub)
  ) {
    return true;
  }
  return false;
}

export function isOuterwearGarment(item: WardrobeItem): boolean {
  if (item.category === 'Outerwear') return true;
  const sub = (item.subcategory || '').toLowerCase();
  if (['blazer', 'jacket', 'shrug', 'nehru jacket', 'coat', 'trench coat', 'cardigan'].includes(sub)) {
    return true;
  }
  // Primary ethnic upper pieces (sherwani, achkan, bandhgala) function as base tops, not secondary outerwear
  if (['sherwani', 'achkan', 'bandhgala'].includes(sub)) {
    return false;
  }
  if (item.layeringRole === 'outer') {
    return true;
  }
  return false;
}

export function isDressOrFullBody(item: WardrobeItem): boolean {
  if (item.category === 'Dresses') return true;
  const sub = (item.subcategory || '').toLowerCase();
  return ['dress', 'western dress', 'saree', 'anarkali', 'co-ord set', 'salwar set'].includes(sub);
}

export function isFootwearGarment(item: WardrobeItem): boolean {
  return item.category === 'Footwear';
}

export function isAccessoryGarment(item: WardrobeItem): boolean {
  return item.category === 'Accessories';
}

export function isEthnicDrapeOrSet(item: WardrobeItem): boolean {
  const sub = (item.subcategory || '').toLowerCase();
  return ['saree', 'blouse', 'lehenga', 'dupatta'].includes(sub);
}

// ============================================================================
// PAIR CLASSIFIER
// ============================================================================

/**
 * Classifies the relationship type between two garments.
 * The classification determines which compatibility dimensions are activated.
 */
export function classifyGarmentPair(itemA: WardrobeItem, itemB: WardrobeItem): GarmentPairType {
  const subA = (itemA.subcategory || '').toLowerCase();
  const subB = (itemB.subcategory || '').toLowerCase();

  // 1. Structural Duplicate / Layer Collision Checks
  if (itemA.id === itemB.id) {
    return 'structural_duplicate_conflict';
  }

  // Two footwear pieces
  if (isFootwearGarment(itemA) && isFootwearGarment(itemB)) {
    return 'structural_duplicate_conflict';
  }

  // Two bottoms
  if (isBottomGarment(itemA) && isBottomGarment(itemB) && subA !== 'lehenga' && subB !== 'lehenga') {
    return 'structural_duplicate_conflict';
  }

  // Two full-length dresses/sarees
  if (
    (subA === 'saree' && subB === 'saree') ||
    (subA === 'dress' && subB === 'dress') ||
    (subA === 'western dress' && subB === 'western dress')
  ) {
    return 'structural_duplicate_conflict';
  }

  // Two base tops without layering roles (e.g. two t-shirts, two kurtas, two base shirts)
  if (
    isTopGarment(itemA) &&
    isTopGarment(itemB) &&
    !isOuterwearGarment(itemA) &&
    !isOuterwearGarment(itemB) &&
    subA !== 'blouse' &&
    subB !== 'blouse'
  ) {
    return 'structural_duplicate_conflict';
  }

  // 2. Ethnic Drape & Structural Ensemble Pairs
  // Saree + Blouse / Crop Top
  if (
    (subA === 'saree' && (subB === 'blouse' || (subB === 'crop top' && itemB.formality >= 3))) ||
    (subB === 'saree' && (subA === 'blouse' || (subA === 'crop top' && itemA.formality >= 3)))
  ) {
    return 'ethnic_drape_base';
  }

  // Lehenga + Blouse / Choli / Crop Top
  if (
    (subA === 'lehenga' && ['blouse', 'crop top', 'top'].includes(subB)) ||
    (subB === 'lehenga' && ['blouse', 'crop top', 'top'].includes(subA))
  ) {
    return 'ethnic_drape_base';
  }

  // Dupatta paired with Kurta / Anarkali / Lehenga / Salwar
  if (
    (subA === 'dupatta' && ['kurta', 'anarkali', 'lehenga', 'salwar', 'kurti'].includes(subB)) ||
    (subB === 'dupatta' && ['kurta', 'anarkali', 'lehenga', 'salwar', 'kurti'].includes(subA))
  ) {
    return 'ethnic_drape_base';
  }

  // 3. Dress + Outerwear
  if (
    (isDressOrFullBody(itemA) && isOuterwearGarment(itemB)) ||
    (isDressOrFullBody(itemB) && isOuterwearGarment(itemA))
  ) {
    return 'dress_outerwear';
  }

  // 4. Top + Outerwear (or Ethnic Top + Nehru Jacket / Blazer)
  if (
    (isTopGarment(itemA) && isOuterwearGarment(itemB)) ||
    (isTopGarment(itemB) && isOuterwearGarment(itemA))
  ) {
    return 'top_outerwear';
  }

  // 5. Bottom + Outerwear
  if (
    (isBottomGarment(itemA) && isOuterwearGarment(itemB)) ||
    (isBottomGarment(itemB) && isOuterwearGarment(itemA))
  ) {
    return 'bottom_outerwear';
  }

  // 6. Top + Bottom (Western or Indo-Western or Ethnic)
  if (
    (isTopGarment(itemA) && isBottomGarment(itemB)) ||
    (isTopGarment(itemB) && isBottomGarment(itemA))
  ) {
    return 'top_bottom';
  }

  // 7. Bottom + Footwear
  if (
    (isBottomGarment(itemA) && isFootwearGarment(itemB)) ||
    (isBottomGarment(itemB) && isFootwearGarment(itemA))
  ) {
    return 'bottom_footwear';
  }

  // 8. Top + Footwear
  if (
    (isTopGarment(itemA) && isFootwearGarment(itemB)) ||
    (isTopGarment(itemB) && isFootwearGarment(itemA))
  ) {
    return 'top_footwear';
  }

  // 9. Accessory + Garment
  if (isAccessoryGarment(itemA) || isAccessoryGarment(itemB)) {
    return 'accessory_garment';
  }

  return 'unclassified_pair';
}
