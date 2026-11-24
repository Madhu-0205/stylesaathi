# StyleSaathi — Phase 1.3.1: Smart Buy Gap Classification Regression Fix Report

**Date:** 2026-11-14  
**Author:** AI Fashion Engineering Team  
**Status:** Complete, Grounded & Verified  
**Harness / Test Environment:** Vitest v5.0.3, TypeScript 5.8 (Strict), Vite v8.3.2  

---

## 1. Executive Summary & Root Cause Analysis

During the Phase 1.3 Verification Closure Gate (`docs/product/STYLESAATHI_PHASE_1_3_VERIFICATION_CLOSURE.md`), an audit of test assertions revealed that two assertions in `src/__tests__/adversarialTrustPhase121.test.ts` (lines 270 and 317) had been broadened from:
```typescript
expect(shoeGap?.gapState).toBe('CRITICAL_GAP');
```
to:
```typescript
expect(['CRITICAL_GAP', 'OBSERVED_GAP']).toContain(shoeGap?.gapState);
```

### 1.1 Forensic Execution Trace for Zero-Footwear Wardrobe
In `src/engine/smartBuy/smartBuyEngine.ts`:
1. **Active Occasion Detection:** When `stylePreferences` is provided (e.g. `DEFAULT_STYLE_PREFERENCES`), `extractActiveOccasions` identifies active routine occasions (e.g. `'everyday'`).
2. **Occasion Coverage Audit:** `auditOccasionCoverage` evaluates templates for active occasions. Because the wardrobe contains 0 footwear items, slot failures are reported for the `footwear` role.
3. **Detected Gap Generation:** `detectWardrobeGaps` groups slot failures. In the absence of an upcoming scheduled calendar event (e.g. `outfitPlans: []`), line 214 of `gapDetectionEngine.ts` classifies the shortage as:
   - `gapState: 'OBSERVED_GAP'`
   - `severityScore: 0.8`
   - `purchaseAssessment: 'PURCHASE_JUSTIFIED'`
4. **Physical Gap Generation:** Earlier in `smartBuyEngine.ts` (lines 95–167), physical inventory is audited directly. Finding `!hasFootwear && wardrobe.length > 0`, `physicalGaps` generates:
   - `gapState: 'CRITICAL_GAP'`
   - `severityScore: 0.9`
   - `purchaseAssessment: 'PURCHASE_JUSTIFIED'`
5. **Deduplication Flaw:** Prior to Phase 1.3.1, `smartBuyEngine.ts` merged `detectedGaps` and `physicalGaps` via:
   ```typescript
   // DEFECTIVE DEDUPLICATION:
   const gaps: WardrobeGap[] = [...detectedGaps];
   for (const pGap of physicalGaps) {
     const alreadyPresent = gaps.some(
       (g) => g.expectedCategory === pGap.expectedCategory && g.targetRole === pGap.targetRole
     );
     if (!alreadyPresent) {
       gaps.unshift(pGap);
     }
   }
   ```
   Because `detectedGaps` already held an entry for `(Footwear, footwear)`, `alreadyPresent` evaluated to `true`. As a consequence, the `CRITICAL_GAP` from `physicalGaps` was discarded, and the weaker `OBSERVED_GAP` was retained.

---

## 2. Implementation: Severity-Preserving Deduplication

In `src/engine/smartBuy/smartBuyEngine.ts`, the deduplication logic was upgraded to enforce severity precedence while maintaining clean deduplication:

```typescript
  // Combine detected and physical gaps with severity-preserving deduplication
  const gaps: WardrobeGap[] = [...detectedGaps];
  for (const pGap of physicalGaps) {
    const existingIndex = gaps.findIndex(
      (g) => g.expectedCategory === pGap.expectedCategory && g.targetRole === pGap.targetRole
    );
    if (existingIndex === -1) {
      gaps.unshift(pGap);
    } else {
      const existing = gaps[existingIndex];
      // A physical gap representing 0 owned essential items must take precedence over weaker observed gaps
      if (existing.gapState !== 'CRITICAL_GAP' || pGap.severityScore > existing.severityScore) {
        gaps[existingIndex] = {
          ...existing,
          ...pGap,
          attributeGuidance: existing.attributeGuidance || pGap.attributeGuidance,
          activeOccasions: existing.activeOccasions.length > 0 ? existing.activeOccasions : pGap.activeOccasions,
          evidence: [
            ...pGap.evidence,
            ...existing.evidence.filter((e) => !pGap.evidence.some((pe) => pe.tier === e.tier)),
          ],
        };
      }
    }
  }
```

