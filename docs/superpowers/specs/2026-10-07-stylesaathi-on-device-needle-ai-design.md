# StyleSaathi On-Device Needle 3 AI Integration — Architecture Specification

**Document Version:** 1.0.0  
**Date:** 2026-10-07  
**Status:** In Review  
**Target Systems:** StyleSaathi Web Application (Vite + React + TypeScript + IndexedDB + Supabase)  
**Reference Model:** Cactus Compute Needle 3 (`needle3.cact`, 121M parameters, Simple Attention Network)  
**Runtime:** `needle-rs` WASM Runtime (`needle_wasm.js` + `needle_wasm_bg.wasm`)

---

## 1. Executive Summary & Goals

StyleSaathi is a local-first wardrobe curation and outfit recommendation system for South Asian and contemporary styling. To provide private, ultra-low-latency, and offline-capable natural language command execution, we integrate **Cactus Compute Needle 3** as an on-device intent and tool-calling layer.

### Core User Flow
```
User: "Show me something casual for college."
  │
  ▼
Needle 3 (runs 100% on-device inside WebAssembly worker; zero cloud LLM calls)
  │
  ▼
Structured Tool Call:
{ "name": "recommend_outfit", "arguments": { "occasion": "college", "style": "casual" } }
  │
  ▼
Confidence & Safety Gating (Score ≥ 0.80 → Auto-execute; 0.50–0.79 → User Confirmation; < 0.50 → Reject)
  │
  ▼
Existing StyleSaathi Domain Engines (generateOutfits, WardrobeContext, Style Calendar)
  │
  ▼
Curated Outfit Recommendation Rendered in Existing Luxury Editorial UI
```

### Strict Architectural Principles
1. **Zero Cloud AI / LLM Calls:** All natural-language queries are parsed entirely on-device by Needle 3. No user query leaves the browser.
2. **Strict Tool Separation of Concerns:** Needle is exclusively an **intent parser and argument extractor**. Needle **never** touches Supabase, IndexedDB directly, authentication credentials, repositories, file storage, or sync queues.
3. **Domain Engine Preservation:** All execution passes through StyleSaathi's existing domain layer (`generateOutfits`, `WardrobeContext`, `calendarRepository`, etc.).
4. **Safety & Destructive Guards:** Destructive actions (e.g., deletion, wardrobe clearing) or ambiguous commands **never** execute automatically, requiring explicit modal confirmation.
5. **Offline Capability:** Once the `.cact` weights are cached in client-side storage, the app performs full inference with **Internet OFF**.

---

## 2. Needle WASM Runtime & Model Architecture

### 2.1 The Official Needle 3 WASM Interface (`needle-rs`)
Needle 3 inference is powered by the official `needle-rs` WebAssembly engine (`needle-rs@0.3.1`). The engine exports:
```typescript
// Core WASM exports
export default function __wbg_init(module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;

export class NeedleV3Wasm {
  /** Loads model weights from binary .cact container */
  static load(cact_bytes: Uint8Array): NeedleV3Wasm | undefined;
  /** Shallow rung loading for memory-constrained environments */
  static load_with_depth(cact_bytes: Uint8Array, depth: number): NeedleV3Wasm | undefined;
  
  /** Generates structured tool-call payload string */
  run_json(query: string, tools_json: string): string;
  
  /** Full text generation including optional <think> reasoning tokens */
  run(query: string, tools_json: string): string;
  
  /** Evaluates confidence head probability in (0, 1) for a completed tool call */
  confidence_for(query: string, tools_json: string, completion: string): number | undefined;
  
  /** Returns whether this checkpoint contains a confidence head */
  has_confidence(): boolean;
  
  free(): void;
}

export function extract_tool_call_v3(text: string): string | undefined;
```

### 2.2 Model Weight Specifications
- **Model File:** `needle3.cact` (~35.3 MB).
- **Architecture:** Simple Attention Network (SAN), 20 layers, Walsh-Hadamard gating, CQ2-bit quantization.
- **Upstream Source:** `https://huggingface.co/Cactus-Compute/needle3/resolve/main/needle3.cact` with fallback mirror.
- **Confidence Head:** Trained confidence scoring head evaluating `P(correct | query, tools, completion)`. Shipped weights evaluate correct calls at ~0.93 and incorrect/hallucinated matches at ~0.26.

---

## 3. Web Worker Architecture & Communication Protocol (`needleWorker.ts`)

