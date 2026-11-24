# StyleSaathi — Phase 1.1: Functional Intelligence & Experience Accuracy Audit Report

**Document ID:** `STYLESAATHI_PHASE_1_1_FUNCTIONAL_INTELLIGENCE_AUDIT`  
**Date:** November 14, 2026  
**Status:** COMPLETED AUDIT (READ-ONLY)  
**Verdict:** **FAIL** (Substantial functional inaccuracies, brittle regex parsing, multi-turn amnesia, and ungrounded purchase data identified across all 4 target subsystems)  

---

## Executive Summary

Following the implementation of Phase 1 (The Daily Style Editorial), an exhaustive, adversarial functional audit was conducted across the four core intelligence engines of StyleSaathi:
1. **The Stylist** (Dress Me, Recommendation Engine 2.0, Ensemble Graph, and Wardrobe Constraints)
2. **AI Saathi** (Fashion Intelligence Orchestration, Tool Registry, and Intent Routing)
3. **The AI Chatbot** (Multi-Turn Continuity, Entity Resolution, Anaphora, and Conversational State)
4. **Purchase / Smart Buy** (Wardrobe Gap Detection, Candidate Generation, and Decision Support)

An automated 50-scenario empirical test harness (`scratch/functional_audit_50_scenarios.ts`) was executed against the live application runtime. The audit revealed **19 distinct functional failures out of 50 scenarios (38% failure rate)**. While local-first privacy, mathematical diversification distance, and basic clean wardrobe grounding function well, major functional defects prevent StyleSaathi from delivering a trustworthy, luxury personal fashion companion experience.

---

## 1. Feature-by-Feature Architecture

