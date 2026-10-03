# StyleSaathi

Mobile-first React + TypeScript + Tailwind prototype for a personal wardrobe assistant.

## Run
```bash
npm install
npm run dev
npm test
npm run build
```

## Architecture
- `src/types.ts` — shared data model.
- `src/engine/engine.ts` — pure, browser-safe outfit engine and buying simulation.
- `src/engine/engine.test.ts` — Vitest coverage for core rules.
- `src/context/AppContext.tsx` — localStorage data layer; replace these functions with a backend adapter later.
- `src/data/sample.ts` — ~25-item Indian demo wardrobe.
- `src/data/candidates.ts` — static Smart Buy candidate catalog and Indian price ranges.
- `autoTagImage(file)` lives in `src/main.tsx` as the explicit seam for a future vision model API. It is intentionally mocked today.

## Product scope
The prototype intentionally excludes chat, trends, social, weather, skin-tone advice and affiliate links. No paid APIs are used.

## Vision API seam
Replace `autoTagImage(file)` with a call to a future backend/vision service that returns `{category, color, style}`. Keep the confirmation/tweak UI so users can correct model suggestions.

## Backend seam
The UI only depends on the `useApp()` context methods (`addItem`, `updateItem`, `loadSample`, etc.). A future repository/service can implement those methods against Supabase/Postgres or another backend without changing screen components.