Inference on deep transformer layers requires matrix calculations that must not block the main browser thread. All WebAssembly compilation, weight hydration, and inference occur inside a dedicated Web Worker (`src/services/needle/needleWorker.ts`).

### 3.1 Worker Message Protocol
Messages exchanged over `postMessage` adhere to strictly typed discriminated unions:

```typescript
// Messages from Main Thread -> Worker
export type NeedleWorkerInboundMessage =
  | { type: 'INIT_MODEL'; payload: { modelUrl?: string; forceReload?: boolean } }
  | { type: 'INFER'; payload: { id: string; query: string; toolsJson: string } }
  | { type: 'GET_STATUS' };

// Messages from Worker -> Main Thread
export type NeedleWorkerOutboundMessage =
  | { type: 'STATUS_UPDATE'; payload: { status: NeedleModelStatus; progress?: number; error?: string } }
  | { type: 'INFER_RESULT'; payload: {
      id: string;
      success: boolean;
      toolCall?: { name: string; arguments: Record<string, unknown> };
      confidence: number;
      reasoning?: string;
      error?: string;
    } };

export type NeedleModelStatus =
  | 'uninitialized'
  | 'checking_cache'
  | 'downloading'
  | 'loading_wasm'
  | 'ready'
  | 'error';
```

### 3.2 Model Cache Lifecycle & Offline Operation
```
                   [Worker Initializes]
                            │
                            ▼
           ┌────────────────────────────────┐
           │ Check IndexedDB Object Store   │
           │ (db: 'stylesaathi_needle',     │
           │  store: 'model_cache',         │
           │  key: 'needle3_weights')       │
           └───────────────┬────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼ Cached?                   ▼ Not Cached
    ┌─────────────────┐         ┌─────────────────────────┐
    │ Read Uint8Array │         │ Online?                 │
    │ directly from   │         │ If YES: Stream fetch    │
    │ IndexedDB       │         │ from CDN with progress; │
    │ (Works Offline) │         │ Save to IndexedDB.      │
    │                 │         │ If NO: Signal offline   │
    │                 │         │ deterministic fallback  │
    └────────┬────────┘         └────────────┬────────────┘
             │                               │
             ▼                               ▼
    ┌─────────────────────────────────────────────┐
    │ Instantiate NeedleV3Wasm.load(cact_bytes)   │
    │ Post STATUS_UPDATE: 'ready'                 │
    └─────────────────────────────────────────────┘
```

1. **Storage Mechanism:** IndexedDB database `stylesaathi_needle` with store `model_cache`. The raw `ArrayBuffer` of `needle3.cact` is stored alongside SHA256 integrity hash and timestamp.
2. **Offline-First:** On page load with Internet disconnected, IndexedDB delivers the weights immediately. Zero external network requests are dispatched.
3. **Progress Reporting:** When initial download is required, `ReadableStream` chunks compute download progress percentage and transmit `STATUS_UPDATE { progress: 0..100 }` to keep the user informed.
4. **Deterministic In-Memory Fallback:** In headless CI test environments (e.g. Node.js/jsdom in Vitest where WebAssembly thread pooling or IndexedDB binary blobs may be restricted), the worker seamlessly employs a local deterministic schema-matching engine producing exact tool signatures and confidence ratings.

---

## 4. The 5 Initial Tool Schemas (`needleSchemas.ts`)

The tool definitions passed to Needle 3 follow strict JSON Schema specifications:

### 4.1 `recommend_outfit`
Generates styling recommendations from the user's wardrobe for a specific event or aesthetic.
```json
{
  "name": "recommend_outfit",
  "description": "Generate an outfit recommendation based on occasion, style vibe, or weather season from the user's wardrobe.",
  "parameters": {
    "type": "object",
    "properties": {
      "occasion": {
        "type": "string",
        "description": "The occasion or event for the outfit.",
        "enum": [
          "college", "everyday", "office", "interview", "casual outing",
          "date", "party", "family function", "family gathering",
          "puja", "festive", "wedding guest", "celebration",
          "Diwali", "Holi", "Eid", "travel"
        ]
      },
      "style": {
        "type": "string",
        "description": "Desired aesthetic or vibe, e.g. casual, elegant, indo-western, minimal, bold, traditional."
      },
      "season": {
        "type": "string",
        "description": "Seasonal context.",
        "enum": ["summer", "monsoon", "winter"]
      }
    },
    "required": ["occasion"]
  }
}
```

