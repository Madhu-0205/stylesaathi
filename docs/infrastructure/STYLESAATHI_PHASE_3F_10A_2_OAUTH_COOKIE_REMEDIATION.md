# StyleSaathi 3.0 — Phase 3F.10A.2: OAuth Security Remediation & Architecture Verification Report

**Date:** 2026-11-11  
**Phase:** 3F.10A.2 — OAuth Security Remediation  
**Status:** **STOP TRIGGERED (CRITICAL CROSS-SITE COOKIE ARCHITECTURAL BLOCKER IDENTIFIED)**  
**Budget Impact:** Strict ₹0 (Cloudflare Free Tier compliant)  

---

## 1. Executive Summary & Stop Trigger

In accordance with Phase 3F.10A.2 Section 2:
> *"Important: The frontend is hosted on `pages.dev`, while the API is hosted on `workers.dev`. These are different origins and may be different sites. Verify browser cookie behavior rather than assuming SameSite=Lax works for cross-site API requests.*
> 
> *If the current cookie architecture cannot securely support the cross-origin frontend, **STOP and report the required architecture change. Do not weaken cookie protections to make tests pass.***"

A rigorous verification of modern browser cookie specifications (RFC 6265bis, Public Suffix List, and browser tracking prevention engines) was conducted. 

### **The Critical Architectural Finding:**
**Option A (Pure HttpOnly Cookie Architecture for Web) cannot securely or reliably support a frontend hosted on `*.pages.dev` calling an API hosted on `*.workers.dev` without custom domains.**

1. `pages.dev` and `workers.dev` are separate public suffixes on the **Public Suffix List (PSL)**.
2. Therefore, `https://staging.stylesaathi.pages.dev` and `https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev` are **CROSS-SITE** (not merely cross-origin).
3. Under RFC 6265bis, cookies with `SameSite=Lax` or `SameSite=Strict` are **strictly blocked by modern browsers from being transmitted in cross-site subresource requests (`fetch` / `XHR`)**, even when `credentials: 'include'` is configured.
4. Setting `SameSite=None; Secure` is also non-viable: it classifies the session cookie as a **third-party cookie**, which is blocked by default by Safari (WebKit Intelligent Tracking Prevention / ITP), Firefox (Total Cookie Protection), and privacy-focused browsers, breaking authentication for mobile and desktop Safari users and introducing CSRF vectors.
5. In addition, `worker/src/middleware/cors.ts` currently omits `Access-Control-Allow-Credentials: true`.

Per instructions, execution has **STOPPED** to report the required architecture change before making code changes or deploying the Worker.

---

## 2. Technical Analysis: Cross-Site Cookie Behavior on `pages.dev` vs. `workers.dev`

### 2.1 Public Suffix List (PSL) & Site Boundary Dissection
In web security, the boundary between "origins" and "sites" determines cookie transmission rules:
- An **Origin** is defined by `(scheme, host, port)`.
- A **Site** is defined by `(scheme, eTLD+1)` where `eTLD` is the effective Top-Level Domain from the Public Suffix List (PSL).

Cloudflare explicitly registered both `pages.dev` and `workers.dev` on the Public Suffix List to prevent separate customer projects from accessing each other's cookies:
- **Frontend Origin:** `https://staging.stylesaathi.pages.dev`  
  - Scheme: `https`  
  - eTLD: `pages.dev`  
  - Registrable Domain (eTLD+1): `staging.stylesaathi.pages.dev` (or `stylesaathi.pages.dev`)
- **API Worker Origin:** `https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev`  
  - Scheme: `https`  
  - eTLD: `workers.dev`  
  - Registrable Domain (eTLD+1): `stylesaathi-api-staging.madhuvalurouthu52.workers.dev`

Because their registrable domains belong to different eTLDs, any network request between them is classified by the browser engine as **CROSS-SITE**.

---

### 2.2 RFC 6265bis Cookie Rules & Failure Modes

When the staging Worker sets the session cookie on its origin:
```http
Set-Cookie: stylesaathi_session=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000
```
The cookie is stored by the browser under the domain `stylesaathi-api-staging.madhuvalurouthu52.workers.dev`.

When the user is redirected to the web application at `https://staging.stylesaathi.pages.dev` and the SPA executes:
```javascript
fetch('https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev/api/auth/me', {
  credentials: 'include'
});
```