### Architectural Guarantees Established:
1. **Critical Physical Inventory Priority:** Missing an entire essential category (0 footwear, 0 bottoms, 0 tops) strictly registers as `CRITICAL_GAP` with its established critical severity score (`0.9` for footwear, `1.0` for bottoms/tops).
2. **No Entry Duplication:** The existing gap entry is updated in-place (`gaps[existingIndex]`), guaranteeing that exactly one gap record is emitted per category.
3. **Context Retention:** Personalized attribute guidance and occasion tags from `existing` are preserved and merged with the physical gap evidence.
4. **Preservation of Non-Critical Gaps:** When items exist in the category but are unwashed or dormant, `physicalGaps` produces no entry. Non-critical states (`REDISCOVERY_SUGGESTED`, laundry shortages) are never improperly escalated.

---

## 3. Restoration of Strict Regression Assertions

The strict Phase 1.2.1 assertions were restored in `src/__tests__/adversarialTrustPhase121.test.ts`:

- **Line 270 (Scenario: 0 footwear with 0 wear count):**
  ```typescript
  expect(shoeGap).toBeDefined();
  expect(shoeGap?.gapState).toBe('CRITICAL_GAP');
  expect(shoeGap?.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
  ```
- **Line 317 (Scenario: user budget constraints permitting only essential gaps):**
  ```typescript
  expect(shoeGap).toBeDefined();
  expect(shoeGap?.gapState).toBe('CRITICAL_GAP');
  expect(shoeGap?.purchaseAssessment).toBe('PURCHASE_JUSTIFIED');
  ```

---

## 4. Verification & Regression Metrics

All test commands were executed against the modified engine and test suites.

### 4.1 Focused Smart Buy Suites
- **Command:**
  ```bash
  npx vitest run src/engine/smartBuy/__tests__/gapDetectionEngine.test.ts src/engine/smartBuy/__tests__/coverageAuditor.test.ts src/__tests__/coreTrustPhase12.test.ts
  ```
- **Result:** `3 passed (3)` — **33 tests passed, 0 failed, 0 skipped** (Exit code: 0).

### 4.2 Adversarial Trust Tests (Phase 1.2.1)
- **Command:**
  ```bash
  npx vitest run src/__tests__/adversarialTrustPhase121.test.ts
  ```
- **Result:** `1 passed (1)` — **17 tests passed, 0 failed, 0 skipped** (Exit code: 0).
  - Strictly asserts `shoeGap?.gapState === 'CRITICAL_GAP'` in both test cases.

### 4.3 Conversational Saathi Tests (Phase 1.3)
- **Command:**
  ```bash
  npx vitest run src/__tests__/conversationalSaathiPhase13.test.ts
  ```
- **Result:** `1 passed (1)` — **60 tests passed, 0 failed, 0 skipped** (Exit code: 0).

### 4.4 Full Repository Test Suite
- **Command:**
  ```bash
  npm test
  ```
- **Result:**
  - **Test Files:** 139 passed, 1 skipped (`worker/tests/cloudflareRuntime.test.ts`), 0 failed (140 total).
  - **Tests:** 1,463 passed, 28 skipped, 0 failed (1,491 total).
  - **Exit Code:** 0.

### 4.5 TypeScript Strict Compilation Check
- **Command:**
  ```bash
  npx tsc --noEmit -p tsconfig.app.json
  ```
- **Result:** Clean, 0 errors (Exit code: 0).

### 4.6 Production Build
- **Command:**
  ```bash
  npm run build
  ```
- **Result:** Built in 1.39s, zero errors (Exit code: 0).

---

## 5. Summary of Files Changed in Phase 1.3.1

| File Path | Nature of Change |
| :--- | :--- |
| `src/engine/smartBuy/smartBuyEngine.ts` | Upgraded deduplication loop to enforce severity precedence (`CRITICAL_GAP` over `OBSERVED_GAP`) without duplicate entries. |
| `src/__tests__/adversarialTrustPhase121.test.ts` | Restored strict `expect(shoeGap?.gapState).toBe('CRITICAL_GAP');` at lines 270 and 317. |
| `docs/product/STYLESAATHI_PHASE_1_3_1_SMART_BUY_REGRESSION_FIX.md` | Verification and architecture documentation for this remediation phase. |

---

## 6. Status & Handoff

Phase 1.3.1 remediation is complete, passing all strict regression and full-suite criteria. All working-tree changes across all phases remain preserved.

Execution is paused here awaiting user approval before starting Phase 1.4.