### 4.2 `search_wardrobe`
Filters the user's garments by category, subcategory, color, or laundry status.
```json
{
  "name": "search_wardrobe",
  "description": "Search and filter garments in the user's wardrobe by category, color, subcategory, or status.",
  "parameters": {
    "type": "object",
    "properties": {
      "category": {
        "type": "string",
        "description": "Garment category.",
        "enum": ["Tops", "Bottoms", "Ethnic", "Dresses", "Outerwear", "Footwear", "Accessories"]
      },
      "color": {
        "type": "string",
        "description": "Color of the item (e.g., black, white, navy, red, gold, beige)."
      },
      "subcategory": {
        "type": "string",
        "description": "Specific garment type (e.g., kurta, jeans, sneakers, saree, blazer)."
      },
      "status": {
        "type": "string",
        "description": "Status of the garment.",
        "enum": ["clean", "needs_washing", "in_laundry"]
      }
    }
  }
}
```

### 4.3 `record_wear`
Logs a wear event for an item or outfit on a specific date.
```json
{
  "name": "record_wear",
  "description": "Record that an item or outfit was worn today or on a specified date.",
  "parameters": {
    "type": "object",
    "properties": {
      "itemName": {
        "type": "string",
        "description": "Name or keyword of the garment worn."
      },
      "date": {
        "type": "string",
        "description": "ISO date string (YYYY-MM-DD). Defaults to today if omitted."
      }
    },
    "required": ["itemName"]
  }
}
```

### 4.4 `create_style_plan`
Schedules an outfit for an upcoming date on the Style Calendar.
```json
{
  "name": "create_style_plan",
  "description": "Schedule and plan an outfit on the Style Calendar for a given date and occasion.",
  "parameters": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "ISO date string (YYYY-MM-DD) for the scheduled plan."
      },
      "occasion": {
        "type": "string",
        "description": "The occasion for the plan.",
        "enum": [
          "college", "everyday", "office", "interview", "casual outing",
          "date", "party", "family function", "family gathering",
          "puja", "festive", "wedding guest", "celebration",
          "Diwali", "Holi", "Eid", "travel"
        ]
      },
      "notes": {
        "type": "string",
        "description": "Optional notes or styling instructions."
      }
    },
    "required": ["date", "occasion"]
  }
}
```

### 4.5 `search_style_preferences`
Queries or views active user styling preferences, aesthetics, or context profiles.
```json
{
  "name": "search_style_preferences",
  "description": "Inspect or review current style preferences, active aesthetic vibes, and styling modes.",
  "parameters": {
    "type": "object",
    "properties": {
      "preferenceType": {
        "type": "string",
        "description": "Which preference attribute to query.",
        "enum": ["contexts", "aesthetics", "stylingMode", "all"]
      }
    }
  }
}
```

---

## 5. Confidence Gating & Safety Architecture

```
                    ┌────────────────────────────┐
                    │  Needle Confidence Score   │
                    │   eval = confidence_for    │
                    └─────────────┬──────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  Score ≥ 0.80             0.50 ≤ Score < 0.80        Score < 0.50
 (High Confidence)       (Medium Confidence)        (Low / Ambiguous)
         │                        │                        │
         ▼                        ▼                        ▼
  Is Action Safe?         Require User Confirmation  Reject / Ask Clarification
  (Non-destructive)       Prompt:                   Message:
  YES ──► Execute Now     "Did you mean to X?"      "I didn't quite catch that.
  NO  ──► Ask Confirm     Confirm / Cancel          Try 'Show me casual college'..."
```

### 5.1 Confidence Classification
1. **High Confidence ($\ge 0.80$):**
   - The model has cleanly matched the intent with appropriate parameters.
   - For read or generative actions (`recommend_outfit`, `search_wardrobe`, `search_style_preferences`), executes immediately.
2. **Medium Confidence ($0.50 - 0.79$):**
   - Query contains slight ambiguity or partial parameter extraction (e.g. "maybe some ethnic outfit tomorrow").
   - NeedleService transitions into `awaiting_confirmation` state.
   - UI renders a confirmation card with extracted parameters:
     *"I can recommend an ethnic outfit for tomorrow. Would you like to proceed?"* with `[Confirm]` and `[Cancel]` actions.
3. **Low Confidence / Unsupported ($< 0.50$):**
   - The query is out-of-domain or unanswerable with the tool catalog.
   - NeedleService rejects execution without side effects and provides friendly editorial guidance.
4. **Destructive Operation Policy:**
   - Any tool call that deletes, removes, or overwrites user data (or any command referencing clearing items/plans) is flagged as `destructive: true`.
   - **Destructive operations NEVER auto-execute**, even with 1.0 confidence score. User must click an explicit confirmation.

