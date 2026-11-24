# StyleSaathi 3.0 — Phase 3F.10A.4: Unified PKCE Integration Audit Report

**Date:** 2026-11-11  
**Audit Type:** Independent, Adversarial, Read-Only Client & Backend Integration Audit  
**Phase:** 3F.10A.4 — Unified PKCE Integration Audit  
**Operating Budget:** Strict ₹0 (Cloudflare Free Tier compliant)  

---

## 1. Executive Summary & Audit Verdict

### **EXECUTIVE VERDICT: CONDITIONAL PASS (BACKEND VERIFIED — CLIENT UI WIRING BLOCKED)**

This adversarial, read-only audit evaluated the Unified PKCE Exchange-Code implementation across the Cloudflare Worker backend, the client PKCE cryptographic utilities, and the production React application lifecycle.

### Key Audit Conclusions:
1. **Cloudflare Worker Backend (`worker/src/auth/`):** **PASS (100% COMPLIANT)**  
   The backend callback logic has been unified. The insecure `#session_token=...` redirect has been completely eliminated. Both Web (`pages.dev/#code=...`) and Android (`stylesaathi://auth/callback?code=...`) receive only a 60-second, single-use `exchange_code` bound to the client's PKCE S256 challenge. Atomic consumption via SQLite `DELETE ... RETURNING *` and constant-time PKCE verifier validation are empirically proven.
2. **Client PKCE Cryptographic Module (`src/lib/auth/pkce.ts`):** **PASS (100% COMPLIANT)**  
   The standalone client library properly implements RFC 7636 PKCE (`crypto.getRandomValues`, SHA-256 base64url challenge), immediate URL fragment scrubbing (`history.replaceState`), strict memory-only token storage (zero persistence in `localStorage` or `sessionStorage`), and TLS POST exchange.
3. **Production React Application UI Wiring (`src/context/AuthContext.tsx`, `src/App.tsx`, `src/services/deepLinkHandler.ts`):** **FAIL (NOT IMPLEMENTED IN RUNTIME)**  
   **Critical Gap:** The production application code does **not yet invoke the new PKCE utilities**. 
   - `AuthContext.tsx` still calls legacy `supabaseAuthRepository.signInWithGoogle()`, which fails immediately because Supabase is paused.
   - `src/App.tsx` has no startup listener or hook calling `extractAndScrubExchangeCode()` when the user lands on `https://staging.stylesaathi.pages.dev/#code=...`.
   - `src/services/deepLinkHandler.ts` line 123 still invokes `supabase.auth.exchangeCodeForSession(code)` rather than calling the Worker's `/api/auth/exchange-code`.
   - `src/lib/sync/syncService.ts` does not read from `getInMemorySessionToken()`.
4. **Deployment State:** The updated Worker backend has **NOT been deployed to staging** (staging remains on Phase 3F.9 version `c442f131-24e3-4540-ac8f-70279c474b76`). Remote staging D1 database contains 0 users, 0 accounts, and 0 sessions.

---

## 2. 13-Step Flow Traceability Matrix

Every step of the complete end-to-end authentication lifecycle was traced through the codebase:

