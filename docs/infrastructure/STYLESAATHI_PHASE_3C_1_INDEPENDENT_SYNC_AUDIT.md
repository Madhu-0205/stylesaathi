# StyleSaathi 3.0 — Phase 3C.1 Independent Sync Security & Data Integrity Audit

**Document ID:** `STYLESAATHI-3.0-PHASE-3C-1-INDEPENDENT-AUDIT`  
**Execution Date:** 2026-11-07  
**Audit Type:** Independent, Adversarial, Read-Only Security & Data Integrity Audit  
**Target Codebase:** `worker/` (Cloudflare Worker & D1), `src/lib/sync/` (Client Sync Engine), `worker/migrations/`  
**Auditor:** Independent Security & System Architecture Reviewer  
**Audit Mode:** Strict READ-ONLY (Zero source/test/schema edits, zero git commits, zero cloud deployments)  
**Overall Verdict:** **CONDITIONAL PASS** (4 remediation items required prior to Phase 3D production authorization)

---

## 1. Executive Summary

An independent, adversarial security and data integrity audit was conducted on the Phase 3C Delta Synchronization Engine of StyleSaathi 3.0. The audit independently inspected every sync route, SQL migration, client queue handler, conflict resolution rule, image boundary guard, and runtime test harness.

The system establishes an impressive, offline-first, tenant-isolated delta sync foundation designed for a strict **₹0 operating cost**. Authentication enforcement is uniform across all endpoints, client-supplied user identifiers cannot override server session context, garment image binaries are strictly quarantined on the local device, and quota exhaustion pauses execution safely without dead-lettering valid mutations.

However, an adversarial audit revealed **4 security, data integrity, and operational defects** that must be formally remediated before Phase 3D production deployment and Supabase cutover can be authorized:

1. **Idempotency Key Payload Substitution (SEC-SYNC-01 — High):** The server returns `already_applied` based solely on `(user_id, mutation_id)` without verifying payload hash or entity match, causing subsequent mutations reusing a key to be silently dropped without an error or rejection.
2. **Client-Side Tombstone Undelete Suppression (DATA-SYNC-02 — High):** In `conflictResolvers.ts`, any local soft-deleted item unconditionally overrides remote active items, making it impossible for multi-device users to restore deleted items.
3. **Cross-Entity Reference Ownership Gap (SEC-SYNC-03 — Medium):** `verifyNoCrossUserItemReferences` only inspects `wardrobe_items`. Foreign `saved_outfits` IDs can be linked in `wear_events.outfit_id` without ownership validation.
4. **Push Batch Non-Atomicity & Crash Inconsistency (DATA-SYNC-04 — Medium):** Multi-mutation push batches are executed sequentially via individual unbatched D1 statements without a wrapping database transaction or `db.batch()`, leaving partial batch states on worker interrupt or item failure.

---

## 2. Audit Findings Matrix

| Finding ID | Classification | Severity | Impacted Files & Lines | Status | Summary |
|---|---|:---:|---|:---:|---|
| **SEC-SYNC-01** | Security / Integrity | **HIGH** | `worker/src/sync/push.ts:59-74`<br>`worker/migrations/0002_sync_mutations.sql:9-16` | **CONFIRMED** | Idempotency key reuse with different payloads silently drops mutations without rejection. |
| **DATA-SYNC-02** | Data Integrity | **HIGH** | `src/lib/sync/conflictResolvers.ts:26-38` | **CONFIRMED** | Local tombstone unconditionally trumps remote active state, permanently suppressing cross-device item restoration. |
| **SEC-SYNC-03** | Tenant Isolation | **MEDIUM** | `worker/src/sync/push.ts:834, 897`<br>`worker/src/sync/push.ts:24-44` | **CONFIRMED** | Embedded `outfit_id` in `wear_events` and `style_signals` is not checked for user ownership in `saved_outfits`. |
| **DATA-SYNC-04** | Transactionality | **MEDIUM** | `worker/src/sync/push.ts:49-131` | **CONFIRMED** | Push batches execute as unbatched sequential D1 statements without transactional rollback on partial failure. |
| **ARCH-SYNC-05** | Conflict / Skew | **MEDIUM** | `worker/src/sync/push.ts:216-226` | **CONFIRMED** | Server timestamp comparison against unvalidated client timestamp allows skewed client clocks to stall updates. |
| **COST-SYNC-06** | ₹0 Infrastructure | **LOW** | `worker/src/sync/push.ts:109-116`<br>`worker/migrations/0002_sync_mutations.sql:9-18` | **CONFIRMED** | D1 write amplification (2 writes + 2 reads per mutation) and lack of tombstone/mutation pruning limits scaling on free tier. |
| **VERIF-SYNC-07** | Runtime Boundary | **LOW** | `worker/tests/sync.test.ts:18-66` | **OBSERVATION** | Unit tests execute against in-memory `node:sqlite` adapter; distributed D1 replication lag not tested in unit suites. |

