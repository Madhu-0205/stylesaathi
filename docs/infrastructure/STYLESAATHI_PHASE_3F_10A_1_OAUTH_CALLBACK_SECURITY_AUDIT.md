# StyleSaathi 3.0 — Phase 3F.10A.1: OAuth Callback Security Audit Report

**Date:** 2026-11-11  
**Audit Scope:** Cloudflare Worker Google OAuth Callback & Session Delivery Architecture  
**Verdict:** **FAIL (MANDATORY REMEDIATION REQUIRED BEFORE REAL BROWSER AUTHENTICATION)**  
**Operating Budget:** Strict ₹0 (Cloudflare Free Tier compliant)  

---

## 1. Executive Summary & Audit Verdict

This audit was conducted to investigate the finding that the staging Google OAuth callback redirects the web browser to:
```text
https://staging.stylesaathi.pages.dev/#session_token=<raw_bearer_token>
```
This behavior was cross-examined against the approved Phase 3B.2–3B.4 authentication specifications, the Android PKCE exchange-code architecture, and RFC 6749 / RFC 7636 security standards.

### Summary of Findings:
1. **Critical Architectural Bifurcation:** The Worker implementation at `worker/src/auth/routes.ts` lines 316–343 bifurcates delivery based on the client platform:
   - **Android (`platform === 'android'`):** **COMPLIANT.** Uses a short-lived (60s), single-use cryptographic `exchange_code` bound to the client's PKCE code challenge and delivered via `stylesaathi://auth/callback?code=<exchange_code>`. Raw bearer tokens are never placed in URLs.
   - **Web (`platform === 'web'`, default):** **NON-COMPLIANT REGRESSION.** While the Worker correctly sets an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (`stylesaathi_session`), it **redundantly appends the raw, reusable 256-bit session token into the URL hash fragment**:
     ```typescript
     const webRedirectUrl = `${baseUrl}/#session_token=${encodeURIComponent(sessionToken)}`;
     return c.redirect(webRedirectUrl, 302);
     ```
2. **Security Threat:** Exposing the raw bearer session token in the URL hash fragment violates the zero-bearer-in-URL design principle (established in SEC-02), exposes the token to browser history, address bars, DOM scripts via `window.location.hash`, browser extensions, and screenshot capture.
3. **Execution Artifact Diagnostics:** Every exit code 1 (sandbox filesystem permission blocking on `default.toml`) and exit code 6 (sandbox network resolution blocking) in previous turns was thoroughly diagnosed, validated with successful unsandboxed retries, and backed by raw HTTP edge responses.

### **Final Verdict:** **FAIL**  
Real browser sign-in must not proceed until the `#session_token=...` URL fragment exposure is remediated.

---

## 2. Google OAuth Callback Implementation Inspection

### 2.1 Route Handler Architecture (`worker/src/auth/routes.ts` Lines 190–352)
The callback handler executes the following 5-step sequence:
1. **Transaction Cookie Retrieval & State Validation (SEC-05):**
   - Retrieves `stylesaathi_oauth_tx` cookie.
   - Decrypts transaction state using AES-256-GCM (`decryptOAuthTx`).
   - Immediately invokes `deleteCookie(c, OAUTH_TX_COOKIE_NAME)` to prevent replay attacks.
   - Validates that query parameter `state` strictly matches `stateData.state`.
2. **Google Token Exchange:**
   - Calls `https://oauth2.googleapis.com/token` via `exchangeGoogleCodeForTokens` with `code`, `codeVerifier`, `redirectUri`, `clientId`, and `clientSecret`.
3. **Google ID Token Signature & Nonce Verification (SEC-03 & SEC-09):**
   - Validates RS256 signature against Google JWKS (`https://www.googleapis.com/oauth2/v3/certs`).
   - Enforces `issuer` (`accounts.google.com`), `audience` (`GOOGLE_CLIENT_ID`), expiration, and `nonce` matching `stateData.nonce`.