| Step # | Flow Step Description | File & Line Reference | Implementation Status | Findings & Audit Evidence |
|:---:|:---|:---|:---:|:---|
| **1** | Client generates cryptographically random verifier | `src/lib/auth/pkce.ts:60–73` (`generatePkceVerifier`) | **UTILITY PASS / UI NOT IMPLEMENTED** | Function uses `crypto.getRandomValues(new Uint8Array(64))` with RFC 7636 unreserved charset. Tested in `pkceAuth.test.ts`. **Not invoked by `AuthContext.tsx`**. |
| **2** | Client computes S256 challenge | `src/lib/auth/pkce.ts:78–86` (`generatePkceChallenge`) | **UTILITY PASS / UI NOT IMPLEMENTED** | Uses `crypto.subtle.digest('SHA-256')` and Base64url encoding without padding. **Not invoked by `AuthContext.tsx`**. |
| **3** | Client retains verifier securely for pending login | `src/lib/auth/pkce.ts:91–117` (`savePendingPkceVerifier`) | **UTILITY PASS / UI NOT IMPLEMENTED** | Scoped to transient `sessionStorage` key across the redirect; scrubbed immediately on retrieval. **Not invoked by `AuthContext.tsx`**. |
| **4** | Client sends challenge to OAuth initiation | Target: `GET /api/auth/sign-in/social?client_code_challenge=...` | **NOT IMPLEMENTED IN UI** | `AuthView.tsx` calls `AuthContext.signInWithGoogle()`, which calls `supabase.auth.signInWithOAuth()`. Worker endpoint is not called. |
| **5** | Worker binds challenge to encrypted OAuth transaction | `worker/src/auth/routes.ts:81–159` (`handleSocialSignIn`) | **PASS** | Extracts `client_code_challenge` from query/body; encrypts into `stylesaathi_oauth_tx` JWE cookie (`A256GCM`) with `secretKey` (0 D1 writes). |
| **6** | Google callback validates state, nonce, signature, issuer, aud, email | `worker/src/auth/routes.ts:190–305` (`authRouter.get('/callback/google')`) | **PASS** | Decrypts JWE cookie, validates state, verifies RS256 signature against Google JWKS (`verifyGoogleIdToken`), validates nonce, issuer, and `email_verified: true`. |
| **7** | Worker creates 60s, single-use exchange code bound to challenge | `worker/src/auth/oauth.ts:362–393` (`createExchangeCode`) | **PASS** | 256-bit entropy (`generateSecureToken(32)`), stored as SHA-256 hash in D1 `verification`, 60-second TTL, bound to `clientCodeChallenge`. |
| **8** | Web receives `#code=...` or Android receives deep-link code | `worker/src/auth/routes.ts:327–344` | **PASS** | Android: `stylesaathi://auth/callback?code=...`<br/>Web: `${baseUrl}/#code=...`. Reusable bearer tokens are 100% eliminated from URLs. |
| **9** | Client immediately scrubs the URL | `src/lib/auth/pkce.ts:134–168` (`extractAndScrubExchangeCode`) | **UTILITY PASS / UI NOT IMPLEMENTED** | Function parses `#code=...` and calls `history.replaceState()`. **Not called on startup in `App.tsx` or `AuthContext.tsx`**. |
| **10** | Client redeems code with original verifier | `src/lib/auth/pkce.ts:173–216` (`redeemExchangeCode`) | **UTILITY PASS / UI NOT IMPLEMENTED** | Function issues TLS POST to `/api/auth/exchange-code`. In `src/services/deepLinkHandler.ts:123`, Android still calls `supabase.auth.exchangeCodeForSession`. |
| **11** | Worker atomically consumes code and creates session | `worker/src/auth/routes.ts:357–426` & `oauth.ts:400–455` | **PASS** | Single-statement `DELETE ... RETURNING *`, checks 60s TTL, validates `verifyPkceChallenge(codeVerifier, challenge)`, returns `{ sessionToken, userId }`. |
| **12** | Client stores session token only in memory | `src/lib/auth/pkce.ts:18–34` (`setInMemorySession`) | **UTILITY PASS / UI NOT IMPLEMENTED** | In-memory closure variables only. Zero writes to `localStorage` or `sessionStorage`. **Not connected to React context state**. |
| **13** | Authenticated API & sync requests use session token | `src/lib/sync/workerSyncClient.ts:101–103` | **CLIENT SUPPORTS / UNWIRED** | Sync client accepts `Authorization: Bearer <token>`, but `syncService.ts` has no reference to `getInMemorySessionToken()`. |

---

## 3. PKCE Security & Cryptographic Audit

1. **Entropy & RFC 7636 Compliance:**
   - Client verifier generated via `crypto.getRandomValues(new Uint8Array(64))` with 64 unreserved ASCII characters (`[A-Za-z0-9\-._~]`), providing $\approx 380$ bits of entropy.
   - Compliant with RFC 7636 Section 4.1.
2. **SHA-256 S256 Challenge Calculation:**
   - Calculated via `crypto.subtle.digest('SHA-256', TextEncoder.encode(verifier))`, Base64url-encoded with padding stripped (`replace(/=+$/, '')`).
   - Compliant with RFC 7636 Section 4.2.
3. **Zero Verifier Leakage:**
   - Verifier is never appended to URL queries or fragments.
   - Sent exclusively in the encrypted TLS POST request body to `/api/auth/exchange-code`.
   - Never logged to console, analytics, or persistent storage.
4. **Tamper-Proof Challenge Binding:**
   - `clientCodeChallenge` is authenticated and encrypted inside the `stylesaathi_oauth_tx` JWE cookie using AES-256-GCM. An attacker cannot inject or replace the challenge in flight.
5. **Exchange Code Randomness & Lifespan:**
   - Code length: 32 random bytes (256 bits).
   - Invalidation: Enforced 60-second expiration (`oauth.ts:430–433`).
   - At-Rest Storage: Only the SHA-256 hash (`identifier = 'exchange_code:' + sha256Hex(rawCode)`) is persisted in D1 SQLite table `verification`.
6. **Atomic Consumption & Concurrency Defense:**
   - Consumed via atomic SQLite `DELETE FROM verification WHERE identifier = ? RETURNING *`.
   - In `worker/tests/unifiedPkce.test.ts:251–284`, two parallel concurrent redemption calls were executed with identical codes; exactly one returned `200 OK` and the second returned `400 Bad Request` (`INVALID_EXCHANGE_CODE`). Replay attacks are physically impossible.
