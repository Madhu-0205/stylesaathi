# StyleSaathi — Premium Indian Digital Wardrobe Redesign Spec

**Date:** 2026-10-03  
**Status:** In Review  
**Target Device Profile:** Mobile-first (390 × 844 viewport primary, centered desktop container max-width 430px)

---

## 1. Executive Summary & Vision

StyleSaathi is transformed from a basic wardrobe CRUD demo into a **warm, editorial, Indian-first digital wardrobe and personal stylist**. Inspired by the high visual quality, calm minimalism, and fluid interaction model of top-tier wardrobe apps (such as Acloset), StyleSaathi builds a unique identity tailored specifically for Indian life (Indo-western, ethnic, festive, college, office, monsoon/summer/winter).

### Core Principles
1. **Image-First Fashion Language:** Zero clothing emojis (`👕`, `👖`, `👗`, `👟`, `👜`, etc.). Every wardrobe piece is represented by clean, studio-lit flat-lay or catalog photography on warm neutral backgrounds (`object-fit: contain`).
2. **Graceful Degradation:** When an image is absent, `ClothingFallback` renders a minimalist editorial silhouette with category tags and garment colorway—never an emoji or broken link.
3. **Preserved Pure Engine:** The rules-based outfit engine (`generateOutfits`, `simulateBuy`, color harmony, formality, laundry exclusion, saree+blouse enforcement, wear penalty) is preserved and refactored into modular, testable files.
4. **Clean Decoupled Architecture:** Business logic is lifted out of UI components into custom hooks (`useWardrobe`, `useDressMe`, `useSmartBuys`) and abstracted behind a `WardrobeRepository` interface with `LocalStorageWardrobeRepository` implementation.
5. **Fluid Indian Styling Experience:** "Aaj kya pehenna hai?" hero flow with asymmetric editorial outfit cards, animated reveal, accessory swapping, shuffle, and smart-buy combination insights.

---

## 2. Architecture & File Layout

```text
src/
├── types.ts                               # Unified domain types, taxonomies, repository interfaces
├── repositories/
│   ├── WardrobeRepository.ts              # Abstract data contract
│   └── LocalStorageWardrobeRepository.ts  # LocalStorage / IndexedDB implementation
├── engine/
│   ├── outfitTemplates.ts                 # Template definitions (Western, Kurta look, Saree, etc.)
│   ├── compatibility.ts                   # Slot matching rules
│   ├── scoring.ts                         # Color harmony, formality, favorite bonus, wear penalty
│   ├── outfitEngine.ts                    # generateOutfits, simulateBuy, signature generator
│   ├── index.ts                           # Public engine façade (backwards compatible)
│   └── __tests__/
│       └── engine.test.ts                 # Full suite of unit & scenario tests
├── context/
│   └── WardrobeContext.tsx                # React context wrapping WardrobeRepository & user settings
├── hooks/
│   ├── useWardrobe.ts                     # Filtered items, search, category counts, status counts
│   ├── useDressMe.ts                      # Outfit generation, shuffle, accessories, wear logger
│   └── useSmartBuys.ts                    # Simulation ranking, combinations generator
├── data/
│   ├── taxonomy.ts                        # Categories, subcategories, seasons, occasions, palettes
│   ├── sampleWardrobe.ts                  # 25 realistic sample items with asset mappings & gaps
│   └── candidates.ts                      # 25–30 candidate purchase items for smart-buy simulation
├── components/
│   ├── common/
│   │   ├── Header.tsx                     # Top bar with logo, screen title, theme toggle
│   │   ├── Chip.tsx                       # Horizontal pill buttons (min 44px touch)
│   │   ├── BottomSheet.tsx                # Slide-up modal overlay with backdrop
│   │   ├── ClothingFallback.tsx           # Editorial silhouette placeholder for un-photographed items
│   │   ├── EmptyState.tsx                 # Styled zero-state with tailored action buttons
│   │   └── LazyImage.tsx                  # Image wrapper with fade-in and fallback handling
│   ├── navigation/
│   │   └── BottomNav.tsx                  # 4-tab sticky footer (Wardrobe, Dress Me, Gaps, Profile)
│   ├── wardrobe/
│   │   ├── ItemCard.tsx                   # 2-column image-forward card with status & favorite
│   │   ├── ItemDetailSheet.tsx            # Full item inspection, laundry switch, wear counter, delete
│   │   └── AddItemSheet.tsx               # Upload/capture, compression, auto-tag chips confirmation
│   ├── dressme/
│   │   ├── OutfitCard.tsx                 # Editorial staggered layout, why-it-works copy, action buttons
│   │   └── AccessoryDrawer.tsx            # Bottom sheet to cycle/add compatible accessories
│   └── gaps/
│       ├── CategoryBalanceBar.tsx         # Visual distribution bar with category thumbnails
│       ├── OccasionCoverageList.tsx       # Occasion readiness indicators calculated from engine
│       ├── SmartBuyCard.tsx               # Rank, item photo, outfit unlock count, price estimate
│       └── CombinationsModal.tsx          # Gallery showing what new outfits this item unlocks
├── screens/
│   ├── OnboardingScreen.tsx               # 3-step visual intro + vibe picker + sample load
│   ├── WardrobeScreen.tsx                 # Search, category pills, 2-col clothing grid
│   ├── DressMeScreen.tsx                  # Occasion pills, season pills, outfit reveal stream
│   ├── GapsScreen.tsx                     # Category balance, occasion coverage, smart buy ranked cards
│   └── ProfileScreen.tsx                  # Wardrobe stats, appearance toggle, reset, privacy notice
├── assets/
│   └── wardrobe/                          # Cohesive studio flat-lay photos on neutral background
│       ├── tops/                          # white-tee, black-tee, sky-blue-shirt, cream-linen-shirt, olive-crop
│       ├── bottoms/                       # blue-straight-jeans, black-trousers, beige-trousers, olive-joggers
│       ├── ethnic/                        # white-kurta, indigo-kurti, cream-palazzo, white-churidar, mustard-dupatta, black-saree, pink-blouse, navy-lehenga
│       ├── dresses/                       # floral-midi-dress, black-coord-set
│       ├── outerwear/                     # denim-jacket, black-blazer
│       ├── footwear/                      # white-sneakers, black-flats, embroidered-juttis, brown-sandals
│       └── accessories/                   # canvas-tote, everyday-watch, gold-jewellery-set
├── utils/
│   ├── imageCompressor.ts                 # Canvas resize (max 800px) & JPEG 0.78 compression
│   └── autoTagger.ts                      # Vision model integration seam with typed confidence score
├── index.css                              # Design tokens, CSS variables, dark mode, keyframes
├── App.tsx                                # Screen router / Shell
└── main.tsx                               # DOM mount
```

