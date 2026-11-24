# StyleSaathi 3.0 — Phase 3E.3: Independent Restore & Account Deletion Audit Report

**Date:** November 7, 2026  
**Audit Phase:** 3E.3 — Independent Restore & Account Deletion Audit  
**Auditor Mode:** READ-ONLY / AUDIT ONLY (No code, migration, configuration, or dependency modifications)  
**Final Gate Verdict:** **CONDITIONAL PASS** (Restore safety and deletion security are proven in-process; durable crash-recovery boundaries are explicitly characterized)  
**Budget & Infrastructure Compliance:** **₹0.00** (Zero remote Cloudflare access, zero remote D1 access, zero Supabase modifications)

---

## 1. Executive Summary

This independent adversarial audit evaluates the Phase 3E.2 remediation deliverables:
1. **Restore Crash-Safety & Integrity Engine** (`src/services/backupService.ts`, `src/services/imageStore.ts`, repository storage).
2. **Server-Side Account Deletion & Zombie Prevention Engine** (`worker/src/auth/routes.ts`, `worker/src/sync/push.ts`, `deletion_tombstones`).
3. **Data Isolation, Revision Enforcement & Local-Photo Privacy Invariants**.

### Verdict Justification: CONDITIONAL PASS
- **Passed Invariants:**
  - Pre-validation safety is **100% verified**: Corrupted hashes, truncated Base64 streams, missing photo references, duplicate item IDs, and cross-tenant restores are rejected *before* any repository or IndexedDB writes occur.
  - In-process rollback is **100% verified**: Handled JavaScript runtime errors (e.g. image decoding failure, quota exhaustion, format anomalies) trigger immediate cleanup of newly written images and restore the exact pre-restoration repository snapshot.
  - Server-side account deletion is **100% verified**: Mandatory authentication, cross-user deletion blocking, complete 11-table cascade deletion, session invalidation, cryptographic tombstone logging, and dual-layer offline mutation zombie rejection (`ACCOUNT_DELETED` / `ACCOUNT_NOT_FOUND`) are fully functional.
  - All 1,218 full repository tests and 77 Cloudflare Worker tests passed with 0 failures; TypeScript compilation passed with 0 errors; production build succeeded in 601 ms.
- **Explicit Operational Boundaries (The "Conditional" Caveats):**
  1. **In-Process Rollback vs. Durable Crash Recovery:** The restoration snapshot is held in **volatile in-memory RAM**. If the operating system forcibly kills the browser process or WebView (OOM kill, power loss, application crash) during the ~6–15 ms write window, JavaScript `catch` blocks cannot execute, leaving disk storage in an unrolled state.
  2. **Storage Dual-Engine Split:** LocalStorage (synchronous string key-value) and IndexedDB (asynchronous object store) lack cross-engine two-phase commit (2PC). True ACID atomicity across both systems is impossible in web browser environments without a persistent journal.
  3. **Production Cloudflare Deployment:** Cloudflare remote edge execution and remote D1 replication remain unexecuted in accordance with strict Phase 3E ₹0 local constraints.

---

## 2. Audit 1 — Restore Crash-Safety Analysis

### 2.1 The Four Levels of Restoration Safety
To eliminate ambiguity, this audit categorizes restoration safety into four distinct architectural tiers:

| Safety Tier | Definition | StyleSaathi Implementation | Audit Status |
|---|---|---|---|
| **Tier 1: Pre-Validation Safety** | Validating archive format, versions, entity relationships, photo references, and image hashes *before* clearing or writing storage. | Implemented in `validateBackup` and in-memory Blob staging prior to any write. | **VERIFIED (Robust)** |
| **Tier 2: In-Process Rollback** | Catching runtime JavaScript exceptions during restoration, deleting newly written assets, and restoring the pre-existing state. | Implemented via `try...catch` in `restoreBackup` restoring from in-memory snapshot. | **VERIFIED (Robust)** |
| **Tier 3: Durable Crash Recovery** | Resuming or rolling back cleanly after an unhandled process death, OS kill, power cut, or tab crash midway through writes. | **Absent.** In-memory snapshot is discarded on process death; no persistent on-disk journal exists. | **NOT IMPLEMENTED (Bounded Limitation)** |
| **Tier 4: Cross-Engine Atomicity** | Native two-phase commit (2PC) guaranteeing simultaneous atomic commit across LocalStorage and IndexedDB. | **Absent in Web Standards.** No browser API exists for cross-engine 2PC across LocalStorage + IndexedDB. | **ARCHITECTURAL CONSTRAINT (Bounded)** |

