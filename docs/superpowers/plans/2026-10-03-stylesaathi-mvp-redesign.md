# StyleSaathi Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform StyleSaathi from a monolithic, emoji-based CRUD wardrobe prototype into a premium, image-first, mobile-first Indian digital wardrobe and personal stylist with decoupled architecture, reliable outfit engine, local photo storage, and warm editorial design system.

**Architecture:** Refactor the monolithic `main.tsx` into a 4-layer local-first architecture (UI Layer, Hook/Service Layer, Domain Engine Layer, Repository/PhotoStore Layer). The working rules-based outfit engine is decomposed into modular files (`outfitEngine`, `outfitTemplates`, `compatibility`, `scoring`) with regression tests. Wardrobe items use real studio flat-lay photography mapped to local assets, backed by an IndexedDB photo store and an editorial SVG silhouette fallback.

**Tech Stack:** React 19, TypeScript 5, Vite 6, Tailwind CSS v4, Lucide React, Vitest, HTML5 Canvas, IndexedDB.

**Spec:** `docs/superpowers/specs/2026-10-03-stylesaathi-mvp-redesign-design.md`

---

## Global Constraints
- Zero clothing emojis (`👕`, `👖`, `👗`, `👟`, `👜`, etc.) anywhere in the UI.
- Use Lucide React icons for all UI interactions; no emoji icons for actions.
- Preserve the exact scoring, harmony, formality, and safety rules of `src/engine/engine.ts`.
- Laundry items (`in_laundry` and `needs_washing`) must NEVER appear in generated outfits.
- Saree template must strictly require a matching blouse; no outfit can contain two bottoms.
- Mobile-first target: 390 × 844 viewport with minimum 44px × 44px interactive touch targets and safe area padding.
- Desktop layout must use a centered shell (`max-w-[430px]` or expanding grid container).
- Palette tokens: `--background: #F8F5F0`, `--cream: #FFFDFC`, `--accent: #B32663`, `--text: #181515`, `--muted: #77716D`, `--border: #E8E1DB`.
- Photos compressed client-side to max 800px dimension and stored safely (IndexedDB / safe local store).
- Sample wardrobe must contain 25 realistic Indian + Western items with intentional wardrobe gaps.

## Review Focus
- **Input with missing photo:** Must render `ClothingFallback` with category silhouette and colors, never broken image or emoji.
- **Laundry items marked during active session:** Must be excluded from subsequent outfit generations immediately without requiring app reload.
- **Candidate purchase simulation with 0-item wardrobe:** Must handle small or empty wardrobes without runtime crash or fabricating combinations.
- **Photo upload exceeding canvas limits / corrupted file:** Must show non-crashing friendly error message allowing retry.
- **Local storage quota exceeded:** IndexedDB photo storage isolates heavy base64 strings so localStorage never exceeds its 5MB quota.

---

## 1. Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                         UI LAYER                            │
│  Screens: Onboarding, Wardrobe, DressMe, Gaps, Profile     │
│  Components: BottomNav, ItemCard, OutfitCard, BottomSheet,  │
│              AddItemSheet, ItemDetailSheet, AccessoryDrawer │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    HOOK / SERVICE LAYER                     │
│  useWardrobe, useDressMe, useSmartBuys, AutoTagger          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       DOMAIN LAYER                          │
│  outfitEngine (orchestration, filtering, signature)         │
│  outfitTemplates (Western, Kurta look, Saree, Indo-western) │
│  compatibility (slot & category compatibility)              │
│  scoring (color harmony, formality fit, wear penalty)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        DATA LAYER                           │
│  WardrobeRepository (contract)                              │
│  LocalStorageWardrobeRepository (metadata in localStorage)  │
│  IndexedDBPhotoStore (binary images in IndexedDB)           │
│  Local sample asset library & ClothingFallback              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Current → Target Migration