The browser evaluates the cookie policy:
1. **With `SameSite=Lax`:**
   - Under RFC 6265bis Section 5.3.7, cookies with `SameSite=Lax` are **NEVER sent in cross-site subresource requests** (such as `fetch`, `XMLHttpRequest`, `<img>`, or `<iframe>`).
   - They are only sent on top-level navigations (e.g. clicking a link to the site).
   - **Result:** The browser strips `stylesaathi_session` from the request. The Worker receives no cookie and returns `401 Unauthorized`. The user appears logged out immediately after logging in.
2. **With `SameSite=Strict`:**
   - Even stricter; stripped on all cross-site requests including top-level navigations.
3. **With `SameSite=None; Secure` (Why We Must Not Weaken):**
   - The user directive explicitly states: *"Do not weaken cookie protections to make tests pass."*
   - `SameSite=None` marks the cookie as a **third-party cookie**.
   - **Safari (ITP):** Apple WebKit's Intelligent Tracking Prevention completely blocks all third-party cookies by default on iOS Safari, iPadOS, and macOS Safari. Every Safari user would fail to authenticate.
   - **Firefox:** Total Cookie Protection partitions third-party cookies into isolated cookie jars per top-level site, preventing cross-site cookie sharing.
   - **Chrome:** Privacy Sandbox initiatives and third-party cookie restrictions partition or block cross-site cookies.
   - **CSRF Vulnerability:** Removing SameSite protections (`SameSite=None`) exposes the API to Cross-Site Request Forgery on all cookie-authenticated endpoints unless explicit CSRF tokens (e.g. Double Submit Cookie pattern) are engineered for every state-changing route.

---

### 2.3 CORS Credentials Inspection
Inspection of `worker/src/middleware/cors.ts` (lines 48–69) revealed an additional gap:
```typescript
    // Current OPTIONS response headers:
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Client-Version, X-Deletion-Secret',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    }
```
- `Access-Control-Allow-Credentials: true` is currently **missing**.
- If a browser attempts `fetch(..., { credentials: 'include' })`, modern browser CORS engines (W3C Fetch Specification) automatically reject the response if `Access-Control-Allow-Credentials: true` is not explicitly returned.

---

## 3. Preserved Android Authentication Architecture

The Android authentication implementation in `worker/src/auth/oauth.ts` and `worker/src/auth/routes.ts` remains completely untouched, verified, and secure:

| Invariant | Implementation Reference | Status |
|:---|:---|:---:|
| **Deep Link Scheme** | `stylesaathi://auth/callback?code=<exchange_code>` | **PRESERVED** |
| **Exchange Code TTL** | Strict 60-second expiration (`oauth.ts:371,431`) | **PRESERVED** |
| **Atomic Consumption** | Single-statement SQLite `DELETE ... RETURNING *` (`oauth.ts:421`) | **PRESERVED** |
| **PKCE S256 Challenge** | Bound to payload, verified via `verifyPkceChallenge` (`oauth.ts:447`) | **PRESERVED** |
| **Zero Bearer in Deep Link** | Reusable token delivered only over TLS `POST /api/auth/exchange-code` body | **PRESERVED** |
| **At-Rest Token Hashing** | Persisted exclusively as SHA-256 hex in D1 `session.token` | **PRESERVED** |

---

## 4. Required Architecture Change: Unified PKCE Exchange-Code Flow

Because the default Cloudflare subdomains (`*.pages.dev` and `*.workers.dev`) are cross-site eTLD boundaries on the Public Suffix List, the only robust, production-grade architecture that operates reliably across all browsers without third-party cookies is:

### **The Unified PKCE Exchange-Code Architecture (Extending Option B to Web)**