```
                                  USER INTERFACE LAYER
   ┌───────────────────────┬────────────────────────┬──────────────────────┬──────────────────────┐
   │    TodayScreen.tsx    │    DressMeScreen.tsx   │ AISaathiChatView.tsx │    GapsScreen.tsx    │
   │  (Daily Editorial)    │  (Atelier & Outfits)   │  (Conversational AI) │   (Smart Buy 2.0)    │
   └───────────┬───────────┴────────────┬───────────┴──────────┬───────────┴──────────┬───────────┘
               │                        │                      │                      │
               ▼                        ▼                      ▼                      ▼
      useDressMe / Engine       useDressMe() Hook       useSaathi() Hook       useSmartBuy() Hook
               │                        │                      │                      │
               ▼                        ▼                      ▼                      ▼
   ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐ ┌────────────────────┐
   │ RecommendationEngine  │ │ RecommendationEngine  │ │ orchestrationEngine.ts│ │ smartBuyEngine.ts  │
   │ 2.0 (Candidate Pool,  │ │ 2.0 (Stratified Pool, │ │ (processSaathiTurn,   │ │ (computeWardrobe   │
   │ Pre-Rank, Hard / Soft │ │ Tier 1 Hard Checks,   │ │  toolRegistry,        │ │  Gaps, Coverage,   │
   │ Constraints, Scoring) │ │ Diversification, Role)│ │  intentParser.ts)     │ │  Sufficiency)      │
   └───────────┬───────────┘ └──────────┬────────────┘ └──────────┬────────────┘ └──────────┬─────────┘
               │                        │                         │                         │
               ▼                        ▼                         ▼                         ▼
   ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
   │                                  DATA & DOMAIN INTELLIGENCE LAYER                                │
   │  WardrobeContext · WardrobeRepository · LocalStorage · Taxonomy · HardConstraints · Needle WASM  │
   └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Subsystem Architecture Summary
1. **The Stylist (`recommendationEngine.ts`):** Pure deterministic multi-stage recommendation pipeline: Stratified Candidate Generation (Core, Freshness, Novelty, Breadth up to 350 candidates) $\to$ Tier 1 Hard Constraints (Laundry, physical compatibility, structural templates) $\to$ Multi-Dimensional Scoring (Color harmony, formality delta, pattern intelligence, personal style brain affinities, weather context, cultural decorum) $\to$ Diversification & Top-3 Role Assignment (Best Match, Alternative with $D \ge 0.35$, Explore, Underused).
2. **AI Saathi (`orchestrationEngine.ts` & `toolRegistry.ts`):** Deterministic tool-augmented orchestration engine. Executes 11 registered domain tools (`recommendOutfits`, `styleItem`, `getWardrobeItem`, `getCurrentWeather`, `getWearAnalytics`, `getStyleProfile`, `getWardrobeGaps`, `getPurchaseAssessment`, `explainFashionKnowledge`, `createPlan`, `recordWear`).
3. **AI Chatbot (`AISaathiChatView.tsx` & `intentParser.ts`):** State machine managing conversation turns, message history (capped at 50), entity merging (`mergeConversationEntities`), confirmation requests, and clarification dialogues. Dual architecture: `AISaathiChatView` uses regex/heuristic orchestration, while `NeedleCommandBar` uses a separate on-device WASM model.
4. **Purchase / Smart Buy (`smartBuyEngine.ts` & `candidates.ts`):** Dual architecture:
   - Modern *Smart Buy 2.0* evaluates data sufficiency ($N \ge 5$ items, 10 wears / 3 plans), audits occasion slot coverage, and distinguishes `NO_PURCHASE_NEEDED` (closet rediscovery) from `PURCHASE_JUSTIFIED`.
   - Legacy *useSmartBuys / candidates.ts* uses a static list of 10 hardcoded candidate items with fixed simulated prices and hardcoded pairing notes.

---

## 2. Actual Runtime Execution Paths

### Path A: Stylist (Dress Me / Atelier)
1. User enters `DressMeScreen.tsx` $\to$ invokes `useDressMe()` hook.
2. `useDressMe()` calls `recommendOutfits({ items, occasion, season, localDate, explorationSeedOffset, anchorItemId, allowPlanningMode })`.
3. `RecommendationEngine.recommend()` iterates over occasion templates (`TEMPLATES`), filters clean eligible items matching `seasonFit()`, groups combinations up to `MAX_RECOMMENDATION_CANDIDATES = 350`.
4. Evaluates `evaluateTier1HardConstraints()` $\to$ scores candidates $\to$ applies $D \ge 0.35$ diversification distance $\to$ returns `curatedOutfits.slice(0, 3)`.
5. **Execution Breakpoint Discovered:** `recommendOutfits()` returns `RecommendedOutfit[]` directly and discards `RecommendationResultWithTelemetry.set.missingRequirements`. When a wardrobe has 0 viable looks, `useDressMe()` falls back to a brittle local check (`items.filter(i => i.occasions.includes(occasion))`), falsely claiming "No pieces tagged for occasion" even when the true reason is a missing shoe or unwashed pants.

### Path B: AI Saathi
1. User enters text in `AISaathiChatView.tsx` $\to$ calls `sendMessage(text)`.
2. Invokes `processSaathiTurn(text, conversationState, toolContext)` in `orchestrationEngine.ts`.
3. Normalizes input and passes query to `parseSaathiIntent(userInput)` in `intentParser.ts`.
4. Extracts entities (occasion, color, category, subcategory, relative date) $\to$ matches intent priority waterfall.
5. If intent requires missing data, issues `ClarificationRequest`; otherwise dispatches to registered tool in `toolRegistry.ts`.
6. Formats response markdown and returns updated `SaathiConversationState`.

### Path C: Purchase / Smart Buy
1. User enters `GapsScreen.tsx` $\to$ renders `SmartBuyReportView.tsx` $\to$ calls `useSmartBuy()`.
2. Invokes `computeWardrobeGaps()` in `smartBuyEngine.ts`.
3. Checks `calculateDataSufficiency(itemCount, wearCount, planCount, activeOccasionsCount)`.
4. If `!isSufficient`, early-exits with `purchaseAssessment = 'NO_PURCHASE_NEEDED'` and generic diagnostics.
5. If sufficient, calls `detectWardrobeGaps()` $\to$ groups template slot failures $\to$ checks dormant rediscovery alternatives $\to$ returns `WardrobeGapReport`.

---

## 3. Root Causes of Inaccuracies

### Root Cause 1: Intent Waterfall Shadowing & Brittle Regex Parsing
In `intentParser.ts`, intent detection relies on an ordered `if/else if` ladder with strict, fragile regular expressions:
- **Greedy Fallback Shadowing:** Line 511 contains `/(tell me about|what is|explain|history of)\s+/i` for `GENERAL_FASHION_QUESTION`, which is positioned **above** `CHECK_WEATHER` (Line 528). Consequently, the common query `"What is the weather outside today?"` matches `what is\s+` and is routed to fashion history instead of the weather tool.
- **Overly Strict Regex Boundaries:** In `PREMIUM_UPGRADE` (Line 452), the regex requires `(make this|make.*look|look more) (premium|expensive|elevated|luxurious)`. It fails on `"Make my current outfit more elegant"` (missing "elegant") and `"I want a premium-looking casual outfit"`.
- **Adverb Fragility:** In `COLOR_PAIRING` (Line 445), `/(what|which) colou?rs? (go|work|pair) with/i` expects `pair` directly followed by `with`. Inserting an adverb (`"pair well with"`) completely breaks the match.
- **Accidental Single-Keyword Fallthrough:** When no specific verb matches, lines 606 and 636 trigger an aggressive fallback: `else if (entities.occasion) { intent = 'CLARIFICATION_RESPONSE'; }`. If a user types `"I want a premium-looking casual outfit"`, `casual` extracts as an occasion, misses the upgrade regex, and is erroneously classified as `CLARIFICATION_RESPONSE`!

### Root Cause 2: Forced Planning Mode on Dirty Anchors
In `recommendationEngine.ts` line 225:
```ts
const isPlanningMode = Boolean(
  allowPlanningMode ||
  (anchorItem && (anchorItem.status === 'needs_washing' || anchorItem.status === 'in_laundry'))
);
```
The engine forcibly overrides `isPlanningMode = true` whenever the anchor item is unwashed, ignoring `allowPlanningMode: false`. As a result, when a user in immediate daily styling (where dirty clothes must be strictly forbidden) selects an unwashed garment, the engine happily generates full outfits containing the dirty garment rather than blocking it.

### Root Cause 3: Cultural Decorum Soft-Penalty Leakage (Leather in Puja)
In `recommendationEngine.ts`, sacred Indian context rules (such as excluding animal leather during Puja / temple rituals) are evaluated as soft penalties in `culturalPairEngine.ts` unless `culturalSignals.festivalContext === 'puja'` is explicitly provided in the request context. When a user requests a look for `occasion = 'puja'`, the baseline recommendation engine scores leather shoes and juttis with a formality penalty but does NOT hard-reject them at Tier 1, allowing leather footwear to be recommended for worship.

### Root Cause 4: Conversational Anaphora & Ordinal Amnesia
In `orchestrationEngine.ts`:
- **Hardcoded Top Candidate:** Lines 856, 894, and 938 consistently hardcode `workingState.lastDomainResult?.outfits?.[0]`. If a user asks `"Schedule the second look for tomorrow"` or `"Tell me about the third look"`, the chatbot completely ignores the ordinal index and always acts on Look 1.
- **Anaphoric Disconnect:** In `resolveWardrobeGarment()` (`contextResolver.ts`), when a user asks `"What can I wear with that shirt?"`, the resolver searches the entire physical wardrobe rather than checking the pieces of the outfit recommended in the preceding turn. If the user owns multiple shirts, it prompts with an ambiguous question instead of resolving to the shirt displayed on screen.

### Root Cause 5: Data Sufficiency Gating Inverts Critical Physical Shortages
In `smartBuyEngine.ts` line 20:
```ts
const isSufficient = itemCount >= 5 && (wearCount >= 10 || planCount >= 3);
```
If a user has 15 shirts, 0 bottoms, and 0 shoes, but has only logged 1 wear event, `isSufficient` evaluates to `false`. Line 106 then executes an early return:
```ts
if (!dataSufficiency.isSufficient) {
  return { gaps: [], purchaseAssessment: 'NO_PURCHASE_NEEDED', ... };
}
```
The app confidently declares **"No purchase needed"** to a user who literally owns zero trousers! Structural impossibility (0 bottoms) is a physical fact that does not require 10 wear events to prove.

### Root Cause 6: Fabricated Product & Price Data in Legacy Catalog
In `src/data/candidates.ts`:
- Static candidate definitions contain fictitious price ranges: `₹1,200–₹2,500`, `₹1,500–₹3,500`, etc.
- Descriptions contain hallucinated compatibility claims: `"Pairs with your white tee, linen shirt, and blazers for office and dates"`, rendered even when the user owns no white tee, no linen shirt, and no blazer.
- `useSmartBuys.ts` simulates buying items from this list without verifying if the user already owns an equivalent garment in the same color and category, suggesting duplicate purchases (e.g. recommending "Blue straight-fit jeans" to a user who owns 3 pairs of blue jeans).

---

## 4. Broken or Incomplete Functionality

| Subsystem | Symptom / Issue | Severity | Code Location |
|---|---|---|---|
| **Stylist** | Unwashed anchor garments are styled even when `allowPlanningMode: false`. | **P0** | `src/engine/recommendationEngine.ts:225` |
| **Stylist** | Leather footwear is recommended for sacred `puja` occasions in baseline engine. | **P1** | `src/engine/recommendationEngine.ts:664` |
| **Stylist** | `useDressMe()` drops `missingRequirements`, producing generic/false empty state messages. | **P1** | `src/hooks/useDressMe.ts:60`, `TodayScreen.tsx` |
| **Stylist** | Stale saved outfit snapshots bypass live laundry updates when marked worn. | **P1** | `src/context/WardrobeContext.tsx:502` |
| **AI Saathi** | "What is the weather outside today?" routes to general fashion history instead of weather tool. | **P1** | `src/engine/saathi/intentParser.ts:511` |
| **AI Saathi** | "I want a premium-looking casual outfit" misclassifies as `CLARIFICATION_RESPONSE`. | **P1** | `src/engine/saathi/intentParser.ts:606` |
| **AI Saathi** | "Make my current outfit more elegant" fails with `UNKNOWN` intent. | **P2** | `src/engine/saathi/intentParser.ts:452` |
| **AI Saathi** | "Log this look as worn" fails with `UNKNOWN` intent. | **P2** | `src/engine/saathi/intentParser.ts:540` |
| **AI Saathi** | "I don't want to repeat yesterday's outfit" fails with `UNKNOWN` intent (no anti-repetition handler). | **P2** | `src/engine/saathi/intentParser.ts` |
| **Chatbot** | Follow-up references like "the second look" always hardcode Look 0. | **P1** | `src/engine/saathi/orchestrationEngine.ts:856` |
| **Chatbot** | Anaphoric references like "that shirt" fail to resolve to previous turn outfit pieces. | **P1** | `src/engine/saathi/contextResolver.ts:84` |
| **Chatbot** | User correction ("No, I meant for an interview") is hijacked by the rejection handler. | **P2** | `src/engine/saathi/orchestrationEngine.ts:127` |
| **Purchase** | Data sufficiency gate suppresses physical shortages, declaring "No purchase needed" on 0 bottoms. | **P0** | `src/engine/smartBuy/smartBuyEngine.ts:106` |
| **Purchase** | Legacy `candidates.ts` contains fabricated price ranges (`₹1,200–₹2,500`) and fake pairings. | **P1** | `src/data/candidates.ts:20` |
| **Purchase** | `useSmartBuys` suggests duplicate purchases of items already owned by the user. | **P1** | `src/hooks/useSmartBuys.ts:50` |
| **Purchase** | `assessPurchaseNeedTool` passes `{}` to gap engine, ignoring the specific garment queried by user. | **P2** | `src/engine/saathi/orchestrationEngine.ts:809` |

---

## 5. 50 Empirical Test Scenarios & Results

*Executed deterministically via `scratch/functional_audit_50_scenarios.ts`.*

### Section 1: The Stylist (15 Scenarios)

| Scenario ID | Test Name | Input / Condition | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|---|
| **S01** | Empty Wardrobe | Wardrobe `[]` | 0 outfits, graceful empty state | Returned 0 outfits, no crash | **PASS** |
| **S02** | Single Garment Incomplete | 1 White Oxford Shirt | 0 outfits, missing requirement reported | Returned 0 outfits | **PASS** |
| **S03** | Minimal Complete Outfit | 1 Top, 1 Bottom, 1 Shoe | 1 Best Match outfit with those 3 items | Returned 1 outfit with exact IDs | **PASS** |
| **S04** | All Bottoms in Laundry | Tops/Shoes clean, all bottoms `needs_washing` | 0 outfits, unwashed bottoms rejected | Returned 0 outfits | **PASS** |
| **S05** | Clean Anchor Styling | Kurta anchor specified | Anchor present in top outfit | Anchor present in Look 1 | **PASS** |
| **S06** | Dirty Anchor without Planning | Dirty kurta, `allowPlanningMode: false` | 0 outfits, dirty anchor blocked | Returned 3 outfits (Forced planning mode) | **FAIL** |
| **S07** | Micro-Accessory Anchor | Anchor = Leather Watch | 0 outfits, explanatory guidance returned | Returned 0 outfits with guidance | **PASS** |
| **S08** | Formality Compatibility | Formal shirt + casual jeans for interview | Formality penalty applied | Score penalized appropriately | **PASS** |
| **S09** | Sacred Occasion Decorum | Occasion = `puja`, wardrobe has leather | Leather excluded from puja looks | Leather included in puja looks | **FAIL** |
| **S10** | Missing Category Honesty | Tops + Footwear, 0 Bottoms | 0 outfits, no ghost garments | Returned 0 outfits | **PASS** |
| **S11** | Exploration Rotation | Shuffle with `explorationSeedOffset` | Deterministic new Explore candidate | Explore 1 $\ne$ Explore 2 | **PASS** |
| **S12** | Recency Wear Penalty | Item worn yesterday in request | Score breakdown penalty $> 0$ | Penalty applied to worn piece | **PASS** |
| **S13** | Alternative Diversification | Occasion = `office` | Alternative role has $D \ge 0.35$ | Alternative role generated | **PASS** |
| **S14** | Missing Metadata Resilience | Items with null seasons/fabrics | Engine evaluates without crash | Completed cleanly | **PASS** |
| **S15** | Saved Outfit Integrity | Outfit saved and checked | Garment IDs match real items | All IDs strictly referential | **PASS** |

### Section 2: AI Saathi (15 Scenarios)

| Scenario ID | Test Name | Query String | Expected Intent | Actual Intent | Result |
|---|---|---|---|---|---|
| **A01** | College Outfit Tomorrow | "Suggest an outfit for college tomorrow." | `RECOMMEND_OUTFIT` | `RECOMMEND_OUTFIT` | **PASS** |
| **A02** | Premium Casual Query | "I want a premium-looking casual outfit." | `PREMIUM_UPGRADE` | `CLARIFICATION_RESPONSE` | **FAIL** |
| **A03** | Style 3 Ways | "Style my black shirt in three ways." | `STYLE_3_WAYS` | `STYLE_3_WAYS` | **PASS** |
| **A04** | Style Kurta Companions | "What can I wear with this kurta?" | `STYLE_ITEM` | `STYLE_ITEM` | **PASS** |
| **A05** | Elegance Refinement | "Make my current outfit more elegant." | `PREMIUM_UPGRADE` | `UNKNOWN` | **FAIL** |
| **A06** | Upcoming Wedding Intent | "I have a wedding next week." | `RECOMMEND_OUTFIT` | `CLARIFICATION_RESPONSE` | **FAIL** |
| **A07** | Anti-Repetition Intent | "I don't want to repeat yesterday's outfit." | `ANALYZE_WEAR` / Avoidance | `UNKNOWN` | **FAIL** |
| **A08** | Ambiguous Today Query | "I have no idea what to wear today." | `RECOMMEND_OUTFIT` | `RECOMMEND_OUTFIT` | **PASS** |
| **A09** | Interview Styling Check | "Can I wear my navy blazer to an interview?" | `STYLE_ITEM` | `STYLE_ITEM` | **PASS** |
| **A10** | Non-Existent Garment | "Style my purple polka-dot tuxedo." | Handled as not found | Handled as not found | **PASS** |
| **A11** | Calendar Planning Request | "Plan this outfit for Friday." | `PLAN_OUTFIT` | `PLAN_OUTFIT` | **PASS** |
| **A12** | Wear Logging Request | "Log this look as worn." | `RECORD_WEAR` | `UNKNOWN` | **FAIL** |
| **A13** | Weather Inquiry | "What is the weather outside today?" | `CHECK_WEATHER` | `GENERAL_FASHION_QUESTION` | **FAIL** |
| **A14** | Color Pairing Advice | "Which colors pair well with olive green?" | `COLOR_PAIRING` | `UNKNOWN` | **FAIL** |
| **A15** | Indian Handloom Craft | "Tell me about Chikankari embroidery." | `GENERAL_FASHION_QUESTION` | `GENERAL_FASHION_QUESTION` | **PASS** |

### Section 3: AI Chatbot Multi-Turn (10 Scenarios)

| Scenario ID | Test Name | Conversation Turns | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|---|
| **C01** | Multi-Turn Entity Retention | T1: "What should I wear to college?" $\to$ T2: "Make it more formal" | Occasion `college` persists | `college` persisted | **PASS** |
| **C02** | Anaphoric Reference | T1: Suggests look with Blue Shirt $\to$ T2: "What can I wear with that shirt?" | Resolves to Blue Shirt from T1 | Fails; searches whole wardrobe | **FAIL** |
| **C03** | Ordinal Reference | T1: 3 looks returned $\to$ T2: "Schedule the second look for tomorrow" | Selects outfit index 1 | Hardcodes outfit index 0 | **FAIL** |
| **C04** | Intent Switch Midway | T1: "What should I wear?" $\to$ T2: "What is my most worn item?" | Switches to `ANALYZE_WEAR` | Sticky on `RECOMMEND_OUTFIT` | **FAIL** |
| **C05** | User Correction | T1: Suggests college $\to$ T2: "No, I meant for an interview" | Updates occasion to `interview` | Hijacked by confirmation "No" | **FAIL** |
| **C06** | Rejection of Plan | T1: Plan request $\to$ T2: "No, cancel that" | Pending confirmation cleared | Confirmation cleared | **PASS** |
| **C07** | Clarification Resume | T1: "Style an outfit" $\to$ T2: "office" | Resumes recommendation for office | Resumed with occasion | **PASS** |
| **C08** | Contradictory Request | "I want an ultra-formal beach outfit with heavy silk" | Polite guidance on drape & climate | Dropped to generic `UNKNOWN` | **FAIL** |
| **C09** | Unsupported External | "Book an Uber to Zara and buy a dress" | Safe disclosure of boundaries | Safely handled | **PASS** |
| **C10** | Historical Boundary | "What did I wear 3 years ago on Diwali?" | Discloses tracking data limits | Disclosed boundaries honestly | **PASS** |

### Section 4: Purchase & Smart Buy (10 Scenarios)

| Scenario ID | Test Name | Condition / Action | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|---|
| **P01** | Full Wardrobe Coverage | Complete wardrobe for all occasions | `NO_PURCHASE_NEEDED` | `NO_PURCHASE_NEEDED` | **PASS** |
| **P02** | Dormant Rediscovery | Unworn piece available for shortage | Prioritizes closet rediscovery | Recommends rediscovery | **PASS** |
| **P03** | Missing Category Gap | 0 Footwear in wardrobe | Reports Footwear shortage | Found Footwear gap | **PASS** |
| **P04** | Query Entity Extraction | "Should I buy blue jeans?" | Extracts `blue` and `jeans` | Extracted `blue` and `jeans` | **PASS** |
| **P05** | Sufficiency False-Negative | 15 Tops, 0 Bottoms, 0 Wear Logs | Must report missing Bottoms | Falsely reports NO_PURCHASE_NEEDED | **FAIL** |
| **P06** | Catalog Static Prices | Inspect `src/data/candidates.ts` | Dynamic verified prices only | Contains hardcoded `₹1,200–₹2,500` | **FAIL** |
| **P07** | Catalog Hallucinated Notes | Inspect `src/data/candidates.ts` | Grounded pairing notes only | Claims "Pairs with your white tee" | **FAIL** |
| **P08** | Budget Model Integrity | Inspect `DEFAULT_STYLE_PREFERENCES` | Valid budget preferences schema | No budget field in preferences | **FAIL** |
| **P09** | External Isolation | Codebase network/scraping audit | Zero external shopping APIs | 0 external shopping integrations | **PASS** |
| **P10** | Cross-Engine Consistency | Stylist vs Smart Buy on 0 shoes | Both engines report missing shoes | Stylist drops `missingRequirements` | **FAIL** |

**Total Scenarios:** 50  
**Passed:** 31 (62%)  
**Failed:** 19 (38%)  

---

## 6. Cross-Feature Consistency Matrix

Tested across: *"I need a smart casual college outfit using my existing clothes."*

| Dimension | Stylist (Dress Me) | AI Saathi (Chat) | AI Chatbot (Needle Bar) | Purchase (Smart Buy) | Consistency Assessment |
|---|---|---|---|---|---|
| **Intent Understanding** | Implicit via screen filters (`college`, `casual`) | Maps to `COLLEGE_OUTFIT` | Maps to `recommend_outfit` | N/A (Evaluates gaps) | **CONSISTENT** |
| **Garment Grounding** | Strictly uses owned clean pieces | Strictly uses owned clean pieces | Strictly uses owned clean pieces | Evaluates owned pieces | **CONSISTENT** |
| **Formality Calibration** | Targets 2.0 (Relaxed Casual) | Targets 2.0 (Campus Polish) | Targets casual styling | Audits casual readiness | **CONSISTENT** |
| **Handling of Unwashed Clothes** | Blocks unwashed pieces | Blocks unwashed pieces | Blocks unwashed pieces | Flags items as in-laundry | **CONSISTENT** |
| **Purchase Gating** | Recommends from closet | Recommends from closet | Recommends from closet | Says "No purchase needed" | **CONSISTENT** |
| **Missing Requirement Reporting** | Discards `missingRequirements` in `useDressMe` | Surfaces missing slots in response text | Fails to explain missing slot | Explains missing category in gap report | **INCONSISTENT** |
| **Look Persistence & Saving** | Saves full snapshot to Lookbook | Prompts confirmation to save | Dispatches `plan_outfit` | N/A | **SLIGHT DIVERGENCE** |

---

## 7. Purchase Accuracy Assessment

### What Purchase Currently Promises vs. What It Actually Does

| Dimension | Product Promise | Actual Implementation | Assessment |
|---|---|---|---|
| **Wardrobe Gap Reality** | "Identifies genuine structural shortages in your wardrobe." | Valid in Smart Buy 2.0 when data is sufficient; completely suppressed when wear count $< 10$. | **PARTIAL** |
| **Need Verification** | "Proves whether you genuinely need an item before buying." | Prioritizes closet rediscovery; however, legacy `candidates.ts` recommends duplicate staples. | **DEFECTIVE** |
| **Style Relevance** | "Grounded in your Personal Style Profile and affinities." | Recommends aesthetic fits, but lacks budget modeling entirely. | **PARTIAL** |
| **Product & Price Data** | "Curated smart shopping guidance." | Fictitious hardcoded prices (`₹1,200–₹2,500`) with zero merchant verification or availability data. | **VIOLATION** |
| **Operating Cost Constraint** | "₹0 operating cost, privacy-first, zero affiliate spam." | Fully adheres to ₹0 cost and local-first privacy (no network tracking or scraping). | **COMPLIANT** |

---

## 8. User Experience & Interface Review

1. **Dead Button in Gaps Screen:** In `GapsScreen.tsx:56`, the mobile theme toggle uses raw characters `{theme === 'light' ? '☾' : '☼'}` with small `h-9 w-9` sizing that violates the 44px touch target standard.
2. **Generic Empty States in Dress Me:** When all pants are in laundry, Dress Me displays `"None of your current wardrobe pieces are tagged for college"`, misleading the user into thinking their items are tagged wrong rather than in laundry.
3. **No Visual Indication of Ordinal Selection in Saathi:** In `AISaathiChatView`, when 3 outfits are recommended, there are no clickable action buttons ("Wear Look 1", "Wear Look 2", "Wear Look 3"). The user must type text, which defaults to Look 1.
4. **Chatbot Amnesia on Corrections:** Saying "No, I meant office" triggers the message *"Understood. Action cancelled — no changes were made"*, leaving the user stranded without addressing the corrected occasion.

---

## 9. Exact Files Requiring Modification

1. **`src/engine/saathi/intentParser.ts`**
   - Fix priority waterfall: move `CHECK_WEATHER` above greedy `what is\s+` check.
   - Expand `PREMIUM_UPGRADE` regex to include `elegant`, `elegance`, and `premium-looking`.
   - Add anti-repetition intent (`ANTI_REPETITION_REQUEST` or routing to wear avoidance).
   - Expand `RECORD_WEAR` regex to match `log.*as worn`.
   - Prevent isolated occasion keywords from capturing descriptive requests into `CLARIFICATION_RESPONSE`.
   - Fix `COLOR_PAIRING` regex to support adverbs (`pair.*with`).
2. **`src/engine/recommendationEngine.ts`**
   - Respect `allowPlanningMode: false` strictly: do not force `isPlanningMode = true` on dirty anchors.
   - Enforce sacred Tier 1 hard constraint rejecting animal leather during `puja` / temple occasions.
3. **`src/hooks/useDressMe.ts`**
   - Pass `recentWornItemIds` and `plannedTomorrowItemIds` to `recommendOutfits` for anti-repetition.
   - Preserve and expose `missingRequirements` from `recommendOutfitsWithTelemetry` instead of relying on brittle `emptyStateInfo`.
4. **`src/engine/saathi/orchestrationEngine.ts`**
   - Support ordinal look selection (Look 1, 2, 3) across `PLAN_OUTFIT`, `RECORD_WEAR`, and `EXPLAIN_RECOMMENDATION`.
   - Route specific garment entities into `getPurchaseAssessmentTool` instead of passing `{}`.
   - Handle user corrections gracefully without mistaking "No, I meant..." for an action cancellation.
5. **`src/engine/saathi/contextResolver.ts`**
   - Resolve anaphoric references ("that shirt", "this kurta") to the pieces of the outfit generated in the previous turn.
6. **`src/engine/smartBuy/smartBuyEngine.ts`**
   - Decouple physical category absence (0 bottoms, 0 shoes) from behavioral data sufficiency (10 wears). Structural impossibility must be flagged immediately as a gap regardless of wear log volume.
7. **`src/data/candidates.ts` & `src/hooks/useSmartBuys.ts`**
   - Deprecate or eliminate hardcoded mock prices (`₹1,200–₹2,500`) and ungrounded pairing claims.
   - Ensure candidate recommendations filter out categories and colors the user already owns.
8. **`src/screens/GapsScreen.tsx`**
   - Replace raw glyphs `☾` and `☼` with Lucide icons (`Moon`, `Sun`) and enforce $\ge 44\text{px}$ touch targets.

---

## 10. Prioritized Remediation Plan

### Phase 1.2 — P0: Core Accuracy & Physical Grounding (Must Fix First)
1. **Remediate Dirty Anchor Enforcement:** In `recommendationEngine.ts`, ensure `allowPlanningMode: false` strictly halts dirty anchor recommendations.
2. **Fix Structural Gap Gating:** In `smartBuyEngine.ts`, allow missing categories (0 bottoms, 0 footwear) to register as `CRITICAL_GAP` even with $< 10$ wear events.
3. **Eliminate Fabricated Prices:** Remove hardcoded price strings (`₹1,200–₹2,500`) from `candidates.ts`; clearly disclose that StyleSaathi provides styling gap intelligence, not commercial retail catalog pricing.

### Phase 1.3 — P1: NLP Intent Parsing & Multi-Turn Conversational Quality
1. **Fix Intent Waterfall Priority:** Reorder `CHECK_WEATHER` above `GENERAL_FASHION_QUESTION`; fix regex boundaries for `PREMIUM_UPGRADE`, `COLOR_PAIRING`, and `RECORD_WEAR`.
2. **Implement Ordinal & Anaphoric Resolution:** Enable `orchestrationEngine.ts` to select specific looks by index (`the second look`) and resolve `"that shirt"` to previous turn components.
3. **Fix Dress Me Empty State:** Update `useDressMe.ts` to surface genuine `missingRequirements` from the recommendation engine.
4. **Enforce Sacred Decorum:** Hard-reject leather products during `puja` / temple occasions in `recommendationEngine.ts`.

### Phase 1.4 — P2: User Experience Polish & Anti-Repetition
1. **Anti-Repetition Intent:** Add handler for `"I don't want to repeat yesterday's outfit"` in AI Saathi.
2. **Interactive Look Action Buttons in Chat:** Surface 1-tap action buttons directly on Saathi recommendation cards.
3. **Theme Toggle Accessibility:** Upgrade `GapsScreen.tsx` theme toggle to Lucide icons and $\ge 44\text{px}$ touch targets.

---

## 11. Final Verdict

### **Verdict: FAIL**

**Justification:** While the underlying algorithms (mathematical candidate generation, diversification distance, and basic clean wardrobe filtering) operate reliably in isolation, the integrated user-facing experience suffers from substantial functional flaws:
- **38% failure rate** across 50 standardized functional test scenarios.
- **Critical NLP misclassifications** on 4 out of 8 natural language queries specifically named in product specifications.
- **Conversational amnesia** regarding follow-up looks and referenced garments.
- **Physical gap suppression** where zero-bottom wardrobes are told "No purchase needed".
- **Fabricated pricing and mock pairing notes** in legacy shopping candidate datasets.

**Next Action:** Await user authorization to begin Phase 1.2 Remediation. Do not modify implementation code until approved.