---

## 3. Detailed Audit by Area

### 3.1 Area 1: Authentication and Ownership Verification

#### Verified Strengths:
- **Mandatory Session Authentication:** Both `POST /api/sync/push` and `GET /api/sync/pull` are mounted on `syncRouter` behind `authMiddleware()` (`worker/src/sync/routes.ts:25`). Requests without a valid Bearer token or cookie are rejected with HTTP 401 (`worker/src/middleware/auth.ts:47-51`).
- **Server-Derived Identity:** In `worker/src/sync/routes.ts:30-34` and `136-140`, user identity is extracted strictly from `c.get('user').id`. The application ignores any `userId` or `user_id` passed in the request body.
- **Strict Query Parameterization:** All SQL queries in `worker/src/sync/push.ts` and `worker/src/sync/pull.ts` explicitly bind the authenticated `userId`:
  - `wardrobe_items`: `WHERE user_id = ? AND id = ?` (`push.ts:145, 160, 275`)
  - `saved_outfits`: `WHERE user_id = ? AND id = ?` (`push.ts:408, 418, 487`)
  - `calendar_plans`: `WHERE user_id = ? AND (id = ? OR date = ?)` (`push.ts:580, 590, 660`)
  - `style_preferences`: `WHERE user_id = ?` (`push.ts:725, 754, 769`)
  - `wear_events`: `WHERE user_id = ? AND id = ?` (`push.ts:809, 832`)
  - `style_signals`: `WHERE user_id = ? AND id = ?` (`push.ts:872, 895`)
- **Wardrobe Item Cross-User Isolation:** The helper `verifyNoCrossUserItemReferences(db, userId, itemIds)` (`push.ts:24-44`) queries `SELECT user_id FROM wardrobe_items WHERE id = ? AND user_id != ? LIMIT 1`. If an item belongs to another user, the entire mutation is rejected with `REFERENTIAL_INTEGRITY_VIOLATION`.

#### Vulnerability Discovered (SEC-SYNC-03):
- **Omission of `saved_outfits` Ownership Validation:**
  While `wardrobe_item_id` in `wear_events` is validated against `wardrobe_items` (`push.ts:792-805`), the `outfit_id` column in `wear_events` (`push.ts:834`) and `style_signals` (`push.ts:897`) is inserted directly without checking ownership in `saved_outfits`.
  **Empirical Proof (Executed in `scratch/audit_exploit_proofs.test.ts`):**
  User A successfully logged a `wear_event` referencing User B's private outfit `bob-outfit-secret`. The server returned HTTP 200 with `status: 'applied'`, and the database persisted the foreign reference.

---

### 3.2 Area 2: Push Atomicity and Idempotency

#### Execution Strategy Analysis:
In `worker/src/sync/push.ts:49-131`, `processPushMutations` loops over `mutations` sequentially:
```typescript
for (const m of mutations) {
  try {
    // 1. SELECT applied_at FROM sync_mutations WHERE user_id = ? AND mutation_id = ?
    // 2. handleEntity(db, userId, m, serverNowIso) -> SELECT then INSERT/UPDATE
    // 3. INSERT OR REPLACE INTO sync_mutations ...
    results.push(mutationResult);
  } catch (err: any) {
    results.push({ status: 'rejected', error: err.message });
  }
}
```

