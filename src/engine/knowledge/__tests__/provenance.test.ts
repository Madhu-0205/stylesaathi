import { describe, it, expect } from 'vitest';
import {
  GARMENT_CONCEPTS,
  ENSEMBLE_STRUCTURES,
  FABRIC_CONCEPTS,
  PATTERN_CONCEPTS,
  REGIONAL_TRADITIONS,
  FESTIVAL_CONTEXT_RULES,
} from '../knowledgeData';
import { KnowledgeProvenance } from '../types';

function validateProvenance(provenance?: KnowledgeProvenance, contextName?: string) {
  expect(provenance, `Missing provenance for ${contextName}`).toBeDefined();
  expect(
    ['repository', 'internal_curation', 'unknown', 'primary_source', 'secondary_source', 'expert_review'].includes(
      provenance!.sourceType as string
    ),
    `Invalid sourceType for ${contextName}: ${provenance!.sourceType}`
  ).toBe(true);

  expect(provenance!.confidence).toBeGreaterThanOrEqual(0.0);
  expect(provenance!.confidence).toBeLessThanOrEqual(1.0);
  expect(typeof provenance!.reviewed).toBe('boolean');

  // Verify no fabricated external URLs or fake institutional citations
  if (provenance!.sourceReference) {
    expect(provenance!.sourceReference).not.toMatch(/^https?:\/\//i);
    expect(provenance!.sourceReference).not.toMatch(/nift|craft_council/i);
  }
}

describe('IFKG Provenance & Evidence Verification', () => {
  it('validates provenance on all canonical Garment Concepts', () => {
    for (const [sub, concept] of Object.entries(GARMENT_CONCEPTS)) {
      validateProvenance(concept.provenance, `GarmentConcept(${sub})`);
    }
  });

  it('validates provenance on all Ensemble Structures', () => {
    for (const ensemble of ENSEMBLE_STRUCTURES) {
      validateProvenance(ensemble.provenance, `EnsembleStructure(${ensemble.id})`);
    }
  });

  it('validates provenance on all Fabric Concepts', () => {
    for (const [fabric, concept] of Object.entries(FABRIC_CONCEPTS)) {
      validateProvenance(concept.provenance, `FabricConcept(${fabric})`);
    }
  });

  it('validates provenance on all Pattern Concepts', () => {
    for (const [pattern, concept] of Object.entries(PATTERN_CONCEPTS)) {
      validateProvenance(concept.provenance, `PatternConcept(${pattern})`);
    }
  });

  it('validates provenance on all Regional Traditions', () => {
    for (const [zone, tradition] of Object.entries(REGIONAL_TRADITIONS)) {
      validateProvenance(tradition.provenance, `RegionalTradition(${zone})`);
    }
  });

  it('validates provenance on all Festival Context Rules', () => {
    for (const [festival, rule] of Object.entries(FESTIVAL_CONTEXT_RULES)) {
      validateProvenance(rule.provenance, `FestivalRule(${festival})`);
    }
  });
});