---

## 3. Data Models & Taxonomies

### Core Types (`src/types.ts`)
```ts
export type Category =
  | 'Tops'
  | 'Bottoms'
  | 'Ethnic'
  | 'Dresses'
  | 'Outerwear'
  | 'Footwear'
  | 'Accessories';

export type Subcategory =
  | 't-shirt' | 'shirt' | 'crop top' | 'hoodie' | 'sweater'
  | 'jeans' | 'trousers' | 'shorts' | 'skirt' | 'leggings' | 'joggers'
  | 'kurta' | 'kurti' | 'saree' | 'blouse' | 'lehenga' | 'salwar set'
  | 'sherwani' | 'palazzo' | 'churidar' | 'dupatta' | 'nehru jacket'
  | 'western dress' | 'co-ord set'
  | 'jacket' | 'blazer' | 'shrug'
  | 'sneakers' | 'formal shoes' | 'heels' | 'flats' | 'sandals' | 'juttis' | 'kolhapuris'
  | 'bag' | 'watch' | 'jewellery' | 'belt' | 'sunglasses' | 'scarf';

export type Season = 'summer' | 'monsoon' | 'winter';

export type Occasion =
  | 'college'
  | 'office'
  | 'casual outing'
  | 'date'
  | 'party'
  | 'family function'
  | 'wedding guest'
  | 'Diwali'
  | 'Holi'
  | 'Eid'
  | 'puja'
  | 'travel';

export type Status = 'clean' | 'needs_washing' | 'in_laundry';

export interface WardrobeItem {
  id: string;
  name: string;
  photo: string | null;
  category: Category;
  subcategory?: Subcategory;
  colors: string[];
  seasons: Season[];
  occasions: Occasion[];
  formality: 1 | 2 | 3 | 4 | 5;
  brand?: string;
  status: Status;
  favorite: boolean;
  note?: string;
  timesWorn: number;
  createdAt?: number;
}

export interface GeneratedOutfit {
  id: string;
  template: string;
  slots: Record<string, WardrobeItem[]>;
  score: number;
  why: string;
}

export interface SavedOutfit {
  id: string;
  name?: string;
  outfit: GeneratedOutfit;
  savedAt: number;
}
```