#### Vulnerabilities Discovered:
1. **Idempotency Key Payload Substitution (SEC-SYNC-01 — High):**
   `sync_mutations` records `(user_id, mutation_id, entity_type, entity_id, applied_at)` (`0002_sync_mutations.sql:9-16`).
   However, the lookup in `push.ts:60-63` only checks:
   `SELECT applied_at FROM sync_mutations WHERE user_id = ? AND mutation_id = ?`.
   If a mutation ID is reused with a completely different payload or different entity type/ID:
   - The server detects `existingMutation` and immediately returns `{ status: 'already_applied', serverUpdatedAt: existingMutation.applied_at }`.
   - The new payload is silently discarded without being applied to D1.
   - The server returns success (`already_applied`) instead of rejecting the key reuse with HTTP 409 or `IDEMPOTENCY_KEY_MISMATCH`.
   **Empirical Proof (Executed in `scratch/audit_exploit_proofs.test.ts`):**
   User A applied `mut-001` with `Original Blue Shirt`. User A then submitted `mut-001` with `item-999` and `Red Kurta`. The server returned `already_applied`, and `item-999` was never created.

2. **Batch Non-Atomicity & Partial Failure (DATA-SYNC-04 — Medium):**
   Because statements are not wrapped in a D1 transaction or `db.batch()`, each mutation is committed independently. If mutation 3 in a 5-mutation batch throws an error (or the Cloudflare Worker hits a CPU limit or network termination):
   - Mutations 1 and 2 remain permanently committed in D1.
   - Mutation 3 fails.
   - Mutations 4 and 5 are never processed.
   - **Transaction Guarantee:** The engine provides **per-mutation atomicity**, NOT **batch transaction atomicity**. The documentation must clarify that batches are composite sequences of independent mutations.

---

### 3.3 Area 3: Pull Cursor Correctness & Consistency Guarantees

#### Cursor Structure & Validation:
- **Structure:** Encoded as URL-safe Base64 JSON: `btoa(JSON.stringify({ tableIndex, ts, id }))` (`worker/src/sync/pull.ts:27-58`).
- **Validation:** Tested against tampering, malformed Base64, out-of-range table indices (`tableIndex < 0 || tableIndex >= 6`), and invalid types (`worker/tests/sync.test.ts:327-357`). Malformed cursors return HTTP 400 `INVALID_CURSOR`.

#### Timestamp & Tie-Breaking Correctness:
In `worker/src/sync/pull.ts:289-317`:
```sql
SELECT * FROM <tableName>
WHERE user_id = ? AND (server_updated_at > ? OR (server_updated_at = ? AND id > ?))
ORDER BY server_updated_at ASC, id ASC
LIMIT ?
```
- Equal timestamps within the same table are deterministically paginated via `(server_updated_at = ? AND id > ?)`.
- Records with identical timestamps are never skipped or indefinitely duplicated.

#### Formal Consistency Guarantee:
- **Not Snapshot Isolation:** Cloudflare D1 does not provide cross-query snapshot isolation across paginated HTTP requests.
- **Guarantee: Watermark Consistency (Monotonic Streaming Cursor):**
  Pagination streams across tables in index order (`0: wardrobe_items` -> `1: saved_outfits` -> `2: calendar_plans` -> `3: style_preferences` -> `4: wear_events` -> `5: style_signals`).
  If an entity in a previously traversed table is inserted or updated while a client is paginating a later table, that change is not visible in the current pull session. It will be captured on the subsequent pull where `since` equals the high-water mark timestamp.
  Because client reconciliation is idempotent, duplicate records delivered across boundary pages do not cause duplicate local records.

---

### 3.4 Area 4: Conflict Resolution & Invariant Verification

