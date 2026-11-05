import { describe, it, expect } from 'vitest';
import { buildEnsembleGraph, getStructuralRoleWeight, inferSlotRole } from '../ensembleGraph';
import { ENSEMBLE_FIXTURE_ITEMS } from '../evaluation/ensembleDataset';

describe('StyleSaathi 3.0 — Ensemble Graph Architecture', () => {
  it('correctly assigns structural role weights based on garment relationship type', () => {
    expect(getStructuralRoleWeight('top_bottom')).toBe(1.0);
    expect(getStructuralRoleWeight('ethnic_drape_base')).toBe(1.0);
    expect(getStructuralRoleWeight('top_outerwear')).toBe(0.8);
    expect(getStructuralRoleWeight('bottom_footwear')).toBe(0.7);
    expect(getStructuralRoleWeight('accessory_garment')).toBe(0.35);
  });

  it('infers accurate slot roles for diverse wardrobe categories', () => {
    expect(inferSlotRole(ENSEMBLE_FIXTURE_ITEMS.kanjivaramSareeRed)).toBe('dress');
    expect(inferSlotRole(ENSEMBLE_FIXTURE_ITEMS.silkBlouseGold)).toBe('top');
    expect(inferSlotRole(ENSEMBLE_FIXTURE_ITEMS.mustardKurtiCotton)).toBe('top');
    expect(inferSlotRole(ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans)).toBe('bottom');
    expect(inferSlotRole(ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer)).toBe('layer');
    expect(inferSlotRole(ENSEMBLE_FIXTURE_ITEMS.whiteSneakers)).toBe('footwear');
    expect(inferSlotRole(ENSEMBLE_FIXTURE_ITEMS.yellowChiffonDupatta)).toBe('dupatta');
  });

  it('builds a complete undirected graph for a 3-piece outfit (3 nodes, 3 edges, density 1.0)', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.basicWhiteTee,
      ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans,
      ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ];

    const graph = buildEnsembleGraph(pieces, { occasion: 'everyday' });

    expect(graph.nodeCount).toBe(3);
    expect(graph.edgeCount).toBe(3);
    expect(graph.density).toBe(1.0);
    expect(graph.hasHardIncompatibility).toBe(false);
    expect(graph.averagePairwiseScore).toBeGreaterThan(7.0);
    expect(graph.weightedPairwiseScore).toBeGreaterThan(7.0);
    expect(graph.minimumPairwiseScore).toBeGreaterThan(6.0);
  });

  it('builds a complete undirected graph for a 4-piece layered outfit (4 nodes, 6 edges)', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer,
      ENSEMBLE_FIXTURE_ITEMS.linenShirtWhite,
      ENSEMBLE_FIXTURE_ITEMS.tailoredTrousersNavy,
      ENSEMBLE_FIXTURE_ITEMS.oxfordFormalShoes,
    ];

    const graph = buildEnsembleGraph(pieces, { occasion: 'office' });

    expect(graph.nodeCount).toBe(4);
    expect(graph.edgeCount).toBe(6);
    expect(graph.density).toBe(1.0);
    expect(graph.hasHardIncompatibility).toBe(false);
    expect(graph.minimumPairwiseScore).toBeGreaterThan(7.0);
  });

  it('identifies weakest and strongest edges in the ensemble graph', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer,
      ENSEMBLE_FIXTURE_ITEMS.tailoredTrousersNavy,
      ENSEMBLE_FIXTURE_ITEMS.neonOrangeFlipFlops, // Clashing footwear
    ];

    const graph = buildEnsembleGraph(pieces, { occasion: 'office' });

    expect(graph.weakestEdge).toBeDefined();
    expect(graph.weakestEdge?.score).toBeLessThan(5.0);
    expect(graph.strongestEdge).toBeDefined();
    expect(graph.strongestEdge?.score).toBeGreaterThan(7.0);
  });

  it('flags hard incompatibility when an item is in laundry', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.dirtyLinenShirtInLaundry,
      ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans,
      ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ];

    const graph = buildEnsembleGraph(pieces, { allowPlanningMode: false });

    expect(graph.hasHardIncompatibility).toBe(true);
    expect(graph.hardIncompatibilityReasons.length).toBeGreaterThan(0);
    expect(graph.hardIncompatibilityReasons[0]).toContain('laundry');
  });

  it('flags hard incompatibility for duplicate items in the same ensemble', () => {
    const pieces = [
      ENSEMBLE_FIXTURE_ITEMS.basicWhiteTee,
      ENSEMBLE_FIXTURE_ITEMS.basicWhiteTee,
    ];

    const graph = buildEnsembleGraph(pieces);

    expect(graph.hasHardIncompatibility).toBe(true);
    expect(graph.hardIncompatibilityReasons[0]).toContain('Duplicate');
  });
});
