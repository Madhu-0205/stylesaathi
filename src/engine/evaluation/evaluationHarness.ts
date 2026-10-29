import {
  EvaluationCase,
  CaseEvaluationResult,
  EvaluationReport,
  CategoryEvaluationSummary,
  EvaluationCategory,
} from './types';
import { FASHION_ACCURACY_EVALUATION_DATASET } from './datasets/fashionAccuracyDataset';
import { recommendOutfitsWithTelemetry } from '../recommendationEngine';
import { RecommendationRequest, WardrobeItem, StylePreferences } from '../../types';

export function getOutfitPieces(outfit: { slots: Record<string, WardrobeItem[]> }): WardrobeItem[] {
  return Object.values(outfit?.slots || {}).flat();
}

export class FashionEvaluationHarness {
  private readonly dataset: readonly EvaluationCase[];

  constructor(dataset: readonly EvaluationCase[] = FASHION_ACCURACY_EVALUATION_DATASET) {
    this.dataset = dataset;
  }

  public runCase(testCase: EvaluationCase): CaseEvaluationResult {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const violations: string[] = [];

    const request: RecommendationRequest = {
      items: testCase.wardrobe as WardrobeItem[],
      occasion: testCase.occasion,
      season: testCase.season || 'summer',
      localDate: '2026-10-29',
      preferences: {
        preferredContexts: [],
        preferredAesthetics: [],
        updatedAt: Date.now(),
        ...testCase.userPreferences,
      } as StylePreferences,
      styleProfile: testCase.styleProfile,
      context: testCase.weatherFixture,
      culturalSignals: testCase.culturalSignals,
      limit: 3,
    };

    let result;
    try {
      result = recommendOutfitsWithTelemetry(request);
    } catch (err: any) {
      const tEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return {
        caseId: testCase.id,
        caseName: testCase.name,
        category: testCase.category,
        passed: false,
        totalOutfitsGenerated: 0,
        violations: [`RecommendationEngine threw an unhandled exception: ${err.message || String(err)}`],
        wardrobeItemValidityRate: 0,
        hardConstraintPassed: false,
        culturalPlausibilityPassed: false,
        uncertaintyHandledCorrectly: false,
        confidenceCalibrated: false,
        executionTimeMs: tEnd - t0,
      };
    }

    const outfits = result.set.outfits;
    const topOutfit = outfits.length > 0 ? outfits[0] : undefined;

    // 1. Audit Wardrobe Inventory Grounding (Zero Hallucinated Items)
    const wardrobeItemMap = new Map<string, WardrobeItem>(
      testCase.wardrobe.map((item) => [item.id, item])
    );

    let totalPieceCount = 0;
    let validPieceCount = 0;

    for (const outfit of outfits) {
      const outfitPieces = getOutfitPieces(outfit);
      for (const piece of outfitPieces) {
        totalPieceCount++;
        if (wardrobeItemMap.has(piece.id)) {
          validPieceCount++;
        } else {
          violations.push(`Hallucinated item detected: Outfit contains item id "${piece.id}" not present in wardrobe.`);
        }
      }
    }

    const wardrobeItemValidityRate = totalPieceCount > 0 ? validPieceCount / totalPieceCount : 1.0;

    // 2. Audit Tier 1 Hard Constraints on All Generated Outfits
    let hardConstraintPassed = true;
    for (const outfit of outfits) {
      const outfitPieces = getOutfitPieces(outfit);

      // 2a. Status integrity (must be clean)
      for (const piece of outfitPieces) {
        if (piece.status !== 'clean') {
          hardConstraintPassed = false;
          violations.push(`Hard constraint violation: Outfit contains un-plannable item "${piece.name}" with status "${piece.status}".`);
        }
      }

      // 2b. Unique pieces
      const seenIds = new Set<string>();
      for (const piece of outfitPieces) {
        if (seenIds.has(piece.id)) {
          hardConstraintPassed = false;
          violations.push(`Duplicate item violation: Item "${piece.name}" used in multiple slots in single outfit.`);
        }
        seenIds.add(piece.id);
      }

      // 2c. Extreme climate hazard
      if (testCase.weatherFixture?.rainContext === 'active_rain') {
        const delicateSubs = ['silk', 'raw_silk', 'velvet', 'suede'];
        for (const piece of outfitPieces) {
          if (piece.fabric && delicateSubs.includes(piece.fabric.toLowerCase())) {
            hardConstraintPassed = false;
            violations.push(`Severe climate hazard violation: Delicate fabric "${piece.fabric}" on "${piece.name}" recommended during torrential deluge.`);
          }
        }
      }

      // 2d. Teen safety
      if (testCase.ageBand === 'teen_14_17' && testCase.occasion === 'school') {
        const subs = outfitPieces.map((p) => p.subcategory?.toLowerCase() || '');
        if (subs.includes('crop top') || subs.includes('shorts')) {
          hardConstraintPassed = false;
          violations.push(`Teen safety safeguard violation: Crop top or shorts recommended for school context to a 14-17 minor.`);
        }
      }

      // 2e. Declared fabric sensitivities
      if (testCase.userPreferences.fabricSensitivities) {
        for (const piece of outfitPieces) {
          if (piece.fabric && testCase.userPreferences.fabricSensitivities.includes(piece.fabric)) {
            hardConstraintPassed = false;
            violations.push(`Fabric sensitivity safeguard violation: Item "${piece.name}" contains sensitive fabric "${piece.fabric}".`);
          }
        }
      }
    }

    // 3. Audit Explicit Test Constraints
    const constraints = testCase.explicitConstraints;
    if (constraints && topOutfit) {
      const topPieces = getOutfitPieces(topOutfit);
      const topPieceIds = new Set(topPieces.map((p) => p.id));
      const topPieceSubs = topPieces.map((p) => p.subcategory?.toLowerCase() || '');

      if (constraints.mustIncludeItemIds) {
        for (const id of constraints.mustIncludeItemIds) {
          if (!topPieceIds.has(id)) {
            violations.push(`Explicit constraint unmet: Top outfit does not include required item ID "${id}".`);
          }
        }
      }

      if (constraints.mustExcludeItemIds) {
        for (const id of constraints.mustExcludeItemIds) {
          if (topPieceIds.has(id)) {
            violations.push(`Explicit constraint violated: Top outfit includes forbidden item ID "${id}".`);
          }
        }
      }

      if (constraints.forbidSubcategories) {
        for (const sub of constraints.forbidSubcategories) {
          if (topPieceSubs.includes(sub.toLowerCase())) {
            violations.push(`Explicit constraint violated: Top outfit includes forbidden subcategory "${sub}".`);
          }
        }
      }

      if (constraints.minFormality != null) {
        const avgFormality = topPieces.reduce((a, b) => a + b.formality, 0) / topPieces.length;
        if (avgFormality < constraints.minFormality) {
          violations.push(`Formality expectation unmet: Top outfit formality (${avgFormality.toFixed(1)}) is below minimum required (${constraints.minFormality}).`);
        }
      }
    }

    // 4. Expected Compatibility & Cultural Plausibility
    let culturalPlausibilityPassed = true;
    const expected = testCase.expectedCompatibility;
    if (expected) {
      if (expected.minimumCandidates != null && outfits.length < expected.minimumCandidates) {
        violations.push(`Expected candidate count unmet: Generated ${outfits.length}, expected at least ${expected.minimumCandidates}.`);
      }

      if (expected.acceptableTemplates && topOutfit) {
        if (!expected.acceptableTemplates.includes(topOutfit.template)) {
          culturalPlausibilityPassed = false;
          violations.push(`Template mismatch: Top outfit template "${topOutfit.template}" not in acceptable list [${expected.acceptableTemplates.join(', ')}].`);
        }
      }

      if (expected.expectedEvidenceSources && topOutfit?.explanation) {
        const hasEvidence = expected.expectedEvidenceSources.some((src) =>
          topOutfit.explanation?.evidenceSources.includes(src as any)
        );
        if (!hasEvidence) {
          violations.push(`Evidence grounding missing: Expected explanation to cite at least one of [${expected.expectedEvidenceSources.join(', ')}].`);
        }
      }
    }

    // Incomplete wardrobe edge case: when wardrobe cannot fill required slots (e.g. solitary saree without blouse)
    if (testCase.id === 'case-20-incomplete-wardrobe-saree-missing-blouse') {
      if (outfits.length > 0) {
        violations.push(`Structural integrity failed: Saree without blouse should have generated 0 outfits, but generated ${outfits.length}.`);
      }
    }

    // 5. Audit Uncertainty & Calibration (Truth-in-AI)
    let uncertaintyHandledCorrectly = true;
    let confidenceCalibrated = true;

    if (topOutfit?.explanation) {
      const exp = topOutfit.explanation;

      // When weather is unavailable, weather rationale MUST be omitted and assumptions declared
      if (testCase.weatherFixture?.source === 'unavailable' || !testCase.weatherFixture) {
        if (exp.weatherComfortRationale != null) {
          uncertaintyHandledCorrectly = false;
          violations.push('Truth-in-AI violation: Reported weatherComfortRationale when weather context was unavailable.');
        }
        if (!exp.assumptions?.some((a) => a.toLowerCase().includes('weather'))) {
          uncertaintyHandledCorrectly = false;
          violations.push('Truth-in-AI violation: Did not declare transparent assumption when weather was missing.');
        }
      }

      // Confidence indicator check
      if (exp.confidenceScore == null || exp.confidenceScore < 0 || exp.confidenceScore > 1.0) {
        confidenceCalibrated = false;
        violations.push(`Confidence score out of bounds: ${exp.confidenceScore}.`);
      }

      // If wardrobe item has unknown fabric or unverified, confidence must not be VERIFIED
      const hasUnverified = testCase.wardrobe.some((i) => !i.userVerified || !i.fabric);
      if (hasUnverified && exp.confidenceLevel === 'VERIFIED') {
        confidenceCalibrated = false;
        violations.push('Confidence calibration failure: Presented VERIFIED confidence when wardrobe pieces were unverified.');
      }
    }

    const tEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const passed = violations.length === 0;

    return {
      caseId: testCase.id,
      caseName: testCase.name,
      category: testCase.category,
      passed,
      totalOutfitsGenerated: outfits.length,
      topOutfit,
      violations,
      wardrobeItemValidityRate,
      hardConstraintPassed,
      culturalPlausibilityPassed,
      uncertaintyHandledCorrectly,
      confidenceCalibrated,
      executionTimeMs: Math.round((tEnd - t0) * 100) / 100,
    };
  }