#### Server-Authoritative Timeline:
- The server always overwrites `server_updated_at` with `new Date().toISOString()` (`push.ts:55`). Client timestamps are never adopted as the authoritative server timestamp.
- **Attribute Provenance:** If an existing item has `user_verified === 1` and incoming mutation has `userVerified === 0`, verified attributes (`fabric`, `pattern`, `fit`, `purchase_price`, `cultural_context`) are strictly preserved (`push.ts:228-241`).
- **Monotonic Calendar Status:** D1 trigger `trg_calendar_plan_status_guard` (`0001_initial_schema.sql:231-238`) and code guard (`push.ts:604-626`) strictly prevent `worn` or `cancelled` from reverting to `planned`.

#### Vulnerabilities Discovered:
1. **Client Tombstone Undelete Suppression (DATA-SYNC-02 — High):**
   In `src/lib/sync/conflictResolvers.ts:27-38`:
   ```typescript
   if (local.isDeleted && !remote.isDeleted) {
     return { ...local, deletedAt: local.deletedAt || Date.now() };
   }
   if (!local.isDeleted && remote.isDeleted) {
     return { ...remote, deletedAt: remote.deletedAt || Date.now() };
   }
   ```
   If User on Device 1 intentionally restores an item (`isDeleted: false`, with a newer timestamp) and syncs to D1:
   When Device 2 pulls this change, Device 2 has `local.isDeleted === true` and receives `remote.isDeleted === false`.
   The resolver executes line 27: `if (local.isDeleted && !remote.isDeleted) return local;`.
   Device 2 **permanently suppresses the undeletion** and forces the item back to deleted status!
   **Empirical Proof (Executed in `scratch/audit_exploit_proofs.test.ts`):**
   `resolveWardrobeItemConflict` returned `isDeleted: true` even when `remote.serverUpdatedAt` was 5 days newer than `local.deletedAt`.

2. **Unbounded Client Clock Skew Stalling (ARCH-SYNC-05 — Medium):**
   In `push.ts:216-226`:
   `if (m.clientTimestamp < toEpochMs(existing.client_updated_at)) return { status: 'conflict_server_wins', ... }`.
   If a device with its clock set 1 hour ahead pushes an update, `existing.client_updated_at` is written 1 hour in the future.
   For the next 60 minutes, any other device with an accurate clock pushing updates to that item will have `m.clientTimestamp < existing.client_updated_at` and will be rejected with `conflict_server_wins`.
   **Empirical Proof (Executed in `scratch/audit_exploit_proofs.test.ts`):**
   Device B's real-time update 5 minutes later was rejected with `conflict_server_wins`.

---

### 3.5 Area 5: Tombstones and Deletion

#### Propagation and Isolation:
- Deletions are soft deletes (`is_deleted = 1, deleted_at = ?, server_updated_at = serverNow`).
- `pullDeltas` includes `is_deleted = 1` rows in delta streams (`pull.ts:145, 172, 200`), allowing authorized secondary devices to mark local records as deleted.
- Tombstones are strictly filtered by `user_id = ?`. A user cannot observe or affect another user's deleted items.
- Account-level tombstones in `deletion_tombstones` (`0001_initial_schema.sql:217-224`) are not exposed via delta sync.

#### Operational Note:
- There is currently no scheduled D1 retention purge for soft-deleted rows. Over time, soft-deleted rows and `sync_mutations` rows accumulate indefinitely in D1.

---

### 3.6 Area 6: Quota Handling and Queue Recovery

#### Verified Behavior:
- **Persistent IndexedDB Queue:** The client queue is stored in IndexedDB under `stylesaathi-sync-queue-db` via `idb-keyval` (`src/lib/sync/syncQueue.ts:4-15`).
- **Crash Recovery:** `syncQueue.recoverFromCrash()` (`syncQueue.ts:105-116`) resets any `in_flight` mutations to `pending` upon application restart.
- **Quota Pause Without Dead-Lettering:**
  When HTTP 429 or quota error is encountered, `workerSyncClient` throws `QuotaExceededError` (`workerSyncClient.ts:8-15, 163-172`).
  `syncQueue.markFailed(id, msg, false, true)` pauses the queue for 1 hour (`3,600,000 ms`), does **not** increment `attemptCount`, and leaves the mutation in `pending` status (`syncQueue.ts:233-245`).
  Verified by test in `src/__tests__/syncServiceWorker.test.ts:133-157`.