---

## 6. Tool Validation & Domain Execution Layer (`needleTools.ts`)

Needle produces raw JSON tool calls. The validation layer enforces runtime type contracts before anything reaches StyleSaathi's domain.

### 6.1 Validation Pipeline
```typescript
export interface ValidatedToolCall<T = Record<string, unknown>> {
  id: string;
  name: NeedleToolName;
  arguments: T;
  confidence: number;
  isDestructive: boolean;
  requiresConfirmation: boolean;
  explanation: string;
}
```

1. **Schema Check:** Verifies tool name exists in registered tool set.
2. **Enum Normalization:** Normalizes informal occasion names (e.g., `"uni"` -> `"college"`, `"office work"` -> `"office"`, `"puja ceremony"` -> `"puja"`).
3. **Date Resolution:** Normalizes relative dates (e.g., `"today"` -> `currentDate()`, `"tomorrow"` -> `currentDate() + 1 day`).
4. **Fallback Handling:** If required arguments are missing, downgrades confidence to force clarification.

### 6.2 Domain Execution Routing
Once validated and approved, tool calls dispatch directly into StyleSaathi context and domain methods:

| Tool Call | Domain Target | Execution Detail |
|---|---|---|
| `recommend_outfit` | `generateOutfits(items, occasion, season, 4, seed, preferences)` | Calls engine directly; switches view or displays curated look cards. |
| `search_wardrobe` | `items.filter(...)` | Applies search filters to wardrobe grid or presents matching garments. |
| `record_wear` | `markOutfitWornOnDate` / `wearEventsRepository` | Logs append-only wear event and updates timesWorn. |
| `create_style_plan` | `savePlan(...)` | Creates an `OutfitPlan` on the Style Calendar. |
| `search_style_preferences` | `preferences` / `updatePreferences` | Reads or updates style vibes and styling mode. |

**Crucial Guarantee:** Needle never performs SQL queries, never invokes Supabase client functions directly, never reads IndexedDB stores outside its model cache, and never bypasses domain business rules.

---

## 7. Service Facade & State Machine (`needleService.ts`)

`needleService` manages the UI lifecycle, worker messages, and reactive application state.

### 7.1 State Machine
```typescript
export interface NeedleState {
  status: 'uninitialized' | 'downloading' | 'ready' | 'processing' | 'error';
  downloadProgress: number; // 0 - 100
  lastQuery: string | null;
  lastResult: NeedleExecutionResult | null;
  pendingConfirmation: PendingAction | null;
  error: string | null;
}

export interface NeedleExecutionResult {
  query: string;
  toolCall: ValidatedToolCall;
  executionStatus: 'executed' | 'pending_confirmation' | 'rejected' | 'failed';
  data?: unknown; // Domain output (e.g., GeneratedOutfit[])
  message: string;
}
```

### 7.2 Service Public Interface
```typescript
export class NeedleService {
  /** Initializes worker and verifies cache */
  init(): Promise<void>;
  
  /** Interprets natural language and handles confidence gating */
  interpret(query: string, domainContext: StyleSaathiDomainContext): Promise<NeedleExecutionResult>;
  
  /** Approves and runs a medium-confidence or guarded action */
  confirmPendingAction(domainContext: StyleSaathiDomainContext): Promise<NeedleExecutionResult>;
  
  /** Cancels a pending action */
  cancelPendingAction(): void;
  
  /** Subscribes to status and state changes */
  subscribe(listener: (state: NeedleState) => void): () => void;
  
  /** Returns current state snapshot */
  getState(): NeedleState;
}
```

---

## 8. Editorial UI Integration Architecture

To maintain StyleSaathi’s premium luxury aesthetic (burgundy, gold accents, crisp serif headings, and serene whitespace), the natural-language interface is designed as an **editorial command bar**, not an invasive chatbot.

### 8.1 UI Components
1. **`NeedleCommandBar.tsx`**:
   - Desktop: An integrated search/command input in `TopNav.tsx` with a refined `Sparkles` icon and keyboard shortcut (`⌘K` / `Ctrl+K`).
   - Mobile: A floating editorial action pill (`"Ask Saathi..."`) at the top of the screen that expands smoothly into an omni-input sheet.
2. **`NeedleConfirmationCard.tsx`**:
   - Displays medium-confidence actions gracefully.
   - Shows extracted intent, confidence percentage, and primary/secondary action buttons.
