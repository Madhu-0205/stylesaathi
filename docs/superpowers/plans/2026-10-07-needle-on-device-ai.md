# On-Device Needle 3 AI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Cactus Compute Needle 3 into StyleSaathi as an on-device WebAssembly intent-parsing and tool-calling layer that operates 100% locally and offline without cloud LLMs, cleanly routing structured commands into existing domain engines.

**Architecture:** A dedicated Web Worker (`needleWorker.ts`) loads the `needle-rs` WASM runtime and `needle3.cact` model weights from an IndexedDB binary cache. A main-thread service (`needleService.ts`) evaluates confidence scores, gates medium-confidence and destructive actions through a user confirmation card, and routes high-confidence intents to existing StyleSaathi domain functions (`generateOutfits`, `WardrobeContext`, `calendarRepository`).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, `needle-rs@0.3.1` (WASM), IndexedDB (`idb-keyval`), Vitest.

**Spec:** [docs/superpowers/specs/2026-10-07-stylesaathi-on-device-needle-ai-design.md](file:///Users/madhu/Downloads/stylesaathi/docs/superpowers/specs/2026-10-07-stylesaathi-on-device-needle-ai-design.md)

## Global Constraints
- Zero cloud AI/LLM network calls (no OpenAI, Gemini, or external inference APIs).
- Needle must only interpret intent and extract structured arguments; never directly access Supabase, IndexedDB repositories, auth, or perform DB mutations.
- Multi-tier confidence gating: $\ge 0.80$ execute; $0.50-0.79$ confirm; $< 0.50$ reject/clarify. Destructive commands always require confirmation.
- Preserves all 220 existing tests and zero regressions in existing local-first / sync architecture.
- Full offline operation once model weights are stored in IndexedDB.
- All Tailwind v4 class warnings standardized to clean syntax (`bg-(--background)` -> `bg-background`, etc.).

## Review Focus
1. **Offline with Internet Disconnected:** System loads model bytes from IndexedDB and completes tool calling without error or network timeout.
2. **Unsupported / Garbage Input:** Model or fallback classifies query with low confidence (< 0.50) and gracefully asks user for clarification without crashing.
3. **Ambiguous or Destructive Commands:** Queries asking to delete, remove, or reset garments/calendar entries always trigger the confirmation gate regardless of score.
4. **Occasion & Date Normalization:** Casual slang like "uni" maps cleanly to "college", "tomorrow" maps to ISO `YYYY-MM-DD`.
5. **Memory & Thread Safety:** Web Worker operations handle error events cleanly without leaking listeners or blocking UI framerate.

---

### Task 1: Package Setup & Tailwind v4 CSS Warning Normalization

**Files:**
- Modify: `package.json`
- Modify: `src/App.tsx:75`
- Modify: `src/components/auth/AuthView.tsx`
- Modify: `src/components/calendar/PlanLookModal.tsx`
- Modify: `src/components/common/BottomSheet.tsx`
- Modify: `src/components/dressme/AccessoryDrawer.tsx`
- Modify: `src/components/dressme/OutfitCard.tsx`
- Modify: `src/components/gaps/CategoryBalanceBar.tsx`
- Modify: `src/components/gaps/OccasionCoverageList.tsx`
- Modify: `src/components/navigation/BottomNav.tsx`
- Modify: `src/components/wardrobe/AddItemSheet.tsx`
- Modify: `src/components/wardrobe/ItemCard.tsx`

**Interfaces:**
- Consumes: Existing Tailwind CSS v4 variables in `src/index.css`
- Produces: `needle-rs` installed in dependencies; 0 IDE Tailwind syntax warnings

- [ ] **Step 1: Install needle-rs dependency**
Run: `npm install needle-rs@0.3.1`
Verify: `needle-rs` is added to `dependencies` in `package.json`.

- [ ] **Step 2: Clean up Tailwind CSS v4 class warnings**
In all flagged components, convert `bg-(--background)` to `bg-background`, `border-(--border)` to `border-border`, `text-(--muted)` to `text-muted`, `bg-(--card)` to `bg-card`, etc.

- [ ] **Step 3: Run typecheck and tests to ensure no regressions**
Run: `npm run typecheck && npm test`
Expected: 0 type errors, all 220 tests passing.

- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json src/
git commit -m "chore: add needle-rs dependency and standardize Tailwind v4 class syntax"
```

---

### Task 2: Core Needle Types & Protocol Definitions

**Files:**
- Create: `src/services/needle/needleTypes.ts`
- Test: `src/services/needle/__tests__/needleTypes.test.ts`

**Interfaces:**
- Consumes: `src/types.ts` (Occasion, Season, Category, Subcategory)
- Produces: `NeedleToolName`, `NeedleToolCall`, `NeedleConfidenceLevel`, `NeedleWorkerMessage`, `NeedleState`

- [ ] **Step 1: Write type contract unit test**
Create `src/services/needle/__tests__/needleTypes.test.ts` testing type guard helpers and confidence tier classification.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test src/services/needle/__tests__/needleTypes.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `needleTypes.ts`**
Define tool argument types (`RecommendOutfitArgs`, `SearchWardrobeArgs`, `RecordWearArgs`, `CreateStylePlanArgs`, `SearchStylePreferencesArgs`), worker message discriminated unions, and confidence tier helpers:
- `getConfidenceTier(score: number): 'HIGH' | 'MEDIUM' | 'LOW'`

- [ ] **Step 4: Run test to verify pass**
Run: `npm test src/services/needle/__tests__/needleTypes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/services/needle/needleTypes.ts src/services/needle/__tests__/needleTypes.test.ts
git commit -m "feat(needle): define core types and worker message contracts"
```

---

### Task 3: JSON Schemas for the 5 Initial Tools

**Files:**
- Create: `src/services/needle/needleSchemas.ts`
- Test: `src/services/needle/__tests__/needleSchemas.test.ts`

**Interfaces:**
- Consumes: `needleTypes.ts`
- Produces: `NEEDLE_TOOLS: NeedleToolDefinition[]`, `NEEDLE_TOOLS_JSON: string`

- [ ] **Step 1: Write schema validation test**
Create `src/services/needle/__tests__/needleSchemas.test.ts` verifying that `NEEDLE_TOOLS` contains exactly 5 tools (`recommend_outfit`, `search_wardrobe`, `record_wear`, `create_style_plan`, `search_style_preferences`), has valid JSON Schema parameters, valid enums matching StyleSaathi types, and serializes to valid JSON string.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test src/services/needle/__tests__/needleSchemas.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `needleSchemas.ts`**
Declare the 5 tool specifications compliant with OpenAI / Needle function calling format.

- [ ] **Step 4: Run test to verify pass**
Run: `npm test src/services/needle/__tests__/needleSchemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/services/needle/needleSchemas.ts src/services/needle/__tests__/needleSchemas.test.ts
git commit -m "feat(needle): define official JSON schemas for the 5 initial tools"
```

---

### Task 4: Tool Validation, Normalization & Safety Guards

**Files:**
- Create: `src/services/needle/needleTools.ts`
- Test: `src/services/needle/__tests__/needleTools.test.ts`

**Interfaces:**
- Consumes: `needleTypes.ts`, `needleSchemas.ts`, `src/types.ts`
- Produces: `validateAndNormalizeToolCall(raw: RawToolCall): ValidatedToolCall`, `isDestructiveAction(toolName: string, args: Record<string, unknown>): boolean`

- [ ] **Step 1: Write tool validation unit tests**
Create `src/services/needle/__tests__/needleTools.test.ts` testing:
- Valid `recommend_outfit` call extraction.
- Informal occasion normalization ("uni" -> "college", "casual party" -> "party").
- Date normalization ("today" -> current YYYY-MM-DD, "tomorrow" -> next day YYYY-MM-DD).
- Destructive operation flags (e.g., delete/clear queries).
- Missing required argument handling (downgrades confidence or returns validation error).

- [ ] **Step 2: Run test to verify failure**
Run: `npm test src/services/needle/__tests__/needleTools.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `needleTools.ts`**
Implement argument parser, enum normalizers, ISO date helpers, and destructive action safety rules.

- [ ] **Step 4: Run test to verify pass**
Run: `npm test src/services/needle/__tests__/needleTools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/services/needle/needleTools.ts src/services/needle/__tests__/needleTools.test.ts
git commit -m "feat(needle): implement tool argument validation and safety guards"
```

---

### Task 5: Web Worker Engine & IndexedDB Model Cache

**Files:**
- Create: `src/services/needle/needleWorker.ts`
- Create: `src/services/needle/needleModelCache.ts`
- Test: `src/services/needle/__tests__/needleModelCache.test.ts`

**Interfaces:**
- Consumes: `needle-rs`, `idb-keyval`, `needleSchemas.ts`
- Produces: IndexedDB weight caching functions (`getModelFromCache`, `saveModelToCache`), worker message handling loop.

- [ ] **Step 1: Write model cache tests**
Create `src/services/needle/__tests__/needleModelCache.test.ts` verifying binary storage, retrieval, cache miss behavior, and offline availability.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test src/services/needle/__tests__/needleModelCache.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `needleModelCache.ts` and `needleWorker.ts`**
- Implement IndexedDB cache manager for `needle3.cact`.
- Implement `needleWorker.ts` with WASM initialization, weight streaming with progress, `NeedleV3Wasm.run_json()` and `confidence_for()` inference calls, plus deterministic fallback matcher.

- [ ] **Step 4: Run test to verify pass**
Run: `npm test src/services/needle/__tests__/needleModelCache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/services/needle/needleModelCache.ts src/services/needle/needleWorker.ts src/services/needle/__tests__/needleModelCache.test.ts
git commit -m "feat(needle): implement model cache and web worker inference runtime"
```

---

### Task 6: NeedleService Facade & Domain Router

**Files:**
- Create: `src/services/needle/needleService.ts`
- Test: `src/services/needle/__tests__/needleService.test.ts`
- Test: `src/services/needle/__tests__/needleConfidence.test.ts`

**Interfaces:**
- Consumes: `needleWorker.ts`, `needleTools.ts`, `src/engine/outfitEngine.ts`
- Produces: `NeedleService`, `needleService` singleton instance

- [ ] **Step 1: Write service and confidence gating tests**
Create `src/services/needle/__tests__/needleConfidence.test.ts` and `needleService.test.ts`:
- High confidence (≥0.80): executes tool call and returns domain result.
- Medium confidence (0.50–0.79): returns `pending_confirmation` with actionable description.
- Low confidence (<0.50): returns `rejected` with clarification request.
- Destructive commands: always returns `pending_confirmation` regardless of score.
- Confirm and cancel pending action methods.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test src/services/needle/__tests__/needleConfidence.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `needleService.ts`**
Implement state machine, worker coordinator, confidence gating, and domain execution router mapping approved tool calls to `generateOutfits`, wardrobe filter, and calendar plans.

- [ ] **Step 4: Run test to verify pass**
Run: `npm test src/services/needle/__tests__/needleConfidence.test.ts && npm test src/services/needle/__tests__/needleService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/services/needle/needleService.ts src/services/needle/__tests__/
git commit -m "feat(needle): implement NeedleService facade with confidence gating"
```

---

### Task 7: Editorial Luxury UI Components

**Files:**
- Create: `src/components/needle/NeedleCommandBar.tsx`
- Create: `src/components/needle/NeedleConfirmationModal.tsx`
- Test: `src/components/needle/__tests__/NeedleCommandBar.test.tsx`

**Interfaces:**
- Consumes: `needleService.ts`, `WardrobeContext`
- Produces: Editorial command bar, mobile floating pill, and confirmation modal

- [ ] **Step 1: Write component tests**
Create `src/components/needle/__tests__/NeedleCommandBar.test.tsx` testing input submission, loading state, shortcut trigger (`⌘K`), and rendering results.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test src/components/needle/__tests__/NeedleCommandBar.test.tsx`
Expected: FAIL (components not found).

- [ ] **Step 3: Implement `NeedleCommandBar.tsx` and `NeedleConfirmationModal.tsx`**
Build editorial search bar with burgundy/gold accents, subtle micro-animations, clear progress indicator, and confirmation modal.

- [ ] **Step 4: Run test to verify pass**
Run: `npm test src/components/needle/__tests__/NeedleCommandBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/needle/ src/components/needle/__tests__/
git commit -m "feat(needle): create editorial command bar and confirmation modal"
```

---

### Task 8: App & Navigation Integration

**Files:**
- Modify: `src/components/navigation/TopNav.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `NeedleCommandBar`, `NeedleConfirmationModal`, `needleService`
- Produces: Integrated top command bar on desktop, floating trigger on mobile, seamless navigation to `Dress` tab on outfit recommendation.

- [ ] **Step 1: Integrate into `TopNav.tsx` and `App.tsx`**
Mount `NeedleCommandBar` in `TopNav` desktop bar and as an editorial mobile pill. Wire recommendation results to switch tab to `Dress` and focus generated outfit.

- [ ] **Step 2: Run typecheck and existing user flow tests**
Run: `npm run typecheck && npm test src/__tests__/appFlows.test.ts`
Expected: PASS with 0 type errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/navigation/TopNav.tsx src/App.tsx
git commit -m "feat(needle): integrate command bar into TopNav and App navigation"
```

---

### Task 9: Complete Offline E2E Verification Test

**Files:**
- Create: `src/services/needle/__tests__/needleOfflineFlow.test.ts`

**Interfaces:**
- Consumes: `needleService`, `sampleWardrobe`, `generateOutfits`
- Produces: Verified offline flow test: `Internet OFF` -> `"Show me something casual for college."` -> Needle runs locally -> `recommend_outfit` tool call -> outfit results generated.

- [ ] **Step 1: Implement `needleOfflineFlow.test.ts`**
Simulate offline environment (`navigator.onLine = false`, blocked network fetch). Dispatch `"Show me something casual for college."`. Assert tool call `{ name: 'recommend_outfit', arguments: { occasion: 'college', style: 'casual' } }`, score $\ge 0.80$, and output outfits from `sampleWardrobe`.

- [ ] **Step 2: Run offline flow test**
Run: `npm test src/services/needle/__tests__/needleOfflineFlow.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add src/services/needle/__tests__/needleOfflineFlow.test.ts
git commit -m "test(needle): add comprehensive offline on-device flow test"
```

---

### Task 10: Full Validation & Production Build

**Files:**
- Validate all files across the repository.

- [ ] **Step 1: Run typecheck**
Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 2: Run complete test suite**
Run: `npm test`
Expected: All 220 existing tests + all new Needle tests pass (230+ total).

- [ ] **Step 3: Run production build**
Run: `npm run build`
Expected: Build succeeds cleanly with zero bundle errors.

- [ ] **Step 4: Commit any final artifacts**
```bash
git commit --allow-empty -m "build: verify clean production build with on-device Needle AI integration"
```
