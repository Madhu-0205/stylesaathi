# STYLESAATHI 3.0 — FINAL OAUTH CONCURRENCY, COOKIE LIFECYCLE & SECURITY AUDIT REPORT

**Document ID:** `STYLESAATHI-3.0-OAUTH-FINAL-SECURITY-AUDIT`  
**Execution Timestamp:** 2026-11-21T20:35:00+05:30  
**Target Environment:** Cloudflare Worker Staging (`stylesaathi-api-staging`) & Cloudflare Pages Staging (`staging.stylesaathi.pages.dev`)  
**Security Status:** **ALL CONCURRENCY & LIFECYCLE AUDITS PASSED · ZERO VULNERABILITIES IDENTIFIED · 100% TESTS PASSED · PRODUCTION FULLY ISOLATED**  

---

## 1. Concurrency, Isolation & Bounded Cookie Lifecycle Architecture

### 1.1 The Two Critical Lifecycle Concerns Evaluated & Fixed

#### Concern 1: Concurrent OAuth Transaction Isolation
- **The Issue in Prior Callback Logic:** The initial implementation deleted all cookies (`OAUTH_TX_COOKIE_NAME`, `OAUTH_TX_COOKIE_NONE`, and state-scoped cookies) unconditionally whenever any callback was handled. If Tab A completed its login, it inadvertently deleted the global fallback cookies that Tab B might have relied on. Furthermore, if an invalid callback with a mismatched state arrived, it deleted cookies before checking `stateData.state !== state`.
- **The Permanent Fix:**
  1. **Strict Single-Transaction Consumption:** When callback validation succeeds for a verified state (`stateData.state === state`), the Worker deletes **ONLY** the transaction cookies matching that exact verified state:
     - `stylesaathi_oauth_tx_${state}` (`Path=/; SameSite=Lax; Max-Age=0`)
     - `stylesaathi_oauth_tx_none_${state}` (`Path=/; SameSite=None; Secure; Max-Age=0`)
  2. **Isolated Global Fallback Deletion:** Global fallback cookies (`stylesaathi_oauth_tx` and `stylesaathi_oauth_tx_none`) are deleted **ONLY IF** the transaction was actually resolved via the fallback (i.e. state-scoped cookies were absent) AND `stateData.state === state`.
  3. **Protection Against Invalid Callbacks:** If `stateData.state !== state` (tampered or mismatched callback), the Worker **NEVER** touches or deletes any valid pending transaction cookies. It returns `INVALID_STATE` (`state_mismatch`) while keeping legitimate active transactions fully intact.

#### Concern 2: Bounded Cookie Lifecycle & Header Size Prevention
- **The Issue:** If each login initiation created new state-scoped cookies without bound, a user opening multiple tabs or repeatedly clicking "Continue with Google" without completing sign-in could accumulate dozens of cookies, bloating request headers toward browser and Cloudflare Worker limits.
- **The Permanent Fix:** Implemented `pruneStaleTransactionCookies()` in `worker/src/auth/routes.ts`:
  1. **Eager Expiry Cleanup:** On every sign-in initiation (`/api/auth/sign-in/social`), the Worker parses incoming `stylesaathi_oauth_tx_*` cookies. Any cookie older than 10 minutes (or with an expired JWE) is immediately deleted via `Set-Cookie: ...; Max-Age=0`.
  2. **FIFO Concurrency Bounding:** Active unexpired transactions are capped at `MAX_CONCURRENT_OAUTH_TRANSACTIONS = 3`. If a user initiates a 4th transaction while 3 are still pending, the Worker automatically evicts the oldest transaction via `Max-Age=0`, ensuring at most 3 outstanding transactions ever exist simultaneously.
  3. **Strict Header Size Boundary:**
     - Maximum active state-scoped cookies: $3 \times 2 = 6$ cookies (~445 bytes each).
     - Maximum global fallback cookies: 2 cookies (~445 bytes each).
     - Maximum total cookies: 8 cookies.
     - Maximum total Cookie header size: $\approx 3,566$ bytes ($< 3.6 \text{ KB}$).
     - Cloudflare Worker limit: **32 KB** (32,768 bytes).
     - Header headroom: Cookies consume only **~11%** of Cloudflare's limit, leaving **~29 KB** of headroom for other headers.