We perform an incremental extraction so the app never enters a broken build or test state:
1. **Types Extraction (`src/types.ts`)**: Expand domain types with `WardrobeItem`, `GeneratedOutfit`, `SavedOutfit`, `AutoTagResult`, and repository contracts without breaking existing code.
2. **Repository & Storage Layer (`src/repositories/`, `src/utils/photoStore.ts`)**: Implement `WardrobeRepository`, `LocalStorageWardrobeRepository`, and `IndexedDBPhotoStore`.
3. **Engine Decomposition (`src/engine/`)**: Break `src/engine/engine.ts` into `outfitTemplates.ts`, `compatibility.ts`, `scoring.ts`, and `outfitEngine.ts`. Expose `src/engine/index.ts` and verify existing tests + new scenario tests pass.
4. **Asset System & Fallback (`src/assets/wardrobe/`, `src/components/common/ClothingFallback.tsx`)**: Establish local photography mapping and graceful category silhouette fallback.
5. **Design System & Primitives (`src/index.css`, `src/components/common/`, `src/components/navigation/`)**: Implement CSS variables, typography, `Chip`, `Button`, `BottomSheet`, `Header`, `EmptyState`, and `BottomNav`.
6. **Feature Extraction (`src/hooks/`, `src/screens/`, `src/components/wardrobe/`, `src/components/dressme/`, `src/components/gaps/`)**:
   - Extract Wardrobe, Add Item, Item Detail.
   - Extract Dress Me, Outfit Card, Accessory Drawer.
   - Extract Gaps, Category Balance, Occasion Coverage, Smart Buy Simulation.
   - Extract Onboarding and Profile.
7. **Main Bootstrap (`src/App.tsx`, `src/main.tsx`)**: Replace the monolithic `src/main.tsx` with a clean application router shell wrapped by `WardrobeProvider`.

---

## 3. Data Flows

### Flow 1: Add Item Flow
```text
User Selects/Captures Image
           ↓
imageCompressor.ts (max 800px, 0.78 quality canvas export)
           ↓
AutoTagger.analyze(file) (predicts category, colors, occasion, formality)
           ↓
AddItemSheet (displays preview + suggested tappable chips)
           ↓
User tweaks / confirms tags
           ↓
PhotoStore.save(id, blob/base64) & Repository.addItem(item)
           ↓
WardrobeContext updates state
           ↓
WardrobeGrid updates with new ItemCard
```

### Flow 2: Dress Me Flow
```text
User selects Occasion ("College") & Season ("Summer")
           ↓
useDressMe hook calls outfitEngine.generateOutfits(items, occasion, season)
           ↓
Filtering: excludes `in_laundry` & `needs_washing` items
           ↓
Template generation: matches slots (Western, Kurta look, Indo-western)
           ↓
Scoring: color harmony + formality fit + favorite bonus - wear penalty
           ↓
Returns 2–4 distinct GeneratedOutfit objects
           ↓
DressMeScreen renders editorial asymmetric OutfitCard with staggered animation
           ↓
User clicks "+ Accessory" → AccessoryDrawer loads compatible wardrobe items
           ↓
User clicks "Wore this today" → Repository.updateItem(id, { timesWorn: +1 })
```

### Flow 3: Gaps & Smart Buy Flow
```text
GapsScreen mounts → useSmartBuys hook executes
           ↓
CategoryBalance calculates distribution across Tops, Bottoms, Ethnic, etc.
           ↓
OccasionCoverage executes generateOutfits for all 12 Indian occasions
           ↓
Smart Buy Simulator iterates over candidate additions (candidates.ts)
           ↓
Simulates adding candidate to wardrobe:
newOutfits = simulateBuy(wardrobe, candidate, occasions, season)
           ↓
Ranks candidates by highest new outfits unlocked
           ↓
SmartBuyCard displays candidate photo, unlock count (+12), price range, and reason
           ↓
User taps "See combinations" → CombinationsModal displays the unlocked outfits
```

---

## 4. Detailed Phase Plan

### Phase 0 — Baseline & Environment Verification
- **Goal:** Verify baseline test suite, build commands, and inspect existing code contracts.
- **Files to modify:** None.
- **Verification commands:**
  ```bash
  npm test
  npm run build
  ```
- **Acceptance criteria:** Tests pass (3/3), build succeeds with 0 errors.

