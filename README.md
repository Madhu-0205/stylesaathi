# StyleSaathi

StyleSaathi is a mobile-first personal stylist for teenagers and young people in India.
Users add the clothes they own, get complete outfits (Western, ethnic and Indo-western) using only those items, and see which single piece to buy next to unlock the most new outfits.

## Live Demo
- Deployed URL: [https://TODO-add-deployed-url](https://TODO-add-deployed-url)

![StyleSaathi Demo](docs/media/demo.gif)

## Features
- **Visual Digital Wardrobe:** Fast 2-column image gallery with category filters, laundry status tracking (`clean`, `needs_washing`, `in_laundry`), and favorite toggles.
- **Smart Photo Addition:** Camera or image upload with automatic client-side JPEG compression, auto-tagging seam, and interactive tag refinement chips.
- **"Aaj kya pehenna hai?" (Dress Me):** Culturally authentic outfit generation covering Western, Ethnic (kurta, kurti, saree, lehenga), and Indo-Western pairings across Indian occasions (College, Office, Date, Casual Outing, Puja, Diwali, Wedding Guest) and seasons (Summer, Monsoon, Winter).
- **Accessory Drawer:** Context-sensitive accessory pairing (dupatta, jewellery, watch, bag, footwear) with one-tap swapping.
- **Wear Tracking & Variety Penalty:** "Wore this today" tracking with wear decay penalties to prevent repetitive daily suggestions.
- **Wardrobe Gaps & Smart Buy Engine:** In-browser combinatorial simulation that evaluates candidate catalog items against current wardrobe pieces and ranks which single purchase unlocks the highest number of new looks.
- **Local-First Privacy:** Zero remote data transfer; wardrobe metadata is stored in browser localStorage and photos are stored in IndexedDB.

## Getting Started
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Vitest test suite
npm test

# Build production bundle
npm run build
```

## Architecture
- `src/types.ts` — Core data models, Indian fashion taxonomy, and repository interfaces.
- `src/engine/engine.ts` — Pure, deterministic, browser-safe outfit generator and buying simulation.
- `src/engine/engine.test.ts` — Vitest unit tests covering wardrobe pairing invariants, laundry filters, and scoring logic.
- `src/repositories/` — Abstract repository interfaces and implementations (`LocalStorageWardrobeRepository`).
- `src/services/imageStore.ts` — IndexedDB image persistence service with memory-safe object URL caching (`idb-keyval`).
- `src/services/autoTag.ts` — `autoTagImage(file)` seam for real vision model APIs (currently mocked with heuristic tags).
- `src/context/WardrobeContext.tsx` & `src/context/AppContext.tsx` — Global state management and backward-compatibility provider.
- `src/data/sample.ts` — 25-piece realistic Indian wardrobe dataset with intentional category gaps.
- `src/data/candidates.ts` — Static catalog of Smart Buy candidates with estimated Indian price ranges.
- `src/screens/` & `src/components/` — Mobile-first editorial UI components.

## Deploy
Deploy easily to Vercel or Netlify:
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **SPA routing:** Configured in `vercel.json` with wildcard rewrites to `/index.html`.

## Known Limitations
- **Auto-tagging is mocked:** Categorization currently uses filename heuristics and simulated confidence scores; replace `src/services/autoTag.ts` with a real vision API in production.
- **Local browser storage:** Data lives only in this browser via localStorage and IndexedDB; there are no cloud accounts or cross-device synchronization.
- **Cache clearing deletes data:** Clearing browser data, history, or local storage will delete your wardrobe items and photos.
- **Heuristic outfit rules:** Outfit pairing rules are heuristic and rule-based rather than personalized machine learning models.
- **No external integrations:** There are currently no real-time weather feeds, live shopping links, or social trend scrapers.
- **DPDP Act compliance:** Not yet reviewed for compliance with India's Digital Personal Data Protection (DPDP) Act; do not open this application to under-18 users without implementing a verified parental consent flow.

## Roadmap
- Cloud synchronization and user accounts with end-to-end data encryption.
- Integration with multimodal vision APIs (e.g., Gemini Vision) for automatic color palette and fabric extraction.
- India DPDP Act-compliant parental consent verification flow.
- Direct e-commerce links and price tracking for Smart Buy candidate recommendations.
- Weather and festival-based intelligent morning outfit suggestions.