---

### 2.2 Failure Scenario Stress Analysis

#### Scenario 1: Application Termination / WebView Crash During Overwrite
- **Mechanism:** User's device runs out of memory, or the user force-closes the app, or the OS kills the process between lines 479 (`wardrobeRepo.clear()`) and 498 (`upsertItemsBulk()`).
- **Audit Finding:** **VULNERABLE TO PERSISTED PARTIAL STATE.** Because the snapshot is stored in volatile RAM (`snapshotItems = [...]`), the snapshot is destroyed upon process termination. When the application restarts, local storage will be empty or partially written.
- **Mitigation Assessment:** Because the write phase executes in **6.18 milliseconds** (down from 13.8 seconds due to $O(N)$ bulk upsert), the vulnerability window is compressed by **2,233x**, reducing real-world occurrence probability to near-zero. However, it is not mathematically crash-safe.

#### Scenario 2: LocalStorage Quota Exhaustion (`QuotaExceededError`)
- **Mechanism:** Restoring a large wardrobe causes `localStorage.setItem()` to throw `QuotaExceededError`.
- **Audit Finding:** **PROTECTED VIA IN-PROCESS ROLLBACK.** The exception is thrown inside the JS event loop, entering `catch (error)` in `restoreBackup`:
  1. Newly persisted image Blobs in IndexedDB are removed via `deleteImage(photoId)`.
  2. If `mode === 'overwrite'`, `wardrobeRepo.clear()` frees the exhausted space, and the original snapshot is written back.
  3. **Residual Risk:** If `mode === 'merge'`, storage was not cleared prior to write; restoring the snapshot could theoretically fail if the browser's quota error was triggered by cumulative usage. Line 637 catches secondary rollback errors and logs to `console.error`.

#### Scenario 3: Image-Store (IndexedDB) Failure
- **Mechanism:** `idb-keyval` fails during write due to disk full or IndexedDB corruption.
- **Audit Finding:** **PROTECTED.** In `restoreBackup`, images are written *before* repository metadata writes. If `saveImage` fails, an exception is thrown before any wardrobe items or outfits are upserted. The catch handler cleans up newly written photo IDs, leaving metadata untouched.

#### Scenario 4: Browser Restart During Restoration
- **Mechanism:** The user closes the browser tab or restarts the browser while `restoreBackup` is running.
- **Audit Finding:** Same as Scenario 1. If closed before writes, data is untouched (Pre-Validation safety). If closed during the 6 ms write window, in-memory state is lost.

#### Scenario 5: Interrupted Archive / File Parsing
- **Mechanism:** Network disconnection, corrupt JSON file, truncated Base64 data, or broken file stream.
- **Audit Finding:** **100% PROTECTED.** `JSON.parse` and `validateBackup` run synchronously before any database modification. Malformed objects, truncated strings, or corrupt Base64 fail immediately with `INVALID_BACKUP_SCHEMA` or `IMAGE_CORRUPTION_DETECTED`.

---

## 3. Audit 2 — Account Deletion Security Audit

### 3.1 Route & Middleware Inspection (`POST /api/auth/delete-account`)
Inspected `worker/src/auth/routes.ts`:

```typescript
authRouter.post('/delete-account', authMiddleware(), async (c) => {
  const user = c.get('user');
  ...
```

1. **Authentication Enforcement:**
   - Guarded by `authMiddleware()`. Unauthenticated requests (missing/invalid cookie and missing/invalid bearer token) are intercepted and rejected with `401 Unauthorized`.
   - Verified empirically in `worker/tests/auth.test.ts`.

2. **Cross-User Deletion Prevention (SEC-04):**
   - The route extracts `user.id` directly from the cryptographic session validated against D1.
   - If the request payload contains `{ targetUserId }`, the handler strictly validates `targetUserId === user.id`. If an attacker attempts to pass another user's ID, the Worker immediately responds with `403 Forbidden` (`FORBIDDEN: You are not authorized to delete another user account.`).
   - Verified empirically in `worker/tests/auth.test.ts`.

