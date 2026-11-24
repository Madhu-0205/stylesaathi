# StyleSaathi 3.0 — Phase 3C.4: Critical Sync Integrity Remediation Report

**Date:** 2026-11-07  
**Status:** Completed & Empirically Verified  
**Gate Verdict:** **PASS** (Ready for Phase 3D authorization consideration)  
**Security & Cost Boundaries:** ₹0 Infrastructure Cost, Zero Cloudflare Production Writes, Zero Supabase Changes, No Git Commits/Pushes  

---

## Executive Summary

During Phase 3C.3, an independent adversarial security audit evaluated the delta synchronization engine and identified critical data-integrity flaws:
1. **Lack of Server-Authoritative Monotonic Revisions:** Conflict resolution relied partially on client-reported timestamps rather than strict, server-managed sequence counters, exposing concurrent updates to clock-skew manipulation.
2. **Restore & Delete Semantic Hazards:** Unconditional restore/delete handling permitted stale active records to resurrect newer deletions and allowed stale deletes to erase newer edits.
3. **Idempotency Concurrency Overwrite:** The sync engine utilized `INSERT OR REPLACE` for idempotency records, which could silently overwrite mutation audit records during concurrent duplicate bursts.
4. **Relationship Ownership Parsing Gaps:** Outfit slot formats represented as simple strings (`slots: { top: 'item-id' }`) bypassed referential ownership verification compared to object representations (`slots: { top: { id: 'item-id' } }`).
5. **Premature Tombstone Pruning Risks:** Planned 90-day tombstone expiration introduced zombie resurrection vulnerabilities for long-offline clients (e.g., reconnecting after 91 or 180 days).

In Phase 3C.4, all five vulnerabilities were systematically remediated locally across the database schema, worker sync handlers, client-side conflict resolvers, and test suites.

### Gate Verdict: PASS
- **Schema & Migration:** Additive migration `0003_entity_revisions.sql` adds monotonic integer `revision` columns across all synchronized entities.
- **Worker Verification:** All 25 worker sync adversarial tests pass (including dedicated tests 20–25). All 69 worker tests pass.
- **Client Verification:** All 26 conflict resolver tests pass.
- **Full Workspace Test Suite:** 118 test files, 1,165 tests pass (0 failures).
- **Bundle Verification:** `npm run build` succeeds cleanly.
- **Constraints Compliance:** Zero production modifications, zero Supabase changes, zero dependencies added, zero commits/pushes.

---

## 1. Server-Authoritative Entity Revisions

### 1.1 Additive D1 Migration (`worker/migrations/0003_entity_revisions.sql`)
To avoid modifying existing migrations `0001` or `0002`, an additive schema migration was implemented:
```sql
-- Migration: 0003_entity_revisions.sql
-- Adds server-controlled monotonic integer revisions to synchronized entities.
ALTER TABLE wardrobe_items ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE saved_outfits ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE calendar_plans ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE style_preferences ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_revision ON wardrobe_items(user_id, revision);
CREATE INDEX IF NOT EXISTS idx_saved_outfits_revision ON saved_outfits(user_id, revision);
CREATE INDEX IF NOT EXISTS idx_calendar_plans_revision ON calendar_plans(user_id, revision);
CREATE INDEX IF NOT EXISTS idx_style_preferences_revision ON style_preferences(user_id, revision);
```

### 1.2 Monotonic Progression & Optimistic Concurrency Control
In `worker/src/sync/push.ts`:
- **New entities** are initialized at `revision = 1`.
- **Every accepted mutation** (upsert, delete, or restore) strictly advances the entity's revision via `nextRevision = currentRevision + 1`.
- **Optimistic Concurrency Check:** Clients supply an optional `expectedRevision` field:
  ```ts
  if (expectedRevision !== undefined && expectedRevision !== null && expectedRevision !== currentRevision) {
    return {
      result: {
        mutationId: m.mutationId,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'conflict_server_wins',
        conflictData: existing,
        serverUpdatedAt: existing.server_updated_at,
        serverRevision: currentRevision,
        error: `STALE_REVISION: Expected revision ${expectedRevision} does not match current server revision ${currentRevision}`,
      },
    };
  }
  ```
- **Client Timestamp Demotion:** Client timestamps are no longer used to override server revisions. Even if an offline device submits an update with a newer wall-clock timestamp, an `expectedRevision` mismatch immediately triggers `conflict_server_wins` with the latest server data and server revision.

---

## 2. Strict Restore and Delete Correctness