- **Offline Usability:** All repository reads and writes continue uninterrupted against local IndexedDB storage when the worker backend is unavailable or quota is paused.

---

### 3.7 Area 7: Image Cloud Boundary

#### Strict Local Storage Quarantine:
- **Client Sanitization:** `sanitizeMutationPayload` (`src/lib/sync/workerSyncClient.ts:68-84`) strips `photo`, `blob:...`, and `data:image/...` strings before JSON serialization.
- **Client Mutation Filtering:** `workerSyncClient.pushMutations` filters out all `wardrobe_image` mutation types (`workerSyncClient.ts:124-137`).
- **Server Rejection Guard:** `worker/src/sync/validation.ts:90-99` scans all mutation payloads; any payload containing `data:image/` or raw strings > 50 KB is rejected with HTTP 400.
- **Local Reference Preservation:** During delta pull reconciliation, `photo` (the local image reference) is explicitly preserved:
  `winner.photo = local.photo || winner.photo;` (`syncService.ts:287, 741`).
  Missing local images gracefully render fallback placeholders without throwing exceptions.

---

### 3.8 Area 8: ₹0 Infrastructure Constraints

#### Compliance Checks:
- **Zero Paid Cloud Resources:** No Cloudflare R2 bucket bindings, no external paid APIs, no automatic billing configurations.
- **Bounded Request Limits:**
  - Maximum push payload: 512 KB (`validation.ts:8`, `routes.ts:42, 55`).
  - Maximum mutations per batch: 100 (`validation.ts:9`, `routes.ts:89`).
  - Maximum pull page size: 250 (`pull.ts:85`).
- **Write Amplification Concern (COST-SYNC-06):**
  Each mutation produces:
  - 1 read in `sync_mutations`
  - 1 read in target entity table
  - 1 write in target entity table
  - 1 write in `sync_mutations`
  Total: 2 writes and 2 reads per mutation. A full batch of 50 mutations consumes 100 writes against the 100,000 daily free tier write limit. This is manageable for MVP, but requires monitoring.

---

### 3.9 Area 9: Production Secret Validation

#### Implementation Inspection:
In `worker/src/auth/crypto.ts:13-33`:
```typescript
export function validateAuthSecret(secret?: string, appEnv?: string): string {
  const isProd = appEnv === 'production';
  if (!secret || secret.trim().length === 0) {
    if (isProd) {
      throw new Error(
        'CRITICAL SECURITY CONFIGURATION ERROR: AUTH_SECRET is not configured in production environment. Refusing to start.'
      );
    }
    return DEV_FALLBACK_SECRET;
  }
  if (secret.length < 32) {
    if (isProd) {
      throw new Error(
        'CRITICAL SECURITY CONFIGURATION ERROR: AUTH_SECRET must be at least 32 characters in production. Refusing to start.'
      );
    }
    return DEV_FALLBACK_SECRET;
  }
  return secret;
}
```
- In production (`APP_ENV === 'production'`), if `AUTH_SECRET` is missing or shorter than 32 characters, the worker fails closed and refuses all requests (`worker/src/auth/routes.ts:32-41`).
- Non-production environments allow local testing with `DEV_FALLBACK_SECRET`.
- Verified in `worker/tests/auth.test.ts:24-63`.

---

### 3.10 Area 10: Actual Runtime Compatibility