  public runAll(): EvaluationReport {
    const timestamp = new Date().toISOString();
    const caseResults: CaseEvaluationResult[] = [];

    const categories: EvaluationCategory[] = [
      'traditional_indian',
      'contemporary_indo_western',
      'professional_interview',
      'campus_teen_safety',
      'festivals_ceremonies',
      'regional_traditions',
      'climate_extremes',
      'international_cross_cultural',
      'uncertainty_edge_cases',
      'preference_feedback_learning',
    ];

    const categoryStats: Record<EvaluationCategory, { total: number; passed: number; hardViolations: number }> = {
      traditional_indian: { total: 0, passed: 0, hardViolations: 0 },
      contemporary_indo_western: { total: 0, passed: 0, hardViolations: 0 },
      professional_interview: { total: 0, passed: 0, hardViolations: 0 },
      campus_teen_safety: { total: 0, passed: 0, hardViolations: 0 },
      festivals_ceremonies: { total: 0, passed: 0, hardViolations: 0 },
      regional_traditions: { total: 0, passed: 0, hardViolations: 0 },
      climate_extremes: { total: 0, passed: 0, hardViolations: 0 },
      international_cross_cultural: { total: 0, passed: 0, hardViolations: 0 },
      uncertainty_edge_cases: { total: 0, passed: 0, hardViolations: 0 },
      preference_feedback_learning: { total: 0, passed: 0, hardViolations: 0 },
    };

    let totalWardrobeValiditySum = 0;
    let totalHardConstraintViolations = 0;

    for (const testCase of this.dataset) {
      const res = this.runCase(testCase);
      caseResults.push(res);

      const catStat = categoryStats[testCase.category];
      catStat.total++;
      if (res.passed) {
        catStat.passed++;
      }
      if (!res.hardConstraintPassed) {
        catStat.hardViolations++;
        totalHardConstraintViolations++;
      }
      totalWardrobeValiditySum += res.wardrobeItemValidityRate;
    }

    const totalCases = this.dataset.length;
    const passedCases = caseResults.filter((r) => r.passed).length;
    const failedCases = totalCases - passedCases;
    const overallPassRate = totalCases > 0 ? (passedCases / totalCases) * 100 : 0;
    const hardConstraintViolationRate = totalCases > 0 ? (totalHardConstraintViolations / totalCases) * 100 : 0;
    const wardrobeValidityRate = totalCases > 0 ? (totalWardrobeValiditySum / totalCases) * 100 : 100;

    const categoryBreakdown: Record<EvaluationCategory, CategoryEvaluationSummary> = {} as any;
    for (const cat of categories) {
      const stat = categoryStats[cat];
      categoryBreakdown[cat] = {
        total: stat.total,
        passed: stat.passed,
        passRate: stat.total > 0 ? (stat.passed / stat.total) * 100 : 0,
        hardConstraintViolations: stat.hardViolations,
      };
    }

    const unresolvedKnowledgeGaps: string[] = [
      'Northeastern weaving traditions (Mekhela Sador, Naga shawl drape) currently represented via macro-zone generalizations rather than granular community rules.',
      'Regional variations in Dhoti drape styles (Kochano Pancha vs Veshti vs Dhoti-Kurta) require future draping-specific taxonomy expansions.',
      'Regional tribal textiles (Kotpad, Toda embroidery, Lambani craft) pending deeper artisan-curated knowledge entries.',
    ];

    return {
      timestamp,
      totalCases,
      passedCases,
      failedCases,
      overallPassRate: Math.round(overallPassRate * 10) / 10,
      hardConstraintViolationRate: Math.round(hardConstraintViolationRate * 10) / 10,
      wardrobeValidityRate: Math.round(wardrobeValidityRate * 10) / 10,
      categoryBreakdown,
      caseResults,
      unresolvedKnowledgeGaps,
    };
  }
}