---

## 2. Exhaustive Behavioral Verification Matrix

| Scenario | Architectural Mechanism | Empirical Result | Status |
|:---|:---|:---|:---:|
| **Tab A & Tab B Concurrent Initiation** | State-scoped cookies `_tx_${stateA}` and `_tx_${stateB}` created independently. | Both tabs hold distinct cryptographic transactions. | **PASSED** |
| **Tab A Completes First** | Callback deletes only `_tx_${stateA}`. Tab B's cookie is untouched. | Tab A gets valid session; Tab B transaction remains valid. | **PASSED** |
| **Tab B Completes Second** | Callback finds `_tx_${stateB}`, validates, and deletes only `_tx_${stateB}`. | Tab B gets distinct valid session and user account. | **PASSED** |
| **Replay of Tab A Callback** | `_tx_${stateA}` is gone; Google auth code is single-use. | Replay rejected immediately with HTTP 400 `INVALID_STATE`. | **PASSED** |
| **Invalid Callback / Mismatched State** | Callback state mismatch detected. Cookies for other valid states are NOT deleted. | Attacker callback rejected; legitimate pending transaction succeeds afterwards. | **PASSED** |
| **Expired Transaction (>10m)** | JWE `exp` claim triggers `ERR_JWT_EXPIRED` in `jwtDecrypt`. | Decrypt returns `null`; rejected with `INVALID_STATE` (`session_expired`). | **PASSED** |
| **Repeated Abandoned Logins (10x)** | `pruneStaleTransactionCookies()` evicts oldest active transactions beyond 3 (FIFO). | Outstanding states bounded to $\le 3$; total cookies $\le 8$. | **PASSED** |
| **Browser Cookies Blocked** | No cookies returned on callback $\to$ `!txCookie`. | Browser document navigation safely redirected to `#auth_error=session_expired`. | **PASSED** |

---

## 3. Cryptographic & Security Invariant Proofs

1. **State Acceptance Proof:**  
   Because cookie values are authenticated JWEs encrypted with AES-256-GCM using `AUTH_SECRET`, an attacker cannot forge a state-scoped cookie. On callback, the decrypted payload's internal `stateData.state` is compared with the callback's `state` parameter using strict equality `stateData.state === state`. Forged or mismatched states are mathematically rejected.
2. **PKCE S256 Invariant (SEC-02):**  
   Web clients generate client-side PKCE verifiers and SHA-256 challenges. The single-use exchange code in D1 is bound to `clientCodeChallenge`. The code is consumed atomically via SQLite `DELETE ... RETURNING id` only after PKCE challenge verification succeeds.
3. **Zero Bearer Tokens in URLs (SEC-02 / SEC-08):**  
   Neither Web nor Android ever receives a bearer session token in URL parameters or fragments. Only a single-use, 60-second exchange code is transmitted in the URL fragment (`#code=...`), which is immediately scrubbed from the address bar via `history.replaceState()`.
4. **Zero D1 Writes on Initiation (SEC-05):**  
   All transaction parameters are stored inside the encrypted JWE cookie, maintaining the strict ₹0.00 infrastructure invariant (zero write amplification on unauthenticated endpoints).

---

## 4. Verification Evidence & Test Execution