### Repository Interface (`src/repositories/WardrobeRepository.ts`)
```ts
export interface WardrobeRepository {
  getItems(): Promise<WardrobeItem[]>;
  getItem(id: string): Promise<WardrobeItem | null>;
  addItem(item: WardrobeItem): Promise<void>;
  updateItem(id: string, patch: Partial<WardrobeItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getSavedOutfits(): Promise<SavedOutfit[]>;
  saveOutfit(outfit: GeneratedOutfit): Promise<void>;
  deleteSavedOutfit(id: string): Promise<void>;
  clear(): Promise<void>;
}
```

---

## 4. Design System & CSS Variables

### Palette Tokens (`src/index.css`)
```css
:root {
  --background: #F8F5F0;
  --cream: #FFFDFC;
  --card: #FFFFFF;
  --text: #181515;
  --muted: #77716D;
  --border: #E8E1DB;
  --accent: #B32663;
  --accent-light: #FBEAF1;
  --accent-foreground: #FFFFFF;
  --success: #2E7D32;
  --warning: #ED6C02;
  --danger: #D32F2F;
}

.dark {
  --background: #151313;
  --cream: #1C1919;
  --card: #211D1D;
  --text: #F7F2EE;
  --muted: #A39D98;
  --border: #332B2B;
  --accent: #E0357F;
  --accent-light: #3D1426;
  --accent-foreground: #FFFFFF;
  --success: #4CAF50;
  --warning: #FFA726;
  --danger: #EF5350;
}
```

### Typography & Spacing
- Heading Font: Inter / Outfit / System Display, confident, uppercase micro-labels (`tracking-wider text-[11px] font-semibold text-[var(--muted)]`).
- Body Font: Highly legible, generous line height.
- Minimum interactive touch area: 44px × 44px (`min-h-[44px] min-w-[44px]`).
- Corner Radii: Cards `rounded-3xl` (24px), Bottom sheets `rounded-t-[32px]`, Chips `rounded-full`.
- Animations: Slide-up sheet transition, subtle image fade-in, favorite heart scale bounce, outfit card stagger.

---

## 5. Screen & Feature Specifications

### 1. Onboarding (`OnboardingScreen`)
- **Step 1:** Large visual hero illustration/image. Headline: "Your wardrobe. Your style." Subtitle: "StyleSaathi turns what you already own into complete outfits."
- **Step 2:** Indian styling hero. Headline: "Dress for the moment." Subtitle: "College. Office. Date night. Diwali. Weddings. Everything in between."
- **Step 3:** Smart buying hero. Headline: "Buy smarter." Subtitle: "See which single piece can unlock the most new outfits."
- **Style Vibe Selection:** Tappable chips (`Casual`, `Ethnic-loving`, `Indo-western`, `Minimal`).
- **Actions:** Prominent "Load Sample Wardrobe" CTA or "Start Empty".

### 2. Wardrobe (`WardrobeScreen`)
- **Header:** "My Wardrobe" with count badge (e.g. `24 pieces · 4 favorites`), quick "+ Add Item" action, and dark mode toggle.
- **Search & Filter Bar:**
  - Modern search input with Lucide `Search` icon.
  - Horizontally scrolling category chips (`All`, `Tops`, `Bottoms`, `Ethnic`, `Dresses`, `Footwear`, `Accessories`).
  - Secondary filter pills: Status (`Clean`, `Needs Washing`, `Laundry`), Favorites (`Favorites only`).
- **Clothing Grid:**
  - Responsive 2-column grid at 390px, expanding to 3 columns on tablet/desktop.
  - Real studio imagery with `object-fit: contain` on neutral card background.
  - Status indicator badge (Ready / Wash / Laundry) and Lucide `Heart` toggle.
  - Tap card opens `ItemDetailSheet`.
- **Tiny Wardrobe Banner:** Displays if `< 5` usable pieces, offering encouragement without blocking features.

### 3. Add Item Experience (`AddItemSheet`)
- Bottom sheet slide-up.
- **Photo Upload / Camera Capture:**
  - Large drag-and-drop or tap target with Lucide `Camera` and `Upload` icons.
  - Instant client-side preview.
  - Automatic canvas resizing to max 800px & JPEG 0.78 compression.
- **Auto-Tag Seam (`autoTagImage`):**
  - "Looks like..." feedback panel.
  - Suggests category, subcategory, primary color, occasion, and formality.
  - User can tap any suggested chip to confirm or tweak without filling long forms.