---

### Phase 1 — Domain Types & Taxonomies
- **Goal:** Define comprehensive, typed domain models in `src/types.ts` and `src/data/taxonomy.ts`.
- **Files to create:** `src/data/taxonomy.ts`
- **Files to modify:** `src/types.ts`
- **Data/API changes:**
  - Export `Category`, `Subcategory`, `Season`, `Occasion`, `Status`.
  - Export `WardrobeItem`, `GeneratedOutfit`, `SavedOutfit`, `AutoTagResult`, `SmartBuyRecommendation`.
  - Export `WardrobeRepository` and `WardrobePhotoStore` interfaces.
- **Component changes:** None.
- **Testing changes:** Verify TypeScript builds cleanly (`npx tsc --noEmit`).
- **Dependencies:** None.
- **Risks:** Breaking existing imports. Mitigated by maintaining backward-compatible aliases.
- **Acceptance criteria:** All types compile without circular references.
- **Verification commands:** `npx tsc --noEmit`

---

### Phase 2 — Repository Layer & Photo Storage
- **Goal:** Decouple data persistence from UI components with IndexedDB photo storage and LocalStorage metadata fallback.
- **Files to create:**
  - `src/repositories/WardrobeRepository.ts`
  - `src/repositories/LocalStorageWardrobeRepository.ts`
  - `src/utils/photoStore.ts`
- **Files to modify:** None.
- **Data/API changes:**
  - `WardrobeRepository` contract: `getItems()`, `getItem(id)`, `addItem(item)`, `updateItem(id, patch)`, `deleteItem(id)`, `getSavedOutfits()`, `saveOutfit(outfit)`, `deleteSavedOutfit(id)`, `clear()`.
  - `photoStore.ts`: IndexedDB helper `savePhoto(id, dataUrl)`, `getPhoto(id)`, `deletePhoto(id)`. Falls back gracefully to memory/localStorage if IndexedDB is blocked.
- **Component changes:** None.
- **Testing changes:** Unit test repository operations in `src/repositories/__tests__/repository.test.ts`.
- **Dependencies:** None (uses native browser `indexedDB` API).
- **Risks:** Safari private mode blocking IndexedDB. Mitigated with in-memory fallback.
- **Acceptance criteria:** Items can be stored, updated, retrieved, and cleared reliably.
- **Verification commands:** `npm test`

---

### Phase 3 — Engine Modularization & Comprehensive Regression Suite
- **Goal:** Deconstruct `src/engine/engine.ts` into pure, modular files while ensuring 100% test compatibility and adding all required invariant tests.
- **Files to create:**
  - `src/engine/outfitTemplates.ts` (Western, Western dress, Kurta look, Saree look, Salwar/lehenga set, Indo-western)
  - `src/engine/compatibility.ts` (slot & category compatibility, mandatory relationships)
  - `src/engine/scoring.ts` (color harmony, occasion formality fit, favorite bonus, wear penalty)
  - `src/engine/outfitEngine.ts` (`generateOutfits`, `simulateBuy`, `signature`)
  - `src/engine/index.ts` (public façade)
- **Files to modify:**
  - `src/engine/engine.ts` (re-export from `./outfitEngine` for backwards compatibility)
  - `src/engine/engine.test.ts` (expand test suite with 12 strict tests)
- **Testing changes:**
  Add tests for:
  - `laundry items are never suggested`
  - `in_laundry items are never suggested`
  - `saree always has blouse`
  - `no outfit contains two bottoms`
  - `western dress requires footwear`
  - `kurta supports valid bottoms (jeans, palazzo, churidar, leggings, trousers)`
  - `office respects minimum formality`
  - `wedding, Diwali, and Puja support appropriate ethnic templates`
  - `tiny wardrobe does not fabricate outfits`
  - `recent-wear penalty affects ranking`
  - `favorite bonus affects ranking`
  - `smart-buy simulation calculates actual outfit delta`
- **Dependencies:** None.
- **Risks:** Altering scoring mathematics. Mitigated by porting exact formulas verbatim.
- **Acceptance criteria:** All 12 engine tests pass without warnings.
- **Verification commands:** `npm test`