7. **Cross-User Isolation:**
   - Tested in `worker/tests/unifiedPkce.test.ts:377–412`. User A's bearer token cannot read User B's identity or data on `/api/auth/me`.
8. **Elimination of Open Redirects:**
   - Redirect targets are fixed: Web always redirects to `${baseUrl}/#code=...` (allowlisted via `APP_URL`), and Android always redirects to `stylesaathi://auth/callback?code=...`. No user query parameter can divert the destination.

---

## 4. Session Lifecycle & Storage Audit

### 4.1 Storage Inspection (`src/lib/auth/pkce.ts`)
- **`localStorage`:** **0 writes**. Verified in `src/__tests__/pkceAuth.test.ts:85–89`.
- **`sessionStorage`:** **0 session tokens written**. Only the transient, short-lived `code_verifier` is stored during redirect transit and immediately deleted on retrieval.
- **`IndexedDB`:** **0 session tokens written**.
- **URL Query / Fragment:** **0 session tokens written**. URLs contain only single-use `#code=...`.

### 4.2 Session Revocation
- Tested in `worker/tests/unifiedPkce.test.ts:340–374`.
- Calling `POST /api/auth/sign-out` with `Authorization: Bearer <token>` deletes the session record from D1. Subsequent requests to `/api/auth/me` return `401 Unauthorized`.

### 4.3 Browser Refresh Invariant (Documented Limitation)
- Because session tokens are strictly memory-only on Web, **a full browser page refresh clears the in-memory token**.
- This limitation is acknowledged, deliberate, and complies with the user constraint: *"Do not claim that login persists across reloads. Document this limitation until a separately reviewed secure renewal architecture exists."*

### 4.4 Android Native Storage Gate (SEC-06)
- Inspection confirms `@aparajita/capacitor-secure-storage` is **not installed** in `package.json`.
- `AndroidManifest.xml` has `android:allowBackup="false"`.
- In accordance with Phase 3B.4, native Keystore encryption is a **mandatory release blocker** for Android APK distribution.

---

## 5. CORS, Browser, and PSL Compatibility

1. **Public Suffix List (PSL) Cross-Site Immunity:**
   - The Unified PKCE flow uses `Authorization: Bearer <token>` in HTTP headers.
   - It eliminates cross-site cookie transmission between `staging.stylesaathi.pages.dev` (eTLD: `pages.dev`) and `stylesaathi-api-staging.madhuvalurouthu52.workers.dev` (eTLD: `workers.dev`).
   - Browser cookie engines cannot block or partition header-based bearer tokens.
2. **Safari ITP Compatibility:**
   - Because no third-party cookies are required, Apple WebKit Intelligent Tracking Prevention (ITP) has zero effect on the authentication flow.
3. **CORS Configuration (`worker/src/middleware/cors.ts`):**
   - Staging Origins Allowlist: `https://staging.stylesaathi.pages.dev`, `https://stylesaathi-staging.pages.dev`, `capacitor://localhost`, `https://localhost`.
   - Wildcards: Zero wildcards. `Access-Control-Allow-Origin` strictly matches the allowlist.
   - Headers: `Authorization` is explicitly listed in `Access-Control-Allow-Headers`.

---

## 6. Test Evidence & Honest Accounting

### 6.1 Test Execution Scorecard

| Category | File | Tests Run | Tests Passed | Tests Skipped | Environment |
|:---|:---|:---:|:---:|:---:|:---|
| **Client PKCE Unit Tests** | `src/__tests__/pkceAuth.test.ts` | 9 | **9** | 0 | Vitest / JSDOM (In-Memory) |
| **Unified PKCE Backend Tests** | `worker/tests/unifiedPkce.test.ts` | 8 | **8** | 0 | Vitest / Node SQLite (In-Memory) |
| **Worker Auth Tests** | `worker/tests/auth.test.ts` | 29 | **29** | 0 | Vitest / Node SQLite (In-Memory) |
| **Sync Engine Tests** | `worker/tests/sync.test.ts` | 29 | **29** | 0 | Vitest / Node SQLite (In-Memory) |
| **Staging Config Tests** | `worker/tests/stagingConfiguration.test.ts` | 14 | **14** | 0 | Vitest (In-Memory) |
| **Worker Core App Tests** | `worker/tests/workerApp.test.ts` | 12 | **12** | 0 | Vitest (In-Memory) |
| **D1 Schema Migration Tests** | `worker/tests/schemaMigration.test.ts` | 7 | **7** | 0 | Vitest (In-Memory) |
| **Cloudflare Runtime Live Tests** | `worker/tests/cloudflareRuntime.test.ts` | 28 | **0** | **28** | Skipped (Dry-run mode) |
| **Total Automated** | | **136** | **108** | **28** | |