- **Error Handling:** If an image fails to load or process, a friendly banner appears: "Couldn't add this photo. Try another image."

### 4. Item Detail Sheet (`ItemDetailSheet`)
- Large image preview with `object-fit: contain`.
- Item name, category, subcategory, color badges, formality rating (1–5 dots).
- Status toggles: `Clean`, `Needs Washing`, `In Laundry`.
- Times worn counter with `+1 wear` quick button.
- User notes input.
- Favorite button toggle.
- Delete button with confirmation modal.

### 5. Dress Me Hero (`DressMeScreen`)
- **Hero Title:** "Aaj kya pehenna hai?"
- **Occasion Selector:** Horizontally scrolling chips for all Indian occasions (`College`, `Office`, `Casual Outing`, `Date`, `Party`, `Family Function`, `Wedding Guest`, `Diwali`, `Holi`, `Eid`, `Puja`, `Travel`).
- **Season Selector:** `Summer`, `Monsoon`, `Winter`.
- **Action CTA / Shuffle:** Lucide `Shuffle` with microcopy "Another look ✨".
- **Outfit Card (`OutfitCard`):**
  - Editorial asymmetric visual arrangement (e.g., prominent top/dress, side-by-side bottom and footwear, optional layered outerwear/dupatta).
  - Editorial styling note (`why`: "Neutral base with relaxed silhouettes makes this easy for a full college day.").
  - Accessory section with `+ Add / Change Accessory` triggering `AccessoryDrawer`.
  - Actions: `Wore this today` (increments `timesWorn` on all items, penalizing immediate re-wear in future scoring) and `Save Look`.
- **Empty State:** If not enough pieces are clean for the selected occasion/season, displays an intentional empty state guiding the user to clean items or add missing pieces.

### 6. Wardrobe Gaps & Smart Buy (`GapsScreen`)
- **Header:** "Your wardrobe, decoded" / "Complete your wardrobe".
- **Category Balance:** Interactive visual distribution bars with piece counts and representative thumbnails.
- **Occasion Coverage:** Calculates actual readiness for each occasion using the outfit engine (Ready vs. Needs more pieces).
- **Smart Buy Simulation:**
  - Simulates 25–30 realistic candidate additions across seasons.
  - Computes `count = simulateBuy(items, candidate, occasions, season)`.
  - Sorts candidates by highest new outfit combinations unlocked.
  - Card shows item image, name, unlocked combinations badge (e.g. `+12 new outfits`), estimated price range, and reason why.
  - Tap card opens `CombinationsModal` showcasing the specific new outfits unlocked by this single piece.

### 7. Profile & Settings (`ProfileScreen`)
- Wardrobe analytics summary: Total pieces, saved looks count, total wear count, favorites count.
- Most worn piece highlight.
- Style vibe preferences (editable).
- Appearance toggle (Light / Dark).
- Action buttons: "Load sample Indian wardrobe", "Reset wardrobe", "Reset all data".
- Privacy notice: "Your wardrobe photos stay on this device in the MVP."

---

## 6. Sample Wardrobe Dataset & Image Assets

The sample dataset comprises 25 coherent Indian + Western fashion items with deliberate wardrobe gaps (e.g., fewer bottoms than tops, missing wedding combination) to showcase the Gaps engine:

| ID | Name | Category | Subcategory | Colors | Formality | Occasions |
|---|---|---|---|---|---|---|
| `sample-white-tee` | White relaxed tee | Tops | t-shirt | white | 2 | college, casual outing, date |
| `sample-black-tee` | Black oversized tee | Tops | t-shirt | black | 2 | college, casual outing |
| `sample-blue-shirt` | Sky blue shirt | Tops | shirt | blue | 3 | college, office, date, travel |
| `sample-cream-shirt`| Cream linen shirt | Tops | shirt | cream | 3 | college, office, date, travel |
| `sample-olive-crop` | Olive crop top | Tops | crop top | olive | 2 | college, casual outing, date |
| `sample-blue-jeans` | Blue straight jeans | Bottoms | jeans | blue | 2 | college, casual outing, date |
| `sample-black-trousers`| Black trousers | Bottoms | trousers | black | 4 | office, party, date, family |
| `sample-beige-pants`| Beige trousers | Bottoms | trousers | beige | 3 | office, college, casual outing |
| `sample-olive-joggers`| Olive joggers | Bottoms | joggers | olive | 2 | college, travel, casual outing |
| `sample-white-kurta`| White cotton kurta | Ethnic | kurta | white | 3 | puja, family, college, Diwali |
| `sample-blue-kurti` | Indigo kurti | Ethnic | kurti | blue | 3 | college, casual outing, puja |
| `sample-cream-palazzo`| Cream palazzo | Ethnic | palazzo | cream | 2 | casual outing, puja, family |
| `sample-white-churidar`| White churidar | Ethnic | churidar | white | 3 | family, wedding guest, Diwali |
| `sample-mustard-dupatta`| Mustard dupatta | Ethnic | dupatta | mustard | 3 | family, Diwali, puja |
| `sample-black-saree`| Black saree | Ethnic | saree | black | 5 | party, wedding guest, Diwali |
| `sample-pink-blouse`| Pink blouse | Ethnic | blouse | pink | 4 | party, wedding guest, Diwali |
| `sample-navy-lehenga`| Navy lehenga | Ethnic | lehenga | navy | 5 | wedding guest, Diwali, family |
| `sample-floral-dress`| Floral midi dress | Dresses | western dress | pink, cream | 3 | date, party, casual outing |
| `sample-black-coord`| Black co-ord set | Dresses | co-ord set | black | 3 | date, party, travel |
| `sample-denim-jacket`| Denim jacket | Outerwear | jacket | blue | 3 | college, casual outing, travel |
| `sample-black-blazer`| Black blazer | Outerwear | blazer | black | 4 | office, party, date |
| `sample-white-sneakers`| White sneakers | Footwear | sneakers | white | 2 | college, casual outing, travel |
| `sample-black-flats`| Black flats | Footwear | flats | black | 3 | office, date, family, puja |
| `sample-juttis` | Embroidered juttis | Footwear | juttis | mustard, pink | 4 | wedding guest, Diwali, puja |
| `sample-brown-sandals`| Brown sandals | Footwear | sandals | brown | 2 | college, casual outing, travel |
| `sample-tote` | Canvas tote | Accessories | bag | cream | 1 | college, casual outing, travel |
| `sample-watch` | Everyday watch | Accessories | watch | black, silver | 2 | college, office, date, travel |
| `sample-gold-jewellery`| Gold jewellery set | Accessories | jewellery | gold | 4 | wedding guest, Diwali, puja |

All assets are organized under `src/assets/wardrobe/{category}/` with cohesive lighting, framing, and clean neutral backgrounds.

---

## 7. Outfit Engine Invariants & Test Coverage

The refactored `src/engine/` maintains 100% test passing for all required business invariants:
1. **Laundry Exclusion:** Items marked `in_laundry` or `needs_washing` must NEVER be included in any generated outfit.
2. **Saree Requires Blouse:** Any Saree look template requires both a saree and a blouse piece.
3. **Single Bottom Rule:** Outfits must never contain multiple bottom garments.
4. **Western Dress Footwear Rule:** A dress look must include footwear.
5. **Indo-Western Compatibility:** Kurtas/kurtis correctly match with jeans, trousers, sneakers, and flats.
6. **Formality & Occasion Alignment:** Formal occasions (office, wedding guest, Diwali) penalize low-formality garments; casual occasions penalize overly formal garments.
7. **Favorite Boost:** Items marked `favorite: true` receive a score bonus (+0.7).
8. **Wear Penalty:** Recently worn garments receive a wear penalty (-0.08 * timesWorn up to 6) to keep outfit suggestions varied.
9. **Smart Buy Simulation:** Correctly computes the delta of newly unlocked outfits when simulating candidate additions.
10. **Tiny Wardrobe Safeguard:** Returns empty list gracefully without throwing errors or fabricating fictional items when wardrobe size is small.

---

## 8. Verification Plan & Quality Gates

Before declaring completion, the following commands will be run and verified:
1. `npm test` — Vitest unit and integration test suite (must pass with 0 failures).
2. `npm run build` — TypeScript compile (`tsc -b`) and Vite production bundle (must succeed with 0 errors).
3. **Manual Mobile 390×844 Quality Check:**
   - Navigating through all 4 bottom tabs.
   - Uploading a photo and verifying canvas compression & auto-tag chips.
   - Adding, filtering, favoriting, and changing laundry status of clothes.
   - Generating looks across College, Wedding Guest, Diwali, Office, and shuffling.
   - Adding and swapping accessories in `AccessoryDrawer`.
   - Logging "Wore this today" and confirming wear counter increment.
   - Reviewing Category Balance and Smart Buy unlock cards in Gaps screen.
   - Switching between Light and Dark mode.
   - Verifying persistence across page refresh in localStorage.