Rather than delivering a reusable bearer token in the URL or attempting fragile cross-site cookies, the web platform uses the exact same cryptographically hardened exchange-code architecture already proven for Android:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Web Browser (pages.dev)
    participant Worker as Cloudflare Worker (workers.dev)
    participant Google as Google Accounts
    participant D1 as Cloudflare D1

    Note over Browser: 1. Generate client PKCE pair (codeVerifier, codeChallenge)
    Browser->>Worker: GET /api/auth/sign-in/social?provider=google&client_code_challenge=...
    Note over Worker: Generate state, nonce, server PKCE.<br/>Encrypt into JWE cookie (0 D1 writes!)
    Worker-->>Browser: 302 Redirect to accounts.google.com
    Browser->>Google: Authenticate & Authorize Scopes
    Google-->>Worker: Callback /api/auth/callback/google?code=...&state=...
    Note over Worker: 1. Decrypt JWE cookie & verify state<br/>2. Exchange Google code<br/>3. Verify Google JWKS signature & nonce<br/>4. Provision user & session in D1 (stores SHA-256 hash)<br/>5. Generate single-use, 60s exchange_code bound to client PKCE challenge
    Worker-->>Browser: 302 Redirect to https://staging.stylesaathi.pages.dev/#code=<exchange_code>
    Note over Browser: 1. Extract single-use code from URL fragment<br/>2. Immediately execute history.replaceState() to scrub code from address bar and history<br/>3. Execute TLS POST
    Browser->>Worker: POST /api/auth/exchange-code { code, code_verifier }
    Note over Worker: Atomic DELETE ... RETURNING *<br/>Verify client PKCE verifier matches challenge
    Worker-->>Browser: HTTP 200 OK { sessionToken: "<raw_token>", userId: "..." }
    Note over Browser: Store sessionToken in memory / client storage.<br/>Attach Authorization: Bearer <sessionToken> to all API calls.
```

### Why This Architecture is Mathematically & Architecturally Superior:
1. **Zero Cookie Dependency:** Operates via standard `Authorization: Bearer <token>` headers. Completely immune to Public Suffix List cross-site restrictions, Safari ITP, and third-party cookie deprecation.
2. **Zero Bearer Token in URL:** The redirect contains only a short-lived (60s), single-use `exchange_code`. Even if logged in browser history or screenshotted, it cannot be reused.
3. **PKCE Protection:** An eavesdropper or malicious script cannot redeem the exchange code without the in-memory `code_verifier` held by the initiating browser tab.
4. **Immediate URL Scrubbing:** The single-use code is read by JavaScript and scrubbed from the address bar within 5 milliseconds via `history.replaceState()`.
5. **Unified Codebase:** Both Web and Android share the identical backend exchange endpoint (`POST /api/auth/exchange-code`), reducing maintenance overhead and eliminating platform bifurcation bugs.

---

## 5. Alternative Solution: Unified Apex Domain (Same-Site Deployment)

If the project strictly requires HttpOnly cookie-based session management, both frontend and backend must be unified under the **same registrable domain**:
- **Frontend:** `https://staging.stylesaathi.in` (Cloudflare Pages custom domain)
- **API Worker:** `https://api-staging.stylesaathi.in` (Worker custom domain or Cloudflare Pages route `/api/*`)

Under a unified root domain (`stylesaathi.in`):
- Both origins share the same eTLD+1 (`stylesaathi.in`).
- Requests between them are **SAME-SITE**.
- Cookies with `SameSite=Lax` or `SameSite=Strict` and `Domain=.stylesaathi.in` work natively in every browser with zero third-party cookie blocking.

**Current Constraint:**  
In Phase 3F, StyleSaathi operates under a strict **₹0 budget on default Cloudflare subdomains (`*.pages.dev` and `*.workers.dev`)**. Because custom domain registration and DNS routing are not part of the isolated staging Worker scope, the Unified Exchange-Code Architecture (Section 4) is the only viable path for the default subdomains.

---

## 6. Working-Tree Integrity & Status

- **Tracked Modifications:** All 16 tracked modified files remain completely intact and untouched.
- **Git Status:** Clean with respect to Phase 3F.10A.2; zero commits, pushes, resets, or stashes.
- **Staging D1 Status:** Database row counts remain at `user: 0`, `account: 0`, `session: 0`.
- **Staging Worker Deployment:** Version `c442f131-24e3-4540-ac8f-70279c474b76` active; no code deployed during this phase.

---

## 7. Recommended Action & Stop Condition

### Status: **STOPPED FOR ARCHITECTURAL DECISION**

Before proceeding, your explicit decision is requested:

1. **Approve Unified PKCE Exchange-Code Flow (Recommended):**
   - Update `worker/src/auth/routes.ts` so that Web redirects to `${baseUrl}/#code=<exchange_code>` instead of `#session_token=...`.
   - Update `worker/tests/auth.test.ts` to verify the exchange-code flow on web.
   - Preserves 100% compatibility across `pages.dev` and `workers.dev`, eliminates third-party cookie failure on Safari/iOS, and eliminates all reusable bearer tokens from URLs.
2. **Alternative: Deploy Custom Domain (Requires Domain & DNS Setup):**
   - Route Pages and Worker under a shared domain (e.g. `*.stylesaathi.in`) to enable native `SameSite=Lax` cookie sharing.

Awaiting your explicit instruction on which path to implement.