### 1. Hardened OAuth & Concurrency Suite (`worker/tests/oauthTransactionHardening.test.ts`)
- **17 tests passed | 0 failed** (Duration: 2.30s)
  1. `1. completes valid OAuth flow with hardened cookies and root path` (PASSED)
  2. `2a. rejects missing cookie with HTTP 400 INVALID_STATE for API/test callers` (PASSED)
  3. `2b. redirects browser callers to frontend #auth_error=session_expired when cookie is missing` (PASSED)
  4. `3. rejects expired OAuth transaction cookie (>10m TTL)` (PASSED)
  5. `4. rejects callback when state parameter does not match transaction cookie` (PASSED)
  6. `5. prevents replayed callback by clearing all transaction cookies on consumption` (PASSED)
  7. `6. protects concurrent multi-tab logins via state-scoped cookies without overwrite` (PASSED)
  8. `7. verifies all required security attributes on transaction cookies` (PASSED)
  9. `8a. returns JSON error for API callers when Google returns error parameter` (PASSED)
  10. `8b. redirects browser callers to #auth_error=access_denied when user cancels login` (PASSED)
  11. `9a. allows two concurrent login attempts to complete and redeem exchange codes independently` (PASSED)
  12. `9b. ensures Tab A completing its callback does NOT delete Tab B transaction cookies` (PASSED)
  13. `9c. invalid callback with state mismatch does NOT destroy other active pending transactions` (PASSED)
  14. `9d. replaying a previously redeemed callback fails safely with INVALID_STATE` (PASSED)
  15. `9e. repeated abandoned login attempts are bounded to MAX_CONCURRENT_OAUTH_TRANSACTIONS` (PASSED)
  16. `9f. eagerly prunes expired transaction cookies (>10m) upon new sign-in initiation` (PASSED)
  17. `9g. confirms maximum request-header size remains strictly bounded (< 4 KB, <12% of Cloudflare 32 KB limit) under worst-case concurrency` (PASSED)

### 2. Consolidated Targeted Authentication Suites (7 files)
- Ran all 7 suites: `oauthTransactionHardening.test.ts`, `auth.test.ts`, `stagingConfiguration.test.ts`, `unifiedPkce.test.ts`, `authErrorRecovery.test.tsx`, `clientPkceIntegration.test.tsx`, `pkceAuth.test.ts`.
- **Result:** **94 tests passed | 0 failed** across all 7 suites (Duration: 8.87s).

### 3. Full Application Regression Suite
- Command: `npm test -- --run`
- **Result:** **153 test suites passed | 1 skipped** (`cloudflareRuntime.test.ts`)
- **Test Count:** **1,672 passed | 28 skipped | 0 failed (1,700 total)** (Duration: 50.75s).

### 4. Strict TypeScript Checks
- Frontend: `npx tsc --noEmit -p tsconfig.app.json` $\to$ **0 errors (Exit code 0)**.
- Worker: `npx tsc -p worker/tsconfig.json --noEmit` $\to$ **0 errors (Exit code 0)**.

### 5. Production Vite Build
- Command: `npm run build`
- **Result:** Clean production build in 1.17s. All assets emitted with chunk hashes.

---

## 5. Staging Environment & Production Isolation Confirmation

| Parameter | Configuration Value | Status |
|:---|:---|:---:|
| **Worker Staging Target** | `stylesaathi-api-staging` (`[env.staging]` in `wrangler.toml`) | **ISOLATED** |
| **Worker Staging Host** | `stylesaathi-api-staging.madhuvalurouthu52.workers.dev` | **CONFIRMED** |
| **D1 Staging Database** | `stylesaathi-db-staging` (`c8a7b07e-0664-4533-af17-86374fd3a8cd`) | **ISOLATED** |
| **Frontend Staging Origin** | `https://staging.stylesaathi.pages.dev` | **CONFIRMED** |
| **Google Authorized Redirect URI** | `https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev/api/auth/callback/google` | **CONFIRMED** |
| **Production Resources** | `stylesaathi-api` (prod) and `stylesaathi-db` (prod) | **100% UNTOUCHED** |

---

## 6. Remaining Limitations & Edge Cases Handled

1. **Third-Party / All Cookies Blocked:** If a user completely disables cookies in browser settings, OAuth transaction cookies cannot be stored. Handled gracefully: the Worker redirects to `${APP_URL}/#auth_error=session_expired`, and the frontend displays the luxury Authentication Notice with a clear retry action and no technical jargon.
2. **Tab Eviction Under Extreme Abandonment:** If a user opens $>3$ concurrent Google sign-in tabs simultaneously without finishing any, the 1st tab will be evicted when the 4th tab opens. If the user later returns to the 1st tab, it will safely encounter `INVALID_STATE` and present the "Try Google sign-in again" card. Tab 2, 3, and 4 remain completely unaffected.

---

## 7. Exact Staging Deployment Command

To deploy the verified Worker to staging:
```bash
npx wrangler deploy --config worker/wrangler.toml --env staging
```
No production resources will be modified or deployed.
We await your explicit instruction to proceed with deployment.