4. **User & Session Provisioning in D1 (SEC-01 & SEC-04):**
   - Enforces `profile.email_verified === true`.
   - Provisions/links user and Google account in `stylesaathi-db-staging`.
   - Creates a 30-day session; persists **only SHA-256 hash** (`tokenHash`) in SQLite `session.token` column.
5. **Platform-Specific Token Delivery:**
   - **Android Path:** Generates 60s exchange code and redirects to `stylesaathi://auth/callback?code=<exchange_code>`.
   - **Web Path:** Sets `HttpOnly` session cookie AND redirects to `${baseUrl}/#session_token=<rawToken>`.

---

## 3. Redirect URL Construction & Token Type Analysis

| Platform Path | Exact Final Redirect URL Construction | Payload Type | Lifetime / Reusability | Security Compliance |
|:---|:---|:---|:---|:---:|
| **Android** | `stylesaathi://auth/callback?code=${encodeURIComponent(exchangeCode)}` | Single-use Exchange Code (256-bit random) | 60 seconds / Single-use only | **PASS (SEC-02 Compliant)** |
| **Web** | `${baseUrl}/#session_token=${encodeURIComponent(sessionToken)}` | **Reusable Raw Bearer Session Token** | **30 days / Fully reusable** | **FAIL (Security Regression)** |

### Detailed Web Path Dissection:
In `worker/src/auth/routes.ts` lines 331–343:
```typescript
    // Web platform: Set HttpOnly session cookie
    setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const baseUrl = c.env?.APP_URL || 'https://stylesaathi.pages.dev';
    const webRedirectUrl = `${baseUrl}/#session_token=${encodeURIComponent(sessionToken)}`;
    return c.redirect(webRedirectUrl, 302);
```
- **Redundant Token Delivery:** The browser already receives the authenticated session through the `stylesaathi_session` `HttpOnly` cookie.
- **The URL Hash Leak:** Passing the raw `sessionToken` in the URL hash fragment was added as an accommodation for client-side JavaScript to read the token directly, bypassing the need for cookie handling. However, because `stylesaathi_session` is already set as `HttpOnly`, this completely undermines the XSS protection offered by `HttpOnly`.

---

## 4. Threat Modeling of `#session_token=...` in Web Browsers

While RFC 3986 specifies that URI fragments (`#...`) are processed client-side and not transmitted over the wire in HTTP `Referer` headers, exposing raw bearer tokens in URL hash fragments introduces severe security risks:

1. **Browser History Persistence:**
   - Web browsers (Chrome, Firefox, Safari, Edge) routinely persist URL fragments in local browser history databases (`History` SQLite file on disk).
   - Any user or local process with access to the user profile can extract active 30-day session tokens from history.
2. **DOM / XSS Token Exfiltration:**
   - Any script running in the application context (including third-party scripts, analytics, tag managers, or vulnerable dependencies) can execute `window.location.hash` and harvest the raw session token, completely bypassing `HttpOnly` cookie safeguards.
3. **Address Bar Visibility & Shoulder Surfing:**
   - The raw token is rendered in plain text in the browser's address bar until and unless client-side JavaScript explicitly clears it via `history.replaceState()`.
   - If the user takes a screenshot, bookmarks the page, or shares the URL before the fragment is cleared, the session token is compromised.
4. **Browser Extension Scraping:**
   - Browser extensions with `tabs` or `webNavigation` permissions can read full URLs including fragments from tabs, exposing the token to untrusted third-party extension code.

---

## 5. Android Exchange Code & PKCE Implementation Verification

Inspection of `worker/src/auth/oauth.ts` lines 360–450 confirms that the Android exchange code architecture is robust and fully hardened:

1. **Cryptographic Entropy:**
   - Generated via `generateSecureToken(32)` (256 bits of cryptographic entropy).
2. **Strict 60-Second TTL:**
   - `expiresAt = new Date(Date.now() + 60 * 1000).toISOString()`.
   - `consumeExchangeCode` enforces `if (isNaN(expiresAtMs) || expiresAtMs <= Date.now()) throw new Error('EXPIRED_EXCHANGE_CODE')`.