---

### Phase 4 — Sample Wardrobe & Asset System
- **Goal:** Create realistic Indian + Western sample wardrobe dataset (25 items with intentional gaps) and editorial asset mapping with `ClothingFallback`.
- **Files to create:**
  - `src/assets/wardrobe/index.ts` (asset registry and mapping)
  - `src/components/common/ClothingFallback.tsx` (clean minimalist SVG silhouette with category icon & colorway)
  - `src/components/common/LazyImage.tsx` (smooth fade-in with fallback trigger)
  - `src/data/sampleWardrobe.ts` (25 realistic items)
  - `src/data/candidates.ts` (25-30 candidate purchases with price ranges)
- **Files to modify:**
  - `src/data/sample.ts` (re-export `sampleWardrobe` for backwards compatibility)
- **Assets to organize:**
  - `src/assets/wardrobe/{tops,bottoms,ethnic,dresses,outerwear,footwear,accessories}/`
- **Data/API changes:** Each sample item links to its local image asset while supporting `photo: null` fallback gracefully.
- **Component changes:** `ClothingFallback` renders category-specific SVG silhouette (kurta, tee, jeans, saree, dress, sneaker, jutti, etc.) and color badge—never an emoji.
- **Testing changes:** Add unit test ensuring `ClothingFallback` renders correctly for all 7 categories without crashing.
- **Acceptance criteria:** App displays images when available, or elegant silhouettes when unavailable.
- **Verification commands:** `npm test`

---

### Phase 5 — Design System & Shared Primitives
- **Goal:** Implement the warm fashion editorial design tokens, CSS variables, dark mode, and shared UI primitives.
- **Files to create:**
  - `src/components/common/Header.tsx`
  - `src/components/common/Chip.tsx`
  - `src/components/common/BottomSheet.tsx`
  - `src/components/common/EmptyState.tsx`
  - `src/components/navigation/BottomNav.tsx`
- **Files to modify:**
  - `src/index.css` (tokens: `--background: #F8F5F0`, `--accent: #B32663`, `--cream: #FFFDFC`, `--text: #181515`, `--muted: #77716D`, `--border: #E8E1DB`, dark mode styles, safe area insets)
- **Component changes:**
  - `BottomNav`: 4 tabs (`Wardrobe`, `Dress Me`, `Gaps`, `Profile`) using Lucide icons (`Shirt`, `Sparkles`, `PieChart`, `User`). 44px+ touch targets.
  - `BottomSheet`: Slide-up gesture/animation, backdrop blur, swipe-down handle, accessible close button.
  - `Chip`: Horizontally scrollable pill buttons with active accent state.
- **Testing changes:** Verify DOM rendering and theme toggling.
- **Dependencies:** `lucide-react`.
- **Risks:** iOS safe area inset overlapping bottom nav. Mitigated by `padding-bottom: calc(64px + env(safe-area-inset-bottom))`.
- **Acceptance criteria:** Mobile shell adheres to 390×844 with 44px touch targets.
- **Verification commands:** `npm run build`

---

### Phase 6 — Context & Custom Hooks
- **Goal:** Build the React context and custom hooks that interface between the repository, domain engine, and UI layer.
- **Files to create:**
  - `src/context/WardrobeContext.tsx`
  - `src/hooks/useWardrobe.ts`
  - `src/hooks/useDressMe.ts`
  - `src/hooks/useSmartBuys.ts`
- **Files to modify:**
  - `src/context/AppContext.tsx` (re-export or wrap `WardrobeContext`)
- **Data/API changes:**
  - `useWardrobe`: provides items, search, category filter, status filter, favorite filter, counts.
  - `useDressMe`: provides selected occasion, season, generated outfits, shuffle handler, accessory switcher, wear logger.
  - `useSmartBuys`: provides category distribution, occasion coverage checklist, simulated smart-buy recommendations ranked by unlocked count.
- **Testing changes:** Integration test for hooks using testing-library or Vitest.
- **Acceptance criteria:** Zero business logic in screens; hooks manage state cleanly.
- **Verification commands:** `npm test`