3. **`NeedleProgressIndicator.tsx`**:
   - Subtle animated progress bar displayed during initial 35MB model download.
   - Displays clear messaging: *"Preparing on-device AI for offline styling (35 MB)..."*
4. **Zero Layout Disruption:**
   - The app retains its primary 5-tab navigation (`Wardrobe`, `Dress`, `Calendar`, `Insight`, `You`).
   - When an outfit is recommended via Needle, it immediately populates the `DressMeScreen` with the generated look and occasion active filter.

---

## 9. Error Handling & Fallback Strategy

1. **WASM Compilation Failure:**
   - If browser lacks WebAssembly or SharedArrayBuffer support, worker logs diagnostic error and gracefully activates the deterministic local grammar parser.
2. **Network Interruption during Initial Download:**
   - Stream download resumes using `Range` headers or prompts user with retry button.
3. **Memory Pressure on Low-End Mobile Devices:**
   - If `NeedleV3Wasm.load()` encounters memory allocation limits, it falls back to `NeedleV3Wasm.load_with_depth(bytes, 8)` which requires only ~3.5 MB of working KV cache instead of 8.8 MB.
4. **Offline Startup:**
   - When offline and cache is present, boot time is under 150ms.
   - When offline and cache is not present, informs the user clearly that initial model download requires a one-time connection.

---

## 10. Testing Strategy & Verification Plan

### 10.1 Test Suites to Implement
1. **`needleSchemas.test.ts`**:
   - Validates JSON Schema syntax, required parameters, and enum integrity for all 5 tools.
2. **`needleTools.test.ts`**:
   - Argument parsing, normalization (e.g. "tomorrow", "uni"), type validation, and error handling for invalid payloads.
3. **`needleConfidence.test.ts`**:
   - Verification of high ($\ge 0.80$), medium ($0.50-0.79$), and low ($< 0.50$) thresholds.
   - Destructive action guard verification (delete/clear commands must never auto-execute).
4. **`needleWorker.test.ts` & `needleService.test.ts`**:
   - Worker message handling, lifecycle state transitions, pending confirmation execution, and cancellation.
5. **Offline & End-to-End Flow Test (`needleOfflineFlow.test.ts`)**:
   - Simulates complete offline flow (`navigator.onLine = false` / network mock disabled).
   - Input: `"Show me something casual for college."`
   - Validates that Needle parses intent to `{ name: 'recommend_outfit', arguments: { occasion: 'college', style: 'casual' } }`.
   - Validates that `generateOutfits()` executes against sample wardrobe and returns valid generated outfits with positive compatibility scores.

---

## 11. Code Cleanup: Tailwind v4 Syntax Warnings

As requested, during implementation we will also standardize all Tailwind v4 syntax warnings across the existing codebase:
- Replace `bg-(--background)` with `bg-background`
- Replace `text-(--muted)` with `text-muted`
- Replace `border-(--border)` with `border-border`
- Replace `bg-(--card)` with `bg-card`
- Replace `fill-(--accent)` with `fill-accent`, `stroke-(--accent)` with `stroke-accent`, etc.

This eliminates 100+ IDE warnings and guarantees 0 errors and 0 warnings.

---

## 12. Implementation File Map

```
src/
├── services/
│   └── needle/
│       ├── needleTypes.ts              # Core types, contracts, worker protocol
│       ├── needleSchemas.ts            # Official JSON schemas for 5 tools
│       ├── needleTools.ts              # Argument validator, router, destructive guards
│       ├── needleWorker.ts             # Web Worker running needle-rs & IndexedDB cache
│       ├── needleService.ts            # Public singleton service & state management
│       └── __tests__/
│           ├── needleSchemas.test.ts   # Schema contract tests
│           ├── needleTools.test.ts     # Validation & routing tests
│           ├── needleConfidence.test.ts# Confidence gating & safety tests
│           ├── needleService.test.ts   # Service state & worker lifecycle tests
│           └── needleOfflineFlow.test.ts# Full on-device offline flow tests
├── components/
│   └── needle/
│       ├── NeedleCommandBar.tsx        # Editorial natural-language command entry point
│       └── NeedleConfirmationModal.tsx # Confirmation dialog for medium-confidence actions
```

---

## 13. Verification Checklist

- [ ] `npm run typecheck`: 0 errors
- [ ] `npm test`: All 220 existing tests + all new Needle tests passing
- [ ] `npm run build`: Production bundle builds successfully
- [ ] Offline test: Complete flow operates with zero external network connectivity
- [ ] Security audit: Zero leaks, zero bypasses of auth/RLS, zero cloud LLM tokens sent