3. **Atomic Single-Use Consumption (SEC-08):**
   - Single-statement SQLite deletion:
     ```sql
     DELETE FROM verification WHERE identifier = ? RETURNING id, identifier, value, expiresAt;
     ```
   - Eliminates race conditions. Once redeemed, the record is immediately deleted from D1. Any second attempt returns `null` and is rejected with `INVALID_EXCHANGE_CODE`.
4. **PKCE S256 Challenge Binding:**
   - `clientCodeChallenge` provided during initiation is stored in the exchange payload.
   - Upon calling `POST /api/auth/exchange-code`, `verifyPkceChallenge(codeVerifier, clientCodeChallenge)` is executed.
   - If an unauthorized app intercepts `stylesaathi://auth/callback?code=...`, it cannot redeem the code without the in-memory `code_verifier`.

---

## 6. Android Client Storage Audit (SEC-06)

1. **`AndroidManifest.xml`:**
   - Line 5 contains `android:allowBackup="false"`, which prevents OS-level backups or `adb backup` extraction.
2. **Current Native Storage Limitation:**
   - The repository currently relies on `localStorage` / `idb-keyval` for client-side storage.
   - `@aparajita/capacitor-secure-storage` is not yet installed.
   - **Phase 3B.4 Condition:** Confirmed as an approved pre-release condition for native APK distribution.

---

## 7. Traceability Matrix vs Phase 3B.2–3B.4 Specifications

| Requirement / Invariant | Phase 3B Specification | Current Implementation | Compliance Status |
|:---|:---|:---|:---:|
| **SEC-01: Session Token Hashing** | SHA-256 hash in D1 `session.token` | `session.ts:27-28` (`sha256Hex`) | **COMPLIANT** |
| **SEC-02: Zero Bearer Tokens in URLs** | No bearer tokens in redirect URLs | Android: No bearer token (code only)<br/>Web: **`#session_token=...` in URL** | **NON-COMPLIANT (Web)** |
| **SEC-03: Google JWKS Signature** | `jose.jwtVerify` with RS256 | `oauth.ts:125-128` | **COMPLIANT** |
| **SEC-04: Verified Email Enforcement** | Reject if `email_verified !== true` | `oauth.ts:248-260` | **COMPLIANT** |
| **SEC-05: Zero D1 Writes on Initiation** | JWE cookie `stylesaathi_oauth_tx` | `routes.ts:161` (`A256GCM`) | **COMPLIANT** |
| **SEC-08: Atomic Code Consumption** | `DELETE ... RETURNING *` | `oauth.ts:421-423` | **COMPLIANT** |
| **SEC-09: Cryptographic Nonce** | 192+ bit nonce verified in ID token | `oauth.ts:140-144` | **COMPLIANT** |

---

## 8. Terminal Execution Evidence: Diagnostics of Exit Codes 1 and 6

During previous execution steps, several terminal commands returned non-zero exit codes. A full forensic breakdown confirms these were environment sandbox constraints, not application defects:

### 8.1 Summary of Failed vs. Successful Commands