---

### Phase 7 — Wardrobe Screen & Item Experience
- **Goal:** Implement the 2-column image-first wardrobe grid, item cards, detail sheet, and laundry status toggling.
- **Files to create:**
  - `src/components/wardrobe/ItemCard.tsx`
  - `src/components/wardrobe/ItemDetailSheet.tsx`
  - `src/screens/WardrobeScreen.tsx`
- **Component changes:**
  - `ItemCard`: 2-column card with `object-fit: contain`, subtle hover/tap feedback, status badge (`Ready`, `Needs Wash`, `In Laundry`), Lucide `Heart` favorite toggle.
  - `ItemDetailSheet`: High-resolution image preview, status switcher (`Clean`, `Needs washing`, `In laundry`), times worn counter, note editor, favorite toggle, and delete action with confirmation.
- **Testing changes:** Test item filtering and status updates.
- **Acceptance criteria:** Laundry items display muted badge; favoriting updates instantly; zero emoji icons.
- **Verification commands:** `npm test && npm run build`

---

### Phase 8 — Add Item Experience & Auto-Tagging Seam
- **Goal:** Implement the camera/upload flow with client-side canvas compression and typed auto-tagging chip confirmation.
- **Files to create:**
  - `src/utils/imageCompressor.ts` (canvas resize to max 800px, JPEG 0.78 compression)
  - `src/utils/autoTagger.ts` (`AutoTagger` interface & `MockAutoTagger` implementation)
  - `src/components/wardrobe/AddItemSheet.tsx`
- **UX Flow:**
  1. User selects or captures a photo.
  2. Canvas compresses the image client-side to < 200KB.
  3. `AutoTagger` analyzes file and returns suggested category, subcategory, color, and occasion.
  4. User sees "We think this is..." with tappable chips.
  5. User confirms or taps to adjust any tag.
  6. 1-tap save persists image to PhotoStore and metadata to Repository.
- **Error handling:** Friendly alert banner if upload or compression fails.
- **Acceptance criteria:** Instant preview, zero heavy manual forms, non-crashing upload errors.
- **Verification commands:** `npm test && npm run build`

---

### Phase 9 — Dress Me Screen & Editorial Outfit Reveal
- **Goal:** Build the hero "Aaj kya pehenna hai?" styling experience with asymmetric editorial cards, accessory drawer, and wear logging.
- **Files to create:**
  - `src/components/dressme/OutfitCard.tsx`
  - `src/components/dressme/AccessoryDrawer.tsx`
  - `src/screens/DressMeScreen.tsx`
- **Component changes:**
  - `DressMeScreen`: Occasion selector chips (College, Casual Outing, Office, Date, Party, Family Function, Wedding Guest, Diwali, Holi, Eid, Puja, Travel) + Season selector chips (Summer, Monsoon, Winter) + Shuffle button ("Another look ✨").
  - `OutfitCard`: Asymmetric editorial composition with top piece prominent, bottom + footwear side-by-side, editorial styling note ("why"), "+ Add / Change accessory" button, "Wore this today" action, and "Save look" action.
  - `AccessoryDrawer`: Slide-up sheet showing available clean accessories (bags, watches, juttis, sunglasses, jewellery) with 1-tap attach/detach.
- **Testing changes:** Verify shuffle generates distinct looks; verify "Wore this today" increments wear counts.
- **Acceptance criteria:** Editorial reveal animation; clean laundry exclusion; zero two-bottom looks.
- **Verification commands:** `npm test && npm run build`

---

### Phase 10 — Wardrobe Gaps & Smart Buy Engine
- **Goal:** Implement the fashion intelligence dashboard with category balance, real occasion coverage, and simulated smart buys.
- **Files to create:**
  - `src/components/gaps/CategoryBalanceBar.tsx`
  - `src/components/gaps/OccasionCoverageList.tsx`
  - `src/components/gaps/SmartBuyCard.tsx`
  - `src/components/gaps/CombinationsModal.tsx`
  - `src/screens/GapsScreen.tsx`
