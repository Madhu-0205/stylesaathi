# StyleSaathi Progressive Space UI Primitives Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Progressively integrate newly created StyleSaathi Space UI primitives (`Button`, `Badge`, `Card`, `Separator`, `AlertDialog`, `Tabs`, `Dialog`) across existing screens, replacing inconsistent ad-hoc styling and native browser `confirm()` dialogues while maintaining 100% regression-free fidelity with existing application layouts, data flow, responsive rules, and brand aesthetics.

**Architecture:** Incrementally elevate presentation elements screen by screen to use `@/components/ui` primitives while strictly preserving exact classnames, responsive grid definitions, and component hooks tested by vitest suites (`responsiveExperience.test.ts`, `logoAndLoader.test.ts`, etc.). Replace browser `confirm()` popups with accessible `AlertDialog` primitives.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Radix UI (via `radix-ui`), Vitest, Lucide React.

## Global Constraints

- Never alter underlying hooks, data stores, Supabase auth, or business logic.
- Preserve all responsive test tokens verified by `responsiveExperience.test.ts` (e.g. `grid-cols-2`, `md:grid-cols-3`, `min-h-11 min-w-11`, `md:hidden flex h-9 w-9`, `md:flex-wrap`, `md:col-span-5`, `THE ONE TO ADD`, `Local Wardrobe Privacy`).
- Maintain minimum 44px touch targets on mobile interactions.
- Ensure every change passes `npm run typecheck`, `npm run test`, and `npm run build`.

## Review Focus

1. **Dialog Accessibility & Touchability:** `AlertDialog` for item deletion and data resets must maintain clean backdrop click and keyboard Escape handling without leaking event propagation to parents.
2. **Responsive Breakpoints:** Grid classes on screens (`WardrobeScreen`, `GapsScreen`, `ProfileScreen`) must remain untouched to satisfy unit regression assertions.
3. **Button Sizing Consistency:** Primary actions on mobile viewports must maintain min 44px (`min-h-11`) touch heights.
4. **Theme Harmonization:** Components must automatically adjust to `.dark` without hardcoded colors.
5. **No Regressions in Test Suite:** All 19 test files (220 tests) must continue to pass after every step.

---

### Task 1: Integrate `Button` and `AlertDialog` into `ItemDetailSheet` and `WardrobeScreen`

**Files:**
- Modify: `src/components/wardrobe/ItemDetailSheet.tsx`
- Modify: `src/screens/WardrobeScreen.tsx`
- Test: `src/__tests__/responsiveExperience.test.ts`, `src/__tests__/spaceUiComponents.test.tsx`

- [ ] **Step 1: Inspect ItemDetailSheet and WardrobeScreen for ad-hoc button and confirm usage**
- [ ] **Step 2: Update `WardrobeScreen.tsx` "Add Piece" button with `Button` component**
  Keep `min-h-11 min-w-11` and `md:hidden flex h-9 w-9` intact.
- [ ] **Step 3: Update `ItemDetailSheet.tsx` delete confirmation with `AlertDialog`**
  Replace browser `window.confirm` with `AlertDialog` modal using `AlertDialogAction variant="destructive"`.
- [ ] **Step 4: Run typecheck and tests to verify no regressions**
  Run: `npm run typecheck && npm run test`
  Expected: PASS

---

### Task 2: Elevate `DressMeScreen` Actions and Badges

**Files:**
- Modify: `src/screens/DressMeScreen.tsx`
- Test: `src/__tests__/responsiveExperience.test.ts`

- [ ] **Step 1: Inspect `DressMeScreen.tsx` for shuffle action and tomorrow plan badge**
- [ ] **Step 2: Replace shuffle button with `Button variant="secondary" size="sm"`**
  Preserve `md:flex-wrap`, `md:mx-0`, and `md:hidden flex h-9 w-9`.
- [ ] **Step 3: Upgrade Tomorrow badge with `Badge variant="gold"`**
- [ ] **Step 4: Run tests to verify zero regressions**
  Run: `npm run test`
  Expected: PASS

---

### Task 3: Elevate `CalendarScreen` Badges, Actions, and Delete Confirmation

**Files:**
- Modify: `src/screens/CalendarScreen.tsx`
- Test: `src/__tests__/v4PersonalizationAndCalendar.test.ts`

- [ ] **Step 1: Inspect `CalendarScreen.tsx` plan details and actions**
- [ ] **Step 2: Replace status and occasion tags with `Badge` primitive**
- [ ] **Step 3: Replace delete plan button with `AlertDialog` confirmation**
- [ ] **Step 4: Upgrade empty day and style action with `Button` primitive**
- [ ] **Step 5: Run tests to verify calendar workflows**
  Run: `npm run test`
  Expected: PASS

---

### Task 4: Elevate `GapsScreen` Cards and Badges

**Files:**
- Modify: `src/screens/GapsScreen.tsx`
- Test: `src/__tests__/responsiveExperience.test.ts`

- [ ] **Step 1: Inspect `GapsScreen.tsx` gap diagnosis section**
- [ ] **Step 2: Elevate gap label with `Badge variant="gold"`**
  Ensure `THE ONE TO ADD`, `md:col-span-5`, `md:col-span-7`, and `md:grid-cols-12` are strictly preserved.
- [ ] **Step 3: Run tests to verify responsive layout matches**
  Run: `npm run test`
  Expected: PASS

---

### Task 5: Upgrade `ProfileScreen` Reset Actions with `AlertDialog`

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`
- Test: `src/__tests__/responsiveExperience.test.ts`, `src/__tests__/authAndSession.test.ts`

- [ ] **Step 1: Replace browser `confirm()` in `handleResetWardrobe` with `AlertDialog`**
- [ ] **Step 2: Replace browser `confirm()` in `handleResetAll` with `AlertDialog`**
- [ ] **Step 3: Elevate "Reload Sample Indian Wardrobe" button with `Button` primitive**
- [ ] **Step 4: Run tests to verify profile and archive flows**
  Run: `npm run test`
  Expected: PASS

---

### Task 6: Elevate `OnboardingScreen` and `WardrobeSetupScreen` Buttons and Progress Badges

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`
- Modify: `src/screens/WardrobeSetupScreen.tsx`
- Test: `src/__tests__/logoAndLoader.test.ts`, `src/__tests__/responsiveExperience.test.ts`

- [ ] **Step 1: Update `OnboardingScreen` slide navigation buttons with `Button` primitive**
  Preserve `max-w-lg md:max-w-xl mx-auto` and `StyleSaathiLogo showSince={true}`.
- [ ] **Step 2: Update `WardrobeSetupScreen` action buttons with `Button` primitive and milestones with `Badge`**
- [ ] **Step 3: Run full verification suite**
  Run: `npm run typecheck && npm run test && npm run build`
  Expected: PASS