### 6.2 Reality Check on Live Staging & Browser Tests
- **Deployed Staging Worker:** The deployed Worker at `https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev` is **still running Phase 3F.9 code** (Version `c442f131-24e3-4540-ac8f-70279c474b76`). The newly authored Unified PKCE code has **NOT been deployed** to Cloudflare edge yet (per instructions).
- **Real Browser Login:** **NOT PERFORMED**. No human has completed real Google OAuth on the Unified PKCE flow.
- **Skipped Test Accounting:** All 28 skipped tests in `cloudflareRuntime.test.ts` are explicitly counted as skipped, not passed.

---

## 7. Git and Infrastructure Integrity

1. **Git Branch & HEAD:**
   - **Branch:** `main`
   - **HEAD Commit:** `90e694be00f89ce12e329fa42ddd581b9fef9528`
2. **Preservation of Tracked Working Tree:**
   All 16 tracked modified files remain untouched and identical:
   - `android/app/src/main/AndroidManifest.xml`
   - `package-lock.json`, `package.json`
   - `src/App.tsx`, `src/types.ts`
   - `src/__tests__/syncQueue.test.ts`
   - `src/hooks/useSyncStatus.ts`, `src/lib/sync/conflictResolvers.ts`, `src/lib/sync/syncQueue.ts`, `src/lib/sync/syncService.ts`
   - `src/repositories/LocalStorageCalendarRepository.ts`, `LocalStorageStyleSignalsRepository.ts`, `LocalStorageWardrobeRepository.ts`, `LocalStorageWearEventsRepository.ts`, `WardrobeRepository.ts`
   - `src/screens/ProfileScreen.tsx`
3. **Staging D1 Database Status:**
   - Read-only query executed: `SELECT count(*) FROM user; account; session;`
   - Result: `user_count: 0`, `account_count: 0`, `session_count: 0`. Zero remote rows modified.
4. **Cost & Production Boundaries:**
   - ₹0 spent. Production Worker, Pages, D1, and Supabase remain 100% untouched.

---

## 8. Security Findings & Prioritized Action Items

### **Finding SEC-PKCE-01 (HIGH): React Client UI Disconnected from PKCE Backend**
- **Severity:** **HIGH (Functional & Architectural Blocker)**
- **Detail:** `src/context/AuthContext.tsx` still calls `supabaseAuthRepository.signInWithGoogle()`. The new PKCE module `src/lib/auth/pkce.ts` is only referenced in unit tests.
- **Remediation Required:**
  1. Wire `AuthContext.tsx` `signInWithGoogle()` to:
     - Generate PKCE pair (`generatePkceVerifier`, `generatePkceChallenge`).
     - Save verifier in `sessionStorage` (`savePendingPkceVerifier`).
     - Redirect browser to `https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev/api/auth/sign-in/social?provider=google&client_code_challenge=${challenge}`.
  2. Wire `src/App.tsx` (or `AuthContext.tsx`) startup `useEffect` to:
     - Check `window.location.hash` for `code=`.
     - Call `extractAndScrubExchangeCode()`.
     - Retrieve stored verifier (`getAndClearPendingPkceVerifier()`).
     - Call `redeemExchangeCode(apiBaseUrl, code, verifier)`.
     - Set authenticated user in React state.
  3. Wire `src/services/deepLinkHandler.ts` to call `/api/auth/exchange-code` instead of Supabase.
  4. Wire `src/lib/sync/syncService.ts` to pass `getInMemorySessionToken()` to `workerSyncClient`.

### **Finding SEC-PKCE-02 (MEDIUM): Staging Worker Needs Deployment After UI Wiring**
- **Severity:** **MEDIUM**
- **Detail:** Cloudflare Worker currently deployed in staging is running Phase 3F.9 code. Once UI wiring is approved and reviewed, the Worker must be redeployed via `npx wrangler deploy --env staging`.

### **Finding SEC-PKCE-03 (LOW): Android Keystore Secure Storage Release Gate**
- **Severity:** **LOW (Pre-Release Blocker)**
- **Detail:** `@aparajita/capacitor-secure-storage` is absent; required before native packaging.

---

## 9. Conclusion & Stop Condition

### Status: **READ-ONLY AUDIT COMPLETE — STOPPED**

All verification steps were completed strictly in read-only mode. Zero code edits, zero deployments, and zero data mutations were made during this turn.

**Awaiting your instructions on proceeding with the client UI integration (Finding SEC-PKCE-01) or next steps.**