- **Component changes:**
  - `CategoryBalanceBar`: Visual progress bars with piece counts and category thumbnails.
  - `OccasionCoverageList`: Shows which occasions have valid clean outfits vs. which need more pieces, calculated directly from the engine.
  - `SmartBuyCard`: Candidate piece photo, unlock badge (`+12 new outfits`), estimated price range, and "Why: fills your biggest gap".
  - `CombinationsModal`: Gallery previewing the specific outfits newly unlocked by this candidate item.
- **Testing changes:** Verify smart buy simulation accurately computes deltas without fabricating rankings.
- **Acceptance criteria:** Rankings dynamically change when wardrobe pieces are added or removed.
- **Verification commands:** `npm test && npm run build`

---

### Phase 11 — Onboarding, Profile & App Bootstrap
- **Goal:** Implement the 3-step editorial onboarding, style vibe picker, profile screen, and connect everything in `App.tsx` and `main.tsx`.
- **Files to create:**
  - `src/screens/OnboardingScreen.tsx`
  - `src/screens/ProfileScreen.tsx`
  - `src/App.tsx`
- **Files to modify:**
  - `src/main.tsx` (slim bootstrap: imports `index.css`, mounts `<WardrobeProvider><App /></WardrobeProvider>`)
- **Component changes:**
  - `OnboardingScreen`: 3 editorial slides with high-fashion imagery, typography, vibe selection chips, "Load sample wardrobe", and "Start empty".
  - `ProfileScreen`: Wardrobe statistics (pieces, outfits saved, favorites, wear count), most worn piece, style preferences, dark mode toggle, reset wardrobe, and privacy disclaimer.
- **Acceptance criteria:** First-time users see onboarding; returning users go straight to Wardrobe; resetting data clears cleanly.
- **Verification commands:** `npm test && npm run build`

---

### Phase 12 — Responsive Polish, Accessibility & Dark Mode
- **Goal:** Polish mobile touch targets (44px min), iOS safe areas, keyboard navigation, focus rings, dark mode contrast, and reduced-motion transitions.
- **Files to modify:**
  - `src/index.css`
  - Component files as needed for a11y attributes (`aria-label`, `role="dialog"`, `alt` tags).
- **Verification commands:**
  ```bash
  npm test
  npm run build
  ```
- **Acceptance criteria:** Zero accessibility errors, beautiful 390px mobile view, centered desktop view, clean dark mode contrast.

---

### Phase 13 — Final Verification & Acceptance
- **Goal:** Run complete test suite, verify production build, and execute end-to-end user journey checklist.
- **Verification commands:**
  ```bash
  npm test
  npm run build
  ```
- **Acceptance criteria:**
  - Vitest: PASS (100% test pass rate)
  - TypeScript: PASS (0 errors)
  - Build: PASS (Vite production bundle generated successfully)

---

## 5. File-Level Change Matrix

