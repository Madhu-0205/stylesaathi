import { describe, it, expect } from 'vitest';
import { FashionEvaluationHarness, getOutfitPieces } from '../evaluationHarness';
import { FASHION_ACCURACY_EVALUATION_DATASET } from '../datasets/fashionAccuracyDataset';

describe('StyleSaathi Phase G — Fashion Accuracy & Recommendation Evaluation Harness', () => {
  const harness = new FashionEvaluationHarness(FASHION_ACCURACY_EVALUATION_DATASET);
  const report = harness.runAll();

  // Print summary report
  console.log('\n================================================================================');
  console.log('       STYLESAATHI PHASE G — FASHION ACCURACY & REAL-WORLD EVALUATION REPORT     ');
  console.log('================================================================================');
  console.log(`Total Cases Evaluated:       ${report.totalCases}`);
  console.log(`Passed Cases:                ${report.passedCases}`);
  console.log(`Failed Cases:                ${report.failedCases}`);
  console.log(`Overall Pass Rate:           ${report.overallPassRate}%`);
  console.log(`Hard Constraint Violations:  ${report.hardConstraintViolationRate}% (Target: 0.0%)`);
  console.log(`Wardrobe Item Validity:      ${report.wardrobeValidityRate}% (Target: 100.0%)`);
  console.log('--------------------------------------------------------------------------------');
  console.log('Category Breakdown:');
  for (const [cat, summary] of Object.entries(report.categoryBreakdown)) {
    console.log(
      `  - ${cat.padEnd(30)}: ${summary.passed}/${summary.total} (${summary.passRate.toFixed(1)}%) | Hard Violations: ${summary.hardConstraintViolations}`
    );
  }
  console.log('================================================================================\n');

  it('evaluates all 30 deterministic test cases with zero overall failures', () => {
    expect(report.totalCases).toBe(30);
    if (report.failedCases > 0) {
      const failures = report.caseResults
        .filter((r) => !r.passed)
        .map((r) => `${r.caseId} (${r.caseName}):\n  - ${r.violations.join('\n  - ')}`)
        .join('\n\n');
      expect.fail(`Failed ${report.failedCases} test cases:\n\n${failures}`);
    }
    expect(report.failedCases).toBe(0);
    expect(report.overallPassRate).toBe(100);
  });

  it('guarantees 0.0% hard constraint violation rate across all generated outfits', () => {
    expect(report.hardConstraintViolationRate).toBe(0.0);
  });

  it('guarantees 100.0% wardrobe inventory grounding (zero hallucinated items)', () => {
    expect(report.wardrobeValidityRate).toBe(100.0);
  });

  it('verifies teen safety safeguards for ages 14-17 in school contexts without body-shaming', () => {
    const schoolCase = report.caseResults.find((r) => r.caseId === 'case-07-teen-girl-school-safeguard');
    expect(schoolCase).toBeDefined();
    expect(schoolCase?.passed).toBe(true);
    expect(schoolCase?.topOutfit).toBeDefined();

    // Verify top outfit does not contain crop top or shorts
    const schoolPieces = getOutfitPieces(schoolCase!.topOutfit!);
    const subs = schoolPieces.map((p) => p.subcategory?.toLowerCase() || '');
    expect(subs).not.toContain('crop top');
    expect(subs).not.toContain('shorts');

    // Verify explanation contains non-judgmental age-appropriate safeguard notes
    const reasons = schoolCase!.topOutfit!.explanation?.reasons || [];
    const assumptions = schoolCase!.topOutfit!.explanation?.assumptions || [];
    const text = [...reasons, ...assumptions].join(' ');
    expect(text).toMatch(/teen|age-appropriate|safeguard|campus/i);
    expect(text).not.toMatch(/immodest|inappropriate body|revealing|shame/i);
  });

  it('verifies climate hazard protection blocking delicate silk in active torrential downpours', () => {
    const delugeCase = report.caseResults.find((r) => r.caseId === 'case-14-delicate-silk-monsoon-deluge-hazard');
    expect(delugeCase).toBeDefined();
    expect(delugeCase?.passed).toBe(true);
    expect(delugeCase?.topOutfit).toBeDefined();

    const delugePieces = getOutfitPieces(delugeCase!.topOutfit!);
    const fabrics = delugePieces.map((p) => p.fabric?.toLowerCase());
    expect(fabrics).not.toContain('silk');
    expect(fabrics).not.toContain('suede');
  });

  it('verifies cultural and devotional decorum during sacred puja rituals', () => {
    const pujaCase = report.caseResults.find((r) => r.caseId === 'case-12-women-puja-auspicious-decorum');
    expect(pujaCase).toBeDefined();
    expect(pujaCase?.passed).toBe(true);
    expect(pujaCase?.topOutfit).toBeDefined();

    const pujaPieces = getOutfitPieces(pujaCase!.topOutfit!);
    const colors = pujaPieces.flatMap((p) => p.colors);
    expect(colors).not.toContain('black');
  });

  it('verifies executive interview formality standards and architectural tailoring', () => {
    const interviewCase = report.caseResults.find((r) => r.caseId === 'case-10-men-corporate-interview-bandhgala');
    expect(interviewCase).toBeDefined();
    expect(interviewCase?.passed).toBe(true);
    expect(interviewCase?.topOutfit).toBeDefined();

    const interviewPieces = getOutfitPieces(interviewCase!.topOutfit!);
    const avgFormality =
      interviewPieces.reduce((sum, p) => sum + p.formality, 0) /
      interviewPieces.length;
    expect(avgFormality).toBeGreaterThanOrEqual(4.5);
    expect(['Bandhgala look', 'Tailored Western']).toContain(interviewCase!.topOutfit!.template);
  });

  it('verifies structural integrity when wardrobe lacks essential components (saree missing blouse)', () => {
    const incompleteCase = report.caseResults.find((r) => r.caseId === 'case-20-incomplete-wardrobe-saree-missing-blouse');
    expect(incompleteCase).toBeDefined();
    expect(incompleteCase?.passed).toBe(true);
    expect(incompleteCase?.totalOutfitsGenerated).toBe(0);
  });

  it('verifies user-controlled preference overrides: fabric sensitivity (wool allergy)', () => {
    const allergyCase = report.caseResults.find((r) => r.caseId === 'case-22-fabric-sensitivity-wool-allergy');
    expect(allergyCase).toBeDefined();
    expect(allergyCase?.passed).toBe(true);
    expect(allergyCase?.topOutfit).toBeDefined();

    const allergyPieces = getOutfitPieces(allergyCase!.topOutfit!);
    const fabrics = allergyPieces.map((p) => p.fabric);
    expect(fabrics).not.toContain('wool');
  });

  it('verifies user-controlled feedback loops: disliked hoodie and preferred navy', () => {
    const feedbackCase = report.caseResults.find((r) => r.caseId === 'case-23-explicit-disliked-styles-and-color-preferences');
    expect(feedbackCase).toBeDefined();
    expect(feedbackCase?.passed).toBe(true);
    expect(feedbackCase?.topOutfit).toBeDefined();

    const feedbackPieces = getOutfitPieces(feedbackCase!.topOutfit!);
    const subs = feedbackPieces.map((p) => p.subcategory?.toLowerCase() || '');
    expect(subs).not.toContain('hoodie');

    const colors = feedbackPieces.flatMap((p) => p.colors.map((c) => c.toLowerCase()));
    expect(colors).toContain('navy');
  });

  it('verifies truth-in-AI: transparent assumptions when weather service is unavailable', () => {
    const weatherMissingCase = report.caseResults.find((r) => r.caseId === 'case-19-missing-weather-transparent-assumptions');
    expect(weatherMissingCase).toBeDefined();
    expect(weatherMissingCase?.passed).toBe(true);
    expect(weatherMissingCase?.topOutfit?.explanation?.weatherComfortRationale).toBeUndefined();
    expect(
      weatherMissingCase?.topOutfit?.explanation?.assumptions?.some((a) =>
        a.toLowerCase().includes('weather data unavailable')
      )
    ).toBe(true);
  });

  it('verifies 100% deterministic repeatability across multiple harness runs', () => {
    const secondHarness = new FashionEvaluationHarness(FASHION_ACCURACY_EVALUATION_DATASET);
    const secondReport = secondHarness.runAll();

    expect(secondReport.totalCases).toBe(report.totalCases);
    expect(secondReport.passedCases).toBe(report.passedCases);
    expect(secondReport.overallPassRate).toBe(report.overallPassRate);
    expect(secondReport.hardConstraintViolationRate).toBe(report.hardConstraintViolationRate);
    expect(secondReport.wardrobeValidityRate).toBe(report.wardrobeValidityRate);

    for (let i = 0; i < report.caseResults.length; i++) {
      const res1 = report.caseResults[i];
      const res2 = secondReport.caseResults[i];
      expect(res1.caseId).toBe(res2.caseId);
      expect(res1.passed).toBe(res2.passed);
      expect(res1.topOutfit?.id).toBe(res2.topOutfit?.id);
      expect(res1.topOutfit?.score).toBe(res2.topOutfit?.score);
    }
  });
});