### 2.1 Elimination of Unconditional Bypasses
Previously, incoming mutations with `action: 'restore'` or flags like `isRestored` could un-tombstone an entity regardless of whether the restore event was older than the deletion event.
Under Phase 3C.4:
1. **Standard Upsert on Tombstones Forbidden:** If an entity is marked `is_deleted = 1`, standard `action: 'upsert'` mutations are unconditionally rejected with `status: 'conflict_server_wins'` (`TOMBSTONE_CONFLICT`). This permanently prevents zombie resurrection from stale edits.
2. **Explicit Restoration Required:** An entity can only be un-deleted via `action: 'restore'`.
3. **Stale Restore Protection:**
   - The restore mutation's `expectedRevision` must match the server tombstone's exact revision.
   - The restore's `clientTimestamp` must be strictly newer than the entity's `deleted_at` timestamp.
   ```ts
   const existingDeletedMs = toEpochMs(existing.deleted_at);
   if (effectiveClientTimestamp <= existingDeletedMs) {
     return {
       result: {
         status: 'conflict_server_wins',
         error: 'STALE_RESTORE: Restoration timestamp must be strictly newer than deletion timestamp',
       },
     };
   }
   ```
4. **Stale Delete Protection:**
   - A delete mutation cannot be applied if its `clientTimestamp` is older than the active record's `client_updated_at` (`STALE_DELETE`).
   - If the active record has advanced to a higher revision, the stale delete is rejected with `STALE_REVISION`.
5. **Preservation of User-Verified Attributes:**
   - In accordance with DATA-SYNC-03, attributes verified by the user (`user_verified = 1`) such as `fabric`, `pattern`, `fit`, `purchase_price`, and `cultural_context` are preserved during updates and restorations.
6. **Device-Local Image Boundary:**
   - Garment images remain strictly device-local; mutations containing base64 payloads continue to be rejected (`DATA-SYNC-01`). Server sync only stores image references (`active_image_version_id`, `storage_path`, `photo_id`, `photo_url`).

---

## 3. Uniqueness-Enforcing Idempotency & Concurrent Collision Recovery

### 3.1 Replacement of `INSERT OR REPLACE`
In Phase 3C.3, `sync_mutations` used `INSERT OR REPLACE`, which allowed racing concurrent requests to overwrite earlier idempotency records.
In Phase 3C.4:
- The worker executes an explicit, constraint-enforcing insert:
  ```sql
  INSERT INTO sync_mutations (user_id, mutation_id, entity_type, entity_id, payload_hash, applied_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ```
- **Deterministic Canonical Payload Hashing:** `computePayloadHash` serializes `action`, `entityType`, `entityId`, `expectedRevision`, and `data` in sorted JSON key order before computing a SHA-256 digest.
- **Concurrent Collision Handling:** If two duplicate requests race and SQLite raises a `UNIQUE constraint failed: sync_mutations.user_id, sync_mutations.mutation_id` error during batch execution:
  - The worker catches the exception, re-queries `sync_mutations` for that key, and:
    - If `payload_hash`, `entity_type`, and `entity_id` match: returns `status: 'already_applied'`.
    - If `payload_hash` or target entity differs: returns `status: 'rejected'` with `IDEMPOTENCY_CONFLICT`.

---

## 4. Referential Integrity & Complete Relationship Ownership

### 4.1 Outfit Slots Format Normalization
Previously, relationship validation only checked slots formatted as objects (`{ top: { id: 'item-123' } }`). If a client submitted slots formatted as simple strings (`{ top: 'item-123' }`), foreign items could slip past the cross-user reference guard.
In Phase 3C.4:
- Both `handleSavedOutfit` and `handleCalendarPlan` normalize slots by extracting both string values and object `.id` properties:
  ```ts
  const referencedItemIds: string[] = [];
  for (const slotKey of Object.keys(slotObj)) {
    const val = slotObj[slotKey];
    if (typeof val === 'string' && val.trim().length > 0) {
      referencedItemIds.push(val.trim());
    } else if (val && typeof val === 'object' && typeof val.id === 'string' && val.id.trim().length > 0) {
      referencedItemIds.push(val.id.trim());
    }
  }
  ```
- All extracted item IDs are verified against `wardrobe_items` to ensure `user_id = ?`. Any foreign reference is immediately rejected with `REFERENTIAL_INTEGRITY_VIOLATION`.

---

## 5. Indefinite Tombstone Retention & Storage Budget Analysis

### 5.1 Removal of 90-Day Auto-Purge
Automatic tombstone deletion after 90 days creates an architectural vulnerability: a user device that remains offline for >90 days (e.g., 91, 100, 180 days) retains active copies of items deleted on other devices. Upon reconnecting, the server would find no record of the deleted items and accept them as new insertions, resurrecting deleted data across the fleet.
In Phase 3C.4:
- Tombstones are retained **indefinitely** in Cloudflare D1.
- No automated cron or trigger purges `is_deleted = 1` rows.