| File Path | Action | Layer / Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Unified domain types, taxonomies, repository interfaces |
| `src/data/taxonomy.ts` | Create | Category, subcategory, occasion, and season constants |
| `src/data/sampleWardrobe.ts` | Create | 25 realistic sample items with intentional wardrobe gaps |
| `src/data/candidates.ts` | Create | 25–30 candidate items for smart-buy simulation |
| `src/data/sample.ts` | Modify | Re-export `sampleWardrobe` for backwards compatibility |
| `src/repositories/WardrobeRepository.ts` | Create | Abstract persistence contract |
| `src/repositories/LocalStorageWardrobeRepository.ts` | Create | LocalStorage metadata persistence |
| `src/utils/photoStore.ts` | Create | IndexedDB binary photo store with memory fallback |
| `src/utils/imageCompressor.ts` | Create | Canvas resizing (max 800px) & JPEG 0.78 compression |
| `src/utils/autoTagger.ts` | Create | `AutoTagger` interface & mock implementation |
| `src/assets/wardrobe/index.ts` | Create | Local studio photography mapping |
| `src/components/common/ClothingFallback.tsx` | Create | Category-aware editorial SVG silhouette fallback |
| `src/components/common/LazyImage.tsx` | Create | Smooth fade-in image wrapper with fallback trigger |
| `src/components/common/Header.tsx` | Create | Top bar with brand logo, title, theme toggle |
| `src/components/common/Chip.tsx` | Create | Horizontal pill button with 44px min touch area |
| `src/components/common/BottomSheet.tsx` | Create | Accessible slide-up modal with backdrop blur |
| `src/components/common/EmptyState.tsx` | Create | Polished zero-state component with action CTA |
| `src/components/navigation/BottomNav.tsx` | Create | Sticky 4-tab mobile footer with Lucide icons |
| `src/engine/outfitTemplates.ts` | Create | Outfits template specifications |
| `src/engine/compatibility.ts` | Create | Slot compatibility and mandatory relationships |
| `src/engine/scoring.ts` | Create | Color harmony, formality, favorite bonus, wear penalty |
| `src/engine/outfitEngine.ts` | Create | Core orchestration: generateOutfits, simulateBuy |
| `src/engine/index.ts` | Create | Public engine façade |
| `src/engine/engine.ts` | Modify | Re-export from `outfitEngine` for backwards compatibility |
| `src/engine/engine.test.ts` | Modify | Comprehensive suite of 12 regression & invariant tests |
| `src/context/WardrobeContext.tsx` | Create | Central React context wrapping repository |
| `src/context/AppContext.tsx` | Modify | Re-export / alias `WardrobeContext` for compatibility |
| `src/hooks/useWardrobe.ts` | Create | Wardrobe filtering, search, and category counts |
| `src/hooks/useDressMe.ts` | Create | Outfit generation, shuffle, accessory swap, wear logger |
| `src/hooks/useSmartBuys.ts` | Create | Category balance, occasion coverage, smart buy simulation |
| `src/components/wardrobe/ItemCard.tsx` | Create | 2-column image card with favorite & status badges |
| `src/components/wardrobe/ItemDetailSheet.tsx` | Create | Full item inspection, status toggle, note, delete |
| `src/components/wardrobe/AddItemSheet.tsx` | Create | Upload/camera preview, compression, auto-tag chips |
| `src/components/dressme/OutfitCard.tsx` | Create | Editorial asymmetric outfit layout with why note |
| `src/components/dressme/AccessoryDrawer.tsx` | Create | Bottom sheet to cycle/add compatible accessories |
| `src/components/gaps/CategoryBalanceBar.tsx` | Create | Visual distribution bar with category thumbnails |
| `src/components/gaps/OccasionCoverageList.tsx` | Create | Calculated occasion readiness checklist |
| `src/components/gaps/SmartBuyCard.tsx` | Create | Candidate item, unlocked outfits badge, price, reason |
| `src/components/gaps/CombinationsModal.tsx` | Create | Gallery of unlocked outfits for a candidate item |
| `src/screens/OnboardingScreen.tsx` | Create | 3-step visual intro + style vibe selector |
| `src/screens/WardrobeScreen.tsx` | Create | Main wardrobe screen with search, filters, grid |
| `src/screens/DressMeScreen.tsx` | Create | Hero occasion & season outfit generator |
| `src/screens/GapsScreen.tsx` | Create | Fashion intelligence dashboard |
| `src/screens/ProfileScreen.tsx` | Create | Stats, preferences, appearance, reset, privacy |
| `src/index.css` | Modify | Design tokens, CSS variables, dark mode, animations |
| `src/App.tsx` | Create | App shell with navigation router and safe bottom container |
| `src/main.tsx` | Refactor | Application entry point bootstrap |

---

## 6. Testing Strategy