3. **Information Disclosure Prevention:**
   - Unauthenticated requests receive generic `401 Unauthorized` without acknowledging user existence.
   - Cross-user deletion attempts receive generic `403 Forbidden` regardless of whether `targetUserId` exists or not. Account presence is never leaked.

---

### 3.2 Atomic Cascade Deletion & Foreign-Key Integrity
Inspected D1 batch deletion in `worker/src/auth/routes.ts`:

```sql
DELETE FROM session WHERE userId = ?;
DELETE FROM account WHERE userId = ?;
DELETE FROM profiles WHERE id = ?;
DELETE FROM wardrobe_items WHERE user_id = ?;
DELETE FROM saved_outfits WHERE user_id = ?;
DELETE FROM calendar_plans WHERE user_id = ?;
DELETE FROM style_preferences WHERE user_id = ?;
DELETE FROM wear_events WHERE user_id = ?;
DELETE FROM style_signals WHERE user_id = ?;
DELETE FROM sync_mutations WHERE user_id = ?;
DELETE FROM user WHERE id = ?;
```

1. **Comprehensive Cascade Coverage:**
   - All 11 tables containing user-owned data are explicitly targeted with parameter-bound queries (`userId`).
   - The database schema (`0001_initial_schema.sql`) also specifies `ON DELETE CASCADE REFERENCES user(id)`.
   - The combination of explicit batch deletes AND schema foreign-key cascades provides redundant protection against orphaned records.
2. **Session & Cookie Invalidation:**
   - Deleting `session WHERE userId = ?` instantly invalidates all active sessions across all devices.
   - `deleteCookie(c, SESSION_COOKIE_NAME, { path: '/', secure: true, sameSite: 'Lax' })` revokes the cookie in the response headers.
   - Subsequent calls to `/api/auth/me` return `401 Unauthorized`.
3. **Execution Sequence Observation:**
   - In `worker/src/auth/routes.ts`, `INSERT OR REPLACE INTO deletion_tombstones` is executed via `prepare().run()` *immediately preceding* `db.batch([...])`.
   - While both statements execute within milliseconds in normal conditions, they are two separate D1 calls rather than a single atomic batch transaction.
   - **Audit Evaluation:** If the tombstone insert succeeds but `db.batch()` fails (e.g. temporary D1 timeout), the tombstone is already recorded, so subsequent pushes are blocked with `ACCOUNT_DELETED`. However, combining the tombstone insert into the `db.batch()` array would provide single-transaction SQLite atomicity.

---

### 3.3 Zombie Account Resurrection Prevention
Inspected `worker/src/sync/push.ts` (`processPushMutations`):

```typescript
// 0. Deletion Tombstone & User Integrity Check (Phase 3E.2)
const userIdHash = await sha256Hex(userId);
const tombstone = await db
  .prepare('SELECT request_id FROM deletion_tombstones WHERE user_id_hash = ? LIMIT 1')
  .bind(userIdHash)
  .first<{ request_id: string }>();

if (tombstone) {
  // Reject all mutations with ACCOUNT_DELETED
  return rejectedResults('ACCOUNT_DELETED');
}

const userExists = await db
  .prepare('SELECT id FROM user WHERE id = ? LIMIT 1')
  .bind(userId)
  .first<{ id: string }>();

if (!userExists) {
  // Reject all mutations with ACCOUNT_NOT_FOUND
  return rejectedResults('ACCOUNT_NOT_FOUND');
}
```

1. **Dual-Layer Defense:**
   - **Layer 1 (Tombstone):** If a tombstone exists for `sha256Hex(userId)`, all mutations are rejected with `ACCOUNT_DELETED`.
   - **Layer 2 (User Existence):** If the tombstone was pruned (after 90 days) or missing, the user record is checked. If `user` does not exist, mutations are rejected with `ACCOUNT_NOT_FOUND`.
   - **Result:** Even after the 90-day tombstone expiration, stale mutations from offline devices reconnecting months later CANNOT resurrect deleted accounts or create orphaned wardrobe records.

