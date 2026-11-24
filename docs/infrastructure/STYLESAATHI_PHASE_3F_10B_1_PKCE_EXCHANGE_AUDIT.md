# STYLESAATHI 3.0 — PHASE 3F.10B.1: PKCE EXCHANGE-CODE CONSUMPTION AUDIT & REMEDIATION REPORT

**Document ID:** `STYLESAATHI-3.0-PHASE-3F-10B-1-PKCE-EXCHANGE-AUDIT`  
**Execution Timestamp:** 2026-11-11T15:00:00+05:30  
**Status:** **PASSED — REMEDIATION VERIFIED (LOCAL ONLY — ZERO DEPLOYMENTS)**  
**Target Module:** `worker/src/auth/oauth.ts` (`consumeExchangeCode`)  
**Database Audited:** `stylesaathi-db-staging` (`c8a7b07e-0664-4533-af17-86374fd3a8cd`)  
**Deployment Status:** **0 Deployments Performed (Strict Boundary Honored)**  
**Cost Incurred:** **$0.00 / ₹0.00**

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 Reported Behavior
During the Phase 3F.10B live staging verification:
1. Submitting a valid exchange code with an incorrect PKCE code verifier returned `403 PKCE_VERIFICATION_FAILED`.
2. A subsequent submission of the same exchange code with the correct PKCE code verifier returned `400 INVALID_EXCHANGE_CODE`.

### 1.2 Root Cause Investigation
In `worker/src/auth/oauth.ts`, lines 420–424 of the previous implementation executed:
```typescript
const row = await db
  .prepare(`DELETE FROM verification WHERE identifier = ? RETURNING id, identifier, value, expiresAt`)
  .bind(identifier)
  .first<VerificationRow>();

if (!row) {
  throw new Error('INVALID_EXCHANGE_CODE: Exchange code is invalid, expired, or has already been used.');
}
```
This query unconditionally deleted the exchange code from the D1 `verification` table before performing cryptographic PKCE validation (`verifyPkceChallenge`).

When an incorrect PKCE code verifier was supplied:
- The database record was already deleted from D1.
- `verifyPkceChallenge(codeVerifier, payload.clientCodeChallenge)` returned `false`.
- The function threw `PKCE_VERIFICATION_FAILED`.
- The exchange code had been prematurely consumed ("burned").
- Any subsequent legitimate retry with the correct verifier failed with `INVALID_EXCHANGE_CODE` because the record no longer existed.

---

## 2. Exact Remediation Implemented

In `worker/src/auth/oauth.ts`, `consumeExchangeCode` was restructured into a safe two-phase verification and consumption lifecycle:

### Two-Phase Safe Redemption Architecture
1. **Non-Destructive Retrieval:**  
   Query the exchange-code record using `SELECT ... WHERE identifier = ?`. The record remains in the database during validation.
2. **TTL Expiry Check:**  
   Validate that `expiresAtMs > Date.now()`. If expired, eagerly clean up the expired record and throw `EXPIRED_EXCHANGE_CODE`.
3. **PKCE Challenge Verification:**  
   If `payload.clientCodeChallenge` is present, verify the supplied `codeVerifier` against the stored S256 challenge using `verifyPkceChallenge`. If the verifier does not match, throw `PKCE_VERIFICATION_FAILED` **without deleting or consuming the exchange code**.
4. **Post-Verification Atomic Consumption:**  
   Only after PKCE verification succeeds, execute an atomic conditional delete:
   ```typescript
   const consumed = await db
     .prepare(`DELETE FROM verification WHERE id = ? RETURNING id`)
     .bind(row.id)
     .first<{ id: string }>();

   if (!consumed) {
     throw new Error('INVALID_EXCHANGE_CODE: Exchange code is invalid, expired, or has already been used.');
   }
   ```
5. **Concurrency Guarantee:**  
   If two concurrent requests both pass the read and verification phases with the correct verifier, SQLite's single-statement `DELETE ... RETURNING` ensures that exactly **one** request deletes the row and receives `consumed.id`. The second concurrent request deletes 0 rows, receives `null`, and fails closed with `INVALID_EXCHANGE_CODE`.