### 1. Engine Invariant Tests (`src/engine/engine.test.ts`)
Run automatically via `npm test`:
- **Test 1:** `never suggests laundry items` (verifies items with `status: 'in_laundry'` are omitted).
- **Test 2:** `never suggests items needing washing` (verifies items with `status: 'needs_washing'` are omitted).
- **Test 3:** `saree always has blouse` (verifies saree template fails if blouse is missing).
- **Test 4:** `no outfit has two bottoms` (verifies combinations never duplicate bottom garments).
- **Test 5:** `western dress requires footwear` (verifies dress template requires shoes).
- **Test 6:** `kurta look supports valid bottoms` (palazzo, churidar, jeans, trousers, leggings).
- **Test 7:** `indo-western pairs kurta with jeans/trousers and sneakers/flats`.
- **Test 8:** `office respects formality threshold` (penalizes formality < 3).
- **Test 9:** `wedding/Diwali/puja prioritizes ethnic wear over casual tees`.
- **Test 10:** `tiny wardrobe returns empty array safely without throwing`.
- **Test 11:** `recent wear penalty reduces outfit score`.
- **Test 12:** `favorite bonus increases outfit score`.
- **Test 13:** `smart-buy simulation accurately computes outfit delta`.

### 2. Build & TypeScript Verification
- Run `npm run build` (`tsc -b && vite build`) to verify 0 type errors and successful production artifact generation.

### 3. Manual Responsive & UX Checklist (390 × 844)
1. **Fresh load:** Opens Onboarding screen.
2. **Onboarding:** Step through 3 screens, select "Indo-western" vibe, tap "Load sample Indian wardrobe".
3. **Wardrobe:** Verify 2-column grid, tap category chips (Tops, Bottoms, Ethnic), search "jeans".
4. **Item Detail:** Tap an item, switch status to "In Laundry", verify badge changes and item is excluded from Dress Me.
5. **Add Item:** Tap "+ Add Item", upload a photo, observe compression, confirm suggested auto-tags, save piece.
6. **Dress Me:** Select "College" and "Summer", view asymmetric outfit card, tap "+ Accessory" and attach watch, tap "Shuffle" for another look, tap "Wore this today".
7. **Gaps & Smart Buy:** Inspect category balance, view occasion coverage, view Smart Buy #1 with unlocked count, tap "See combinations".
8. **Dark Mode:** Tap theme toggle, verify all cards, text, and borders shift cleanly without contrast loss.
9. **Persistence:** Refresh browser; verify custom wardrobe items and preferences persist.

---

## 7. Risk Register & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Engine scoring regression** | High | Low | Port mathematical formulas verbatim. Run regression tests before and after decomposition. |
| **LocalStorage 5MB quota overflow from base64 photos** | High | Medium | Store photos in IndexedDB via `photoStore.ts`. Store only metadata in localStorage. |
| **Missing local image assets** | Medium | Low | `ClothingFallback` renders clean, category-aware SVG silhouettes with color badges. Never crash or show broken image. |
| **Mobile viewport clipping** | Medium | Low | Primary styling target is 390×844 with `safe-area-inset-bottom` padding on the sticky navigation. |
| **Safari IndexedDB private mode failure** | Low | Low | `photoStore.ts` detects private mode and falls back to memory cache with warning. |
| **Slow smart-buy simulation on large wardrobes** | Medium | Low | Memoize baseline outfit count and cap candidate combinations simulation to 25 items. |

---

## 8. Definition of Done

- [ ] **Architecture:** Clean 4-layer separation (UI, Hook/Service, Domain, Data) with repository abstraction.
- [ ] **UI:** Zero clothing emojis; real studio photography with `object-fit: contain` on neutral backgrounds.
- [ ] **UX:** Fast onboarding, effortless chip confirmation for add item, exciting asymmetric outfit reveals.
- [ ] **Engine:** 100% passing tests for all 13 invariants. Untouched rules-based scoring.
- [ ] **Smart Buy:** True candidate simulation calculating real unlocked outfit deltas.
- [ ] **Images:** 25 sample items mapped, canvas compression (max 800px, 0.78), graceful `ClothingFallback`.
- [ ] **Accessibility:** 44px+ touch targets, proper contrast, alt text, reduced motion support.
- [ ] **Performance:** Instant load, optimized memory, lazy loading, IndexedDB photo storage.
- [ ] **Testing:** `npm test` passes with 0 failures.
- [ ] **Build:** `npm run build` succeeds with 0 errors.