### 5.2 Storage Impact on Free Tier Quota (₹0 Budget)
A row in `wardrobe_items` with `is_deleted = 1` stores:
- `id` (UUID): 36 bytes
- `user_id` (UUID): 36 bytes
- `name` / `category` / `subcategory`: ~40 bytes
- `deleted_at`, `client_updated_at`, `server_updated_at`: ~75 bytes
- `revision` (INTEGER): 8 bytes
- Overhead: ~20 bytes
- **Total per tombstone row:** ~215 bytes (~0.2 KB)

**Storage Projections:**
- **10,000 tombstones:** ~2.15 MB
- **100,000 tombstones:** ~21.5 MB (0.43% of Cloudflare D1's 5 GB free tier)
- **1,000,000 tombstones:** ~215 MB (4.3% of Cloudflare D1's 5 GB free tier)

Even under heavy user usage, indefinite tombstone retention consumes a tiny fraction of the free tier storage limit, maintaining strict ₹0 operational cost while completely eliminating zombie resurrection.

---

## 6. Verification Matrix & Empirical Test Results

| Test Category | Suite / File | Tests Run | Result | Evidence / Details |
|---|---|---|---|---|
| **Optimistic Concurrency & Monotonic Revisions** | `worker/tests/sync.test.ts` (Test 20) | 1 | **PASS** | Revision advances 1 -> 2; stale revision update rejected with `STALE_REVISION` even with newer client timestamp. |
| **Stale Delete Rejection** | `worker/tests/sync.test.ts` (Test 21) | 1 | **PASS** | Deletion older than latest edit or with stale revision rejected with `conflict_server_wins`. |
| **Stale Restore Rejection** | `worker/tests/sync.test.ts` (Test 22) | 1 | **PASS** | Restore older than deletion timestamp or with mismatched revision rejected with `STALE_RESTORE`. |
| **Idempotency Conflict & Concurrency** | `worker/tests/sync.test.ts` (Test 23) | 1 | **PASS** | Key reuse with different payload or entity rejected with `IDEMPOTENCY_CONFLICT`. Identical retry returns `already_applied`. |
| **Relationship Ownership (String & Object Slots)** | `worker/tests/sync.test.ts` (Test 24) | 1 | **PASS** | Cross-user references rejected with `REFERENTIAL_INTEGRITY_VIOLATION` for both string and object slots. |
| **Indefinite Tombstone Retention** | `worker/tests/sync.test.ts` (Test 25) | 1 | **PASS** | Tombstones preserved past 150 days; offline client reconnecting at 180 days rejected with `TOMBSTONE_CONFLICT`. |
| **Complete Worker Sync Suite** | `worker/tests/sync.test.ts` | 25 | **PASS** | All 25 adversarial test cases passing cleanly. |
| **Complete Worker Suite** | `worker/tests/` | 69 | **PASS** | Schema migrations (7), workerApp (12), sync (25), auth (25). |
| **Client Conflict Resolvers** | `src/__tests__/conflictResolvers*.test.ts` | 26 | **PASS** | Local resolution tests reflect server revision priority and restoration correctness. |
| **Full Repository Test Suite** | `npm test -- --run` | 1,165 | **PASS** | 118 test files, 1,165 tests passed, 0 failures. |
| **Production Build** | `npm run build` | 1 | **PASS** | `tsc -b && vite build` compiled in 455ms with 0 errors. |

---

## 7. Non-Negotiable Constraint Compliance

- **₹0 Infrastructure Cost:** Verified. No paid features, no cloud migrations.
- **No Production Deployments:** Verified. No Cloudflare CLI deploy commands executed; all tests run locally with in-memory SQLite D1 simulation.
- **No Supabase Alterations:** Verified. Supabase project remains untouched and unpaused.
- **No Data Cutover:** Verified. Real user data remains untouched.
- **No New Dependencies:** Verified. `package.json` was not modified.
- **No Commits or Pushes:** Verified. Working tree remains uncommitted and on local branch.
- **Phase 3D Boundary:** Verified. Phase 3D remains unauthorized until review of this document.

---

## Conclusion & Next Steps

Phase 3C.4 has remediated every identified data-integrity defect in StyleSaathi 3.0's delta synchronization engine. The implementation provides:
1. True server-authoritative monotonic revisions.
2. Provably safe delete and restore semantics.
3. Uniqueness-enforcing, race-resilient idempotency.
4. Comprehensive referential ownership across all slot structures.
5. Indefinite tombstone retention with zero risk of quota exhaustion.

The system is now ready for formal Phase 3C completion and subsequent authorization of Phase 3D.