#### Limitations of Current Verification:
- Tests in `worker/tests/sync.test.ts` and `worker/tests/schemaMigration.test.ts` execute inside Node.js using `node:sqlite` (`new DatabaseSync(':memory:')`) wrapped by a custom `createD1Adapter` interface.
- **Architectural Differences from Real Cloudflare D1:**
  1. **Distributed Replication Lag:** Real Cloudflare D1 uses primary write leaders with edge read replicas. Reads executed immediately after writes at different edge nodes may experience slight replication lag.
  2. **Batch Transaction Behavior:** In native D1, `db.batch()` wraps all statements in an atomic deferred transaction. The test adapter executes statements sequentially in Node.js.
  3. **Foreign Key Enforcement:** In `node:sqlite`, `PRAGMA foreign_keys = ON;` must be run explicitly. In Cloudflare D1, foreign key enforcement is active by default.

---

## 4. Empirical Test Verification Log

To verify all claims independently without trusting prior reports, test suites were executed with zero mocks on local databases:

1. **Worker Test Suite Execution:**
   - Command: `npx vitest run worker/tests/`
   - Result: **58 passed (100%)** across 4 test suites (`schemaMigration.test.ts`, `workerApp.test.ts`, `sync.test.ts`, `auth.test.ts`) in 1.71s.
2. **Client Sync Worker Backend Suite Execution:**
   - Command: `npx vitest run src/__tests__/syncServiceWorker.test.ts`
   - Result: **4 passed (100%)** in 193ms.
3. **Application Full Test Suite Execution:**
   - Command: `npm test -- --run`
   - Result: **1,147 passed (100%)** across 117 test files in 10.86s.
4. **Empirical Exploit Verification Suite (Executed via disposable scratch runner):**
   - Command: `npx vitest run --dir <scratch>/`
   - Tests:
     - `Proof 1: Idempotency key reuse with different payload silently drops mutation` -> **VERIFIED**
     - `Proof 2: User A can link User B saved_outfit ID in wear_events` -> **VERIFIED**
     - `Proof 3: Client resolveWardrobeItemConflict blocks restoring deleted items` -> **VERIFIED**
     - `Proof 4: Future-skewed client timestamp locks out valid updates` -> **VERIFIED**

---

## 5. Audit Verdict & Required Remediation Gate

### Overall Verdict: **CONDITIONAL PASS**

The core multi-tenant delta sync architecture, quota pause protocol, image boundary isolation, and production secret guards are robust and comply with the zero-cost architecture mandate. 

However, **Phase 3D (Production Cutover & Supabase Migration) MUST NOT be authorized** until the following four remediation items are implemented and independently verified in Phase 3C.2:

### Phase 3C.2 Required Remediation Items:
1. **Remediate SEC-SYNC-01 (Idempotency Key Payload Hash Verification):**
   In `0002_sync_mutations.sql`, add `payload_hash TEXT NOT NULL`. In `worker/src/sync/push.ts`, compute `sha256Hex(JSON.stringify(m.data))`. If `mutation_id` exists with a different `payload_hash` or different `entity_id`, return HTTP 409 `IDEMPOTENCY_CONFLICT` instead of `already_applied`.
2. **Remediate DATA-SYNC-02 (Client Conflict Resolver Undelete Support):**
   In `src/lib/sync/conflictResolvers.ts`, update `resolveWardrobeItemConflict`, `resolveSavedOutfitConflict`, and `resolveCalendarPlanConflict` to check timestamps when reconciling tombstoned vs active records. If an active record has `serverUpdatedAt` or `clientUpdatedAt` strictly newer than `deletedAt`, the active state must be restored.
3. **Remediate SEC-SYNC-03 (Saved Outfit Cross-User Reference Check):**
   In `worker/src/sync/push.ts`, expand `verifyNoCrossUserItemReferences` (or add `verifyNoCrossUserOutfitReferences`) to ensure that `outfit_id` in `wear_events`, `style_signals`, and `calendar_plans` belongs to `userId` in `saved_outfits`.
4. **Remediate ARCH-SYNC-05 (Server Skew Window Guard):**
   In `worker/src/sync/push.ts`, clamp incoming `clientTimestamp` so that any timestamp greater than `serverNow + 5 minutes` is rejected or normalized to `serverNow`, preventing skewed client clocks from locking out subsequent writes.

---
*Report certified by Independent Architecture & Security Audit Reviewer.*