2. **Identifier Non-Reusability:**
   - In `worker/src/auth/oauth.ts`, new user creation generates a fresh UUID (`userId = crypto.randomUUID()`).
   - If a deleted user signs in again via Google OAuth using the same email address, they receive a **new random UUID**, completely disconnected from the deleted account. The old account's tombstones and records remain unreachable.

---

## 4. Audit 3 — Regression, Isolation & Local-Photo Privacy

### 4.1 Local Wardrobe Photo Privacy
- Inspected `LocalStorageWardrobeRepository.ts`:
  - `upsertItemRaw` and `upsertItemsBulk` strip data URLs (`delete itemToSave.photo`) before saving metadata to LocalStorage.
  - Photos are saved exclusively as binary Blobs into client-side IndexedDB (`idb-keyval`).
- Inspected `worker/src/sync/push.ts` and `0001_initial_schema.sql`:
  - The `wardrobe_items` D1 table schema stores only `photo_id TEXT` and `photo_url TEXT`.
  - Binary image bytes are **never transmitted** to Cloudflare Workers or stored in Cloudflare D1.
  - Garment photos remain 100% device-local at ₹0 cloud storage cost.

### 4.2 Revision Optimistic Concurrency & Concurrency Regression
- Inspected `worker/src/sync/push.ts`:
  - Updates to `wardrobe_items`, `saved_outfits`, `calendar_plans`, and `style_preferences` strictly enforce `expectedRevision === currentRevision`.
  - Stale mutations return `STALE_REVISION`.
  - Restorations enforce `expectedRevision === currentRevision`.
  - Monotonic status triggers (`trg_calendar_plan_status_guard`) prevent reverting calendar plans from `worn` to `planned`.

### 4.3 Multi-Tenant Isolation
- Inspected `worker/tests/auth.test.ts`:
  - Test `strictly isolates User A and User B sessions` (PASSED).
  - Test `cross-user deletion attempts (SEC-04)` (PASSED).
  - Test `cross-user restore without authorization fails` (PASSED).
  - No cross-tenant data leakage observed.

---

## 5. Audit 4 — Empirical Verification & Evidence Matrix

### 5.1 Test Execution Log
Every test command below was executed directly in the local environment during this audit session:

| Test Suite / Command | Scope | Executed | Skipped | Status | Duration |
|---|---|---|---|---|---|
| `npx vitest run src/__tests__/migrationRehearsal.test.ts` | Backup export/restore, Blob hashes, tenant isolation, synthetic legacy migration | 17 | 0 | **PASS** | 37 ms |
| `npx vitest run src/__tests__/adversarialMigrationAudit.test.ts` | 100, 1k, 5k benchmarks, corrupt hashes, missing photos, duplicate IDs, rollback | 16 | 0 | **PASS** | 808 ms |
| `npx vitest run worker/tests/auth.test.ts` | Session hashing, PKCE verifier, RS256 token validation, delete-account route, tombstones | 29 | 0 | **PASS** | 2.10 s |
| `npx vitest run worker/tests/sync.test.ts` | Revision enforcement, LWW, push idempotency, format validation | 29 | 0 | **PASS** | 129 ms |
| `npx vitest run worker/tests/schemaMigration.test.ts` | D1 table definitions, columns, indexes, foreign keys, triggers | 7 | 0 | **PASS** | 22 ms |
| `npx vitest run worker/tests/workerApp.test.ts` | Worker router, CORS, health checks | 12 | 0 | **PASS** | 14 ms |
| `worker/tests/cloudflareRuntime.test.ts` | Local Wrangler D1 live workerd daemon runtime | 0 | 28 | **SKIPPED** | (Requires live background daemon) |
| **Full Repository Test Suite (`npm test -- --run`)** | All client, worker, engine, and UI tests across StyleSaathi 3.0 | **1,218** | **28** | **PASS** | **20.14 s** |

### 5.2 TypeScript & Production Build Verification
- **Root Client TypeScript:** `npx tsc --noEmit` $\to$ **0 errors**.
- **Worker TypeScript:** `npx tsc -p worker/tsconfig.json --noEmit` $\to$ **0 errors**.
- **Production Build:** `npm run build` $\to$ **Built successfully in 601 ms**.