### Full Implementation (`worker/src/auth/oauth.ts`):
```typescript
export async function consumeExchangeCode(
  db: D1Database,
  rawExchangeCode: string,
  codeVerifier?: string | null
): Promise<{ sessionToken: string; userId: string }> {
  if (!rawExchangeCode || typeof rawExchangeCode !== 'string' || rawExchangeCode.trim().length === 0) {
    throw new Error('INVALID_EXCHANGE_CODE: Missing or malformed exchange code.');
  }

  const codeHash = await sha256Hex(rawExchangeCode);
  const identifier = `exchange_code:${codeHash}`;

  interface VerificationRow {
    id: string;
    identifier: string;
    value: string;
    expiresAt: string;
  }

  // 1. Retrieve the exchange-code record without consuming it (Phase 3F.10B.1 remediation)
  const row = await db
    .prepare(`SELECT id, identifier, value, expiresAt FROM verification WHERE identifier = ?`)
    .bind(identifier)
    .first<VerificationRow>();

  if (!row) {
    throw new Error('INVALID_EXCHANGE_CODE: Exchange code is invalid, expired, or has already been used.');
  }

  // 2. Validate 60-second TTL expiration
  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    // Eager cleanup of expired code
    try {
      await db.prepare(`DELETE FROM verification WHERE id = ?`).bind(row.id).run();
    } catch {
      // Best-effort cleanup
    }
    throw new Error('EXPIRED_EXCHANGE_CODE: Exchange code has expired (60s lifetime exceeded).');
  }

  let payload: ExchangeCodePayload;
  try {
    payload = JSON.parse(row.value) as ExchangeCodePayload;
  } catch {
    throw new Error('CORRUPT_EXCHANGE_DATA: Failed to parse exchange code payload.');
  }

  // 3. Validate PKCE client code verifier if client challenge was bound
  // Reject incorrect verifiers WITHOUT consuming the exchange code
  if (payload.clientCodeChallenge) {
    if (!codeVerifier) {
      throw new Error('MISSING_CODE_VERIFIER: PKCE code verifier is required to redeem this exchange code.');
    }
    const isValid = await verifyPkceChallenge(codeVerifier, payload.clientCodeChallenge);
    if (!isValid) {
      throw new Error('PKCE_VERIFICATION_FAILED: PKCE code verifier does not match the registered challenge.');
    }
  }

  // 4. Atomically consume the code ONLY after successful PKCE verification (SEC-02 & SEC-08)
  // Single-statement DELETE RETURNING ensures exactly one concurrent request succeeds
  const consumed = await db
    .prepare(`DELETE FROM verification WHERE id = ? RETURNING id`)
    .bind(row.id)
    .first<{ id: string }>();

  if (!consumed) {
    throw new Error('INVALID_EXCHANGE_CODE: Exchange code is invalid, expired, or has already been used.');
  }

  return {
    sessionToken: payload.sessionToken,
    userId: payload.userId,
  };
}
```

---

## 3. Concurrency & Retry Test Evidence

### 3.1 Unit Test Coverage (`worker/tests/auth.test.ts`)
```typescript
it('rejects exchange code redemption if PKCE code verifier is wrong without consuming the code (Phase 3F.10B.1)', async () => {
  // Attempt 1: Wrong verifier fails with PKCE_VERIFICATION_FAILED
  await expect(
    consumeExchangeCode(d1, rawExchangeCode, 'wrong-client-code-verifier')
  ).rejects.toThrow('PKCE_VERIFICATION_FAILED');

  // Attempt 2: Correct verifier on same code succeeds (code was NOT consumed!)
  const redeemed = await consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier);
  expect(redeemed.sessionToken).toBe(rawToken);
  expect(redeemed.userId).toBe('user-1');

  // Attempt 3: Already consumed code fails with INVALID_EXCHANGE_CODE
  await expect(
    consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier)
  ).rejects.toThrow('INVALID_EXCHANGE_CODE');
});

it('handles concurrent correct redemption attempts: exactly one succeeds (Phase 3F.10B.1)', async () => {
  const results = await Promise.allSettled([
    consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier),
    consumeExchangeCode(d1, rawExchangeCode, clientPkce.codeVerifier),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect((fulfilled[0] as PromiseFulfilledResult<any>).value.sessionToken).toBe(rawToken);
  expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('INVALID_EXCHANGE_CODE');
});
```

### 3.2 Route-Level Test Coverage (`worker/tests/unifiedPkce.test.ts`)
```typescript
it('rejects Web code redemption when wrong PKCE code_verifier is supplied without consuming the code (Phase 3F.10B.1)', async () => {
  // 1. Wrong verifier fails with 403 PKCE_VERIFICATION_FAILED
  const res = await app.request('/api/auth/exchange-code', { ... wrongPkce ... }, testEnv);
  expect(res.status).toBe(403);

  // 2. Retry with correct verifier on SAME code succeeds with 200 OK (code was NOT burned!)
  const retryRes = await app.request('/api/auth/exchange-code', { ... clientPkce ... }, testEnv);
  expect(retryRes.status).toBe(200);

  // 3. Second redemption with correct verifier fails with 400 INVALID_EXCHANGE_CODE (replayed)
  const replayedRes = await app.request('/api/auth/exchange-code', { ... clientPkce ... }, testEnv);
  expect(replayedRes.status).toBe(400);
});
```

---

## 4. Staging D1 Database Cleanup Audit (`stylesaathi-db-staging`)

All 14 tables in `stylesaathi-db-staging` (`c8a7b07e-0664-4533-af17-86374fd3a8cd`) were audited via `npx wrangler d1 execute --remote`:

| Table Name | Category | Record Count | Audit Finding |
|:---|:---|:---:|:---|
| `d1_migrations` | Schema Migrations | **3** | `0001`, `0002`, `0003` active schema migrations |
| `account` | Auth / OAuth Accounts | **0** | Clean baseline; 0 test records |
| `calendar_plans` | Outfit Calendar | **0** | Clean baseline; 0 test records |
| `deletion_tombstones` | Account Deletion | **0** | Clean baseline; 0 test records |
| `profiles` | User Profiles | **0** | Clean baseline; 0 test records |
| `saved_outfits` | Wardrobe Outfits | **0** | Clean baseline; 0 test records |
| `session` | Auth Sessions | **0** | Clean baseline; 0 test records |
| `style_preferences` | User Style Preferences | **0** | Clean baseline; 0 test records |
| `style_signals` | Wear / Style Signals | **0** | Clean baseline; 0 test records |
| `sync_mutations` | Sync Mutation Log | **0** | Clean baseline; 0 test records |
| `user` | User Accounts | **0** | Clean baseline; 0 test records |
| `verification` | Exchange Codes / Nonces | **0** | Clean baseline; 0 exchange records |
| `wardrobe_items` | Garment Items | **0** | Clean baseline; 0 test records |
| `wear_events` | Garment Wear History | **0** | Clean baseline; 0 test records |

**Staging Database Finding:**  
Every single application data table contains exactly **0** records. All synthetic test records created during Phase 3F.10B were verified completely removed. The database is in an entirely clean baseline state.

---

## 5. Comprehensive Test Results & Build Telemetry

### 5.1 Worker Test Suite (`worker/tests`)
```bash
npx vitest run worker/tests
```
- **Test Files:** 6 passed, 1 skipped (`worker/tests/cloudflareRuntime.test.ts`)
- **Tests:** 101 passed, 28 skipped (0 failed)
- **Duration:** 10.09s

### 5.2 Client PKCE Integration Suite
```bash
npx vitest run src/__tests__/clientPkceIntegration.test.tsx src/__tests__/pkceAuth.test.ts
```
- **Test Files:** 2 passed
- **Tests:** 18 passed (0 failed)
- **Duration:** 3.21s

### 5.3 Full Repository Test Suite
```bash
npm test
```
- **Test Files:** 125 passed | 1 skipped (126 total files)
- **Tests:** 1,260 passed | 28 skipped (1,288 total tests)
- **Failed Tests:** **0**
- **Duration:** 94.23s

### 5.4 TypeScript & Build Checks
| Verification Command | Purpose | Result | Notes |
|:---|:---|:---:|:---|
| `npx tsc --noEmit -p worker/tsconfig.json` | Worker TypeScript Check | **PASSED (0 errors)** | Full Worker type safety confirmed |
| `npm run typecheck` (`tsc -p tsconfig.app.json`) | Application TypeScript Check | **PASSED (0 errors)** | React frontend type safety confirmed |
| `npm run build` (`tsc -b && vite build`) | Production Vite Build | **PASSED (0 errors)** | Production bundle created in 1.58s |

---

## 6. Git Working Tree & Boundary Compliance

```bash
git status --short
```
- **Tracked Modifications Preserved (18 files):**
  1. `android/app/src/main/AndroidManifest.xml`
  2. `package-lock.json`
  3. `package.json`
  4. `src/App.tsx`
  5. `src/__tests__/syncQueue.test.ts`
  6. `src/context/AuthContext.tsx`
  7. `src/hooks/useSyncStatus.ts`
  8. `src/lib/sync/conflictResolvers.ts`
  9. `src/lib/sync/syncQueue.ts`
  10. `src/lib/sync/syncService.ts`
  11. `src/repositories/LocalStorageCalendarRepository.ts`
  12. `src/repositories/LocalStorageStyleSignalsRepository.ts`
  13. `src/repositories/LocalStorageWardrobeRepository.ts`
  14. `src/repositories/LocalStorageWearEventsRepository.ts`
  15. `src/repositories/WardrobeRepository.ts`
  16. `src/screens/ProfileScreen.tsx`
  17. `src/services/deepLinkHandler.ts`
  18. `src/types.ts`
- **Git Operations:** Zero commits, zero pushes, zero resets, zero stashes, zero checkouts.
- **Strict Scope Boundaries:**
  - **Zero Worker Deployments:** The Worker was NOT redeployed.
  - **Zero Pages Deployments:** Cloudflare Pages remains undeployed.
  - **Zero Browser Logins:** No real Google account login performed.
  - **Zero Production Access:** Production Worker, D1, and secrets untouched.
  - **Zero Supabase Access:** Supabase remains paused, untouched, and unreferenced.
  - **Zero Paid Upgrades:** ₹0 / $0 spend maintained.

---

## 7. Stop Condition Active

Phase 3F.10B.1 remediation and local validation are **COMPLETE**.

In accordance with strict operational boundaries:
- **EXECUTION IS STOPPED.**
- The remediation is verified locally across all 1,260 tests.
- Awaiting explicit user approval before redeploying the updated Worker to the staging environment.