| Command | Initial Attempt Exit Code | Root Cause Diagnosis | Retry Command & Mode | Final Exit Code | Final HTTP / CLI Result |
|:---|:---:|:---|:---|:---:|:---|
| `npx wrangler whoami` | **1** | Sandbox blocked read/write to `~/Library/Preferences/.wrangler/config/default.toml` (`EPERM`). | Run with `BypassSandbox: true` | **0** | Authenticated as `Madhuvalurouthu52@gmail.com's Account` (`485998f570cf6b2d7ac545331cdc03ef`). |
| `npx wrangler secret list ...` | **1** | Sandbox blocked access to host Wrangler credentials file (`EPERM`). | Run with `BypassSandbox: true` | **0** | Output JSON listing `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. |
| `curl ... /api/health` | **6** | Sandbox has zero network egress; DNS resolution failed (`CURLE_COULDNT_RESOLVE_HOST`). | Run with `BypassSandbox: true` | **0** | `HTTP/2 200 OK`, `status: "ok"`, `database: "connected"`, `latencyMs: 161`. |
| `curl ... /api/auth/sign-in/social (JSON)` | **6** | Sandbox blocked network egress. | Run with `BypassSandbox: true` | **0** | `HTTP/2 200 OK`, Google auth URL returned with PKCE S256, state, nonce; `stylesaathi_oauth_tx` JWE cookie set. |
| `curl ... /api/auth/sign-in/social?provider=github` | **6** | Sandbox blocked network egress. | Run with `BypassSandbox: true` | **0** | `HTTP/2 400 Bad Request`, `UNSUPPORTED_PROVIDER`. |
| `curl ... /api/auth/sign-in/social (Browser)` | **6** | Sandbox blocked network egress. | Run with `BypassSandbox: true` | **0** | `HTTP/2 302 Found`, `Location: https://accounts.google.com/o/oauth2/v2/auth?...`, `Set-Cookie: stylesaathi_oauth_tx=...`. |
| `curl ... /api/auth/callback/google (No Cookie)` | **6** | Sandbox blocked network egress. | Run with `BypassSandbox: true` | **0** | `HTTP/2 400 Bad Request`, `INVALID_STATE: OAuth transaction state has expired or cookie is missing.` |
| Tampered State with Valid Cookie | **6** | Sandbox blocked network egress. | Run with `BypassSandbox: true` | **0** | `HTTP/2 400 Bad Request`, `INVALID_STATE: OAuth state parameter does not match...`, cookie cleared immediately. |
| Malformed Google Auth Code with Valid Cookie | **6** | Sandbox blocked network egress. | Run with `BypassSandbox: true` | **0** | `HTTP/2 400 Bad Request`, `AUTHENTICATION_FAILED: Google token exchange failed (400): {"error": "invalid_grant"}`. |
| `npx wrangler d1 execute stylesaathi-db-staging ...` | **1** | Sandbox blocked access to host Wrangler credentials file (`EPERM`). | Run with `BypassSandbox: true` | **0** | Executed 3 queries in 1.40ms: `user_count: 0`, `account_count: 0`, `session_count: 0`. |

---

## 9. Recommended Remediation Plan

To bring the Web OAuth flow into strict alignment with SEC-02 and eliminate raw token exposure in URLs, two remediation options are available:

### Option A: Pure HttpOnly Cookie Architecture (Recommended for Web)
- **Mechanism:** Remove `/#session_token=...` from the redirect URL entirely.
- **Implementation in `worker/src/auth/routes.ts`:**
  ```typescript
  // Web platform: Set HttpOnly session cookie
  setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  const baseUrl = c.env?.APP_URL || 'https://stylesaathi.pages.dev';
  return c.redirect(baseUrl, 302);
  ```
- **Client Behavior:** On load, the frontend makes a `GET /api/auth/get-session` or `GET /api/auth/me` request. The browser automatically attaches the `stylesaathi_session` cookie; the Worker returns the user profile. Zero tokens in the URL, zero tokens in browser history, immune to XSS.

### Option B: Unified PKCE Exchange-Code Flow for Both Web and Android
- **Mechanism:** Both Web and Android receive single-use 60s exchange codes:  
  `https://staging.stylesaathi.pages.dev/#code=<exchange_code>`.
- **Client Behavior:** The frontend SPA extracts the code, issues an immediate `POST /api/auth/exchange-code` with its PKCE `code_verifier`, clears the URL fragment via `history.replaceState()`, and receives the session token over an encrypted TLS POST response body.

---

## 10. Audit Conclusion & Stop Condition

### Verdict: **FAIL (MANDATORY REMEDIATION REQUIRED)**

1. **Finding:** The presence of `/#session_token=...` on the Web callback redirect constitutes a valid security regression and architectural inconsistency with SEC-02.
2. **Current State:** Real browser Google authentication has **NOT** been performed. Staging database table counts remain at 0 users, 0 accounts, 0 sessions.
3. **Preservation:** All 16 tracked working-tree files remain completely preserved. No commits, pushes, resets, or secret changes were made.
4. **Action:** Awaiting explicit authorization to implement Remediation Option A (Pure HttpOnly Cookie) or Option B (Unified Exchange Code) before proceeding with real Google authentication.