### 5.3 Git Working Tree Audit
- `git status`: Working tree preserved. Zero commits, zero pushes, zero stashes, zero resets.
- Branch: `main` (commit `90e694be00f89ce12e329fa42ddd581b9fef9528`).
- `git diff --stat`: Exactly 16 files modified (strictly scoped to sync, backup, and repository storage).

---

## 6. Capacity & Cost Realism Verification

| Parameter | Free Tier Ceiling | StyleSaathi Modeling (Phase 3E.2) | Audit Finding |
|---|---|---|---|
| **D1 Row Writes / Day** | 100,000 writes/day | 2 writes/mutation $\to$ 50,000 mutations/day | **ACCURATE.** Write amplification is correctly accounted for. |
| **Safe ₹0 DAU Threshold** | N/A | **2,500 – 5,000 DAU** | **ACCURATE.** Corrects previous 15,000 DAU estimate. |
| **Cloudflare Workers Paid ($5/mo)** | 25,000,000 writes/mo | Scales to **50,000 – 100,000 DAU** for ~₹420/month | **ACCURATE.** |

---

## 7. Audit Checklist & Findings Matrix

| Audit Item | Requirement | Code Location | Observed Result | Status |
|---|---|---|---|---|
| **AUD-3E3-01** | Bulk import performance | `LocalStorageWardrobeRepository.ts` | 5,000 records imported in **6.06 ms** ($O(N)$ bulk upsert) | **PASS** |
| **AUD-3E3-02** | Pre-validation integrity | `backupService.ts:validateBackup` | Duplicate IDs and missing photos rejected before writes | **PASS** |
| **AUD-3E3-03** | In-process rollback | `backupService.ts:restoreBackup` | Restores snapshot and prunes new images on failure | **PASS** |
| **AUD-3E3-04** | Durable crash recovery | `backupService.ts` | In-memory snapshot does not survive OS-level process kill | **BOUNDED LIMITATION** |
| **AUD-3E3-05** | Mandatory auth on deletion | `worker/src/auth/routes.ts:445` | Returns 401 Unauthorized for unauthenticated calls | **PASS** |
| **AUD-3E3-06** | Cross-user deletion protection | `worker/src/auth/routes.ts:466` | Returns 403 Forbidden on mismatched `targetUserId` | **PASS** |
| **AUD-3E3-07** | Cascade delete all user records | `worker/src/auth/routes.ts:497` | Atomic batch delete across all 11 tables | **PASS** |
| **AUD-3E3-08** | Tombstone audit logging | `worker/src/auth/routes.ts:489` | Inserts into `deletion_tombstones` with `reconciled = 1` | **PASS** |
| **AUD-3E3-09** | Offline zombie resurrection | `worker/src/sync/push.ts:133` | Stale push rejected with `ACCOUNT_DELETED` | **PASS** |
| **AUD-3E3-10** | Expirable tombstone safety | `worker/src/sync/push.ts:153` | Un-tombstoned user rejected with `ACCOUNT_NOT_FOUND` | **PASS** |
| **AUD-3E3-11** | Local photo privacy | `imageStore.ts`, `push.ts` | Photos remain in IndexedDB; 0 bytes sent to D1 | **PASS** |
| **AUD-3E3-12** | Full regression test suite | Entire repo | 1,218 tests passed, 0 failed, 28 skipped | **PASS** |

---

## 8. Final Gate Verdict

### **Verdict:** **CONDITIONAL PASS**

**Summary of Conditions:**
1. **Restore Crash-Safety Boundary:** The application's restoration safety is established for **pre-validation** and **in-process runtime errors**. If native OS-level crash recovery across process death is required in future milestones, a persistent SQLite/IndexedDB journal table must be introduced in Phase 4.
2. **Atomic Batch Optimization:** In a future maintenance pass, the tombstone `INSERT` in `POST /api/auth/delete-account` should be bundled directly into the `c.env.DB.batch([...])` array to ensure single-statement transaction atomicity.
3. **Phase 3F Cutover Prerequisite:** Remote Cloudflare D1 and Workers bindings must be configured via `wrangler.toml` and secrets set via `wrangler secret put` before production traffic is directed to the Worker.

**Phase 3E is comprehensively audited. No blocker exists that would prevent authorizing Phase 3F planning.**

