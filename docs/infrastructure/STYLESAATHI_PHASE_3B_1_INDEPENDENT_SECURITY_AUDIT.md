# StyleSaathi 3.0 — Phase 3B.1: Independent Authentication Security Audit

**Document Version:** 1.0.0  
**Phase:** Phase 3B.1 / Security Gate Audit  
**Operating Budget:** Strict ₹0  
**Audit Type:** READ-ONLY Adversarial Security & Architecture Verification  
**Author:** Independent Principal Infrastructure Architect & Application Security Auditor  
**Date:** November 7, 2026  

---

## 1. Executive Summary & Audit Verdict

This document presents a comprehensive, adversarial, read-only security audit of the newly implemented Phase 3B authentication system (`worker/src/auth/`, `worker/src/middleware/auth.ts`, `worker/tests/auth.test.ts`, and the Android native Capacitor configuration).

The specific objective of this audit is to determine whether the Phase 3B authentication foundation is sufficiently hardened, robust, and safe to authorize **Phase 3C (Delta Synchronization Engine)**.

### 1.1 Overall Audit Verdict

# **VERDICT: FAIL**

**Authorizing Phase 3C is strictly BLOCKED.**

The audit identified **3 Critical Severity** vulnerabilities, **3 High Severity** vulnerabilities, and **4 Medium Severity** issues in the implementation. Building data synchronization (Phase 3C) on top of the current authentication baseline would expose synchronized user wardrobes, outfits, and wear history to account takeover, token theft, and denial of service.

### 1.2 Summary of Findings

| ID | Finding Title | Severity | Location | Blocks Phase 3C? |
| :--- | :--- | :--- | :--- | :---: |
| **SEC-01** | Raw Session Tokens Persisted in Plaintext at Rest in D1 | **CRITICAL** | `session.ts:53-56`, `schema.sql:25` | **YES** |
| **SEC-02** | Long-Lived Bearer Session Token Leakage via Custom Scheme Deep Link | **CRITICAL** | `routes.ts:256-259`, `AndroidManifest.xml:30-34` | **YES** |
| **SEC-03** | Google ID Token Cryptographic Signature Verification Skipped (`decodeJwt`) | **CRITICAL** | `oauth.ts:227-240`, `routes.ts:228` | **YES** |
| **SEC-04** | Account Takeover via Unverified Email Account Linking (`email_verified` ignored) | **HIGH** | `oauth.ts:341-348` | **YES** |
| **SEC-05** | Unauthenticated D1 Write Amplification / Quota DoS on OAuth Initiation | **HIGH** | `routes.ts:93-138`, `oauth.ts:69-78` | **YES** |
| **SEC-06** | Android Token Insecurity: Plaintext SharedPreferences & Unprotected Cloud Backups | **HIGH** | `package.json`, `AndroidManifest.xml:5` | **Conditional** |
| **SEC-07** | False "Better Auth" Integration Classification (Supply Chain Mislabeling) | **MEDIUM** | `package.json`, `README.md`, `Report` | **No** |
| **SEC-08** | Non-Atomic OAuth State Consumption (Replay Race Condition) | **MEDIUM** | `oauth.ts:115-128` | **No** |
| **SEC-09** | Missing Nonce Parameter in Google OIDC Authorization Flow | **MEDIUM** | `oauth.ts:140-155` | **No** |
| **SEC-10** | Mock-Polluted Integration Tests Masking Critical Cryptographic Paths | **MEDIUM** | `auth.test.ts:550-650` | **No** |

---

## 2. Better Auth Identity Verification

### 2.1 Investigation
The Phase 3B implementation report repeatedly characterized the deliverable as a "Better Auth integration" and "Better Auth compatible router". A rigorous inspection was conducted of the repository dependencies and worker source files.

- `package.json` inspection:
  - `better-auth` is **NOT** present in `dependencies`.
  - `better-auth` is **NOT** present in `devDependencies`.
- `package-lock.json` inspection: Zero references to `better-auth`.
- `worker/src/auth/` inspection:
  - No Better Auth core runtime (`betterAuth({ ... })`) is instantiated.
  - No Better Auth adapters (`better-auth/adapters/d1`) are used.
  - No Better Auth plugins (`bearer()`) are loaded.
  - `worker/src/auth/` is a **100% custom, bespoke TypeScript implementation** written from scratch.

### 2.2 Finding Classification (SEC-07 — Severity: Medium)
- **Classification:** **Category B: Custom authentication implementation using similar endpoint conventions.**
- **Risk Analysis:** Labeling a bespoke implementation as "Better Auth" creates a dangerous false sense of security. The true Better Auth library undergoes extensive third-party testing, security audits, and constant CVE patching. A custom hand-rolled authentication engine carries significant operational and cryptographic implementation risks, as proven by the vulnerabilities uncovered in this audit.
- **Required Remediation:** 
  1. Update all documentation to clearly label the system as a **bespoke, zero-dependency custom authentication micro-service** inspired by the Better Auth table schema.
  2. Alternatively, if true Better Auth is desired, formally approve and install `better-auth` when network connectivity is available.

---

## 3. Android Token Storage & Native Security Audit

### 3.1 Investigation
The Android token storage claims were verified against `package.json`, `android/app/src/main/AndroidManifest.xml`, and the Capacitor configuration.

- **Dependency Gap:** `@capacitor/preferences` is **not installed** in `package.json`. The application currently has no installed Capacitor plugin for persistent key-value storage.
- **Underlying Capacitor Preferences Storage:**
  Even if `@capacitor/preferences` were installed, its official Android implementation uses:
  ```java
  context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
  ```
  This stores data in **unencrypted plaintext XML** at:
  `/data/data/com.stylesaathi.app/shared_prefs/CapacitorStorage.xml`.
  It does **NOT** use `androidx.security.crypto.EncryptedSharedPreferences`.
  It does **NOT** use Android KeyStore.
- **Unsecured Backup Configuration:**
  In `android/app/src/main/AndroidManifest.xml` (line 5):
  ```xml
  <application
      android:allowBackup="true"
      ...
  ```
  `android:allowBackup="true"` allows Android to back up the entire private data directory (`/data/data/com.stylesaathi.app/`)—including `CapacitorStorage.xml`—to Google Drive cloud backups and over ADB via `adb backup`.

### 3.2 Finding Classification (SEC-06 — Severity: High)
- **Exact Location:** `package.json`, `android/app/src/main/AndroidManifest.xml` (line 5).
- **Attack Scenario:**
  1. An attacker with physical access or ADB access connects the device and executes `adb backup -f backup.ab com.stylesaathi.app`.
  2. The plaintext XML file `CapacitorStorage.xml` is extracted.
  3. The attacker extracts the 30-day session token and gains authenticated access to the user's account without unlocking the app.
  4. Furthermore, any device sync to Google Cloud copies unencrypted session credentials to third-party cloud infrastructure.
- **Impact:** Compromise of long-lived session tokens via device extraction, rooted devices, or cloud backups.
- **Required Remediation:**
  1. Set `android:allowBackup="false"` in `AndroidManifest.xml` or configure `android:dataExtractionRules` / `backup_rules.xml` to exclude shared preferences.
  2. Use a native secure storage plugin backed by Android `EncryptedSharedPreferences` and Android KeyStore (AES-256 GCM) for persisting session tokens on Android.
- **Blocks Phase 3C:** **Conditional** (Must be remediated before publishing or deploying the Android build).

---

## 4. Deep-Link Token Transfer & Callback Vulnerability Audit

### 4.1 Investigation
The Android OAuth redirect mechanism was inspected in `worker/src/auth/routes.ts` (lines 254–260) and `android/app/src/main/AndroidManifest.xml` (lines 26–35).

In `worker/src/auth/routes.ts`:
```typescript
if (stateData.platform === 'android') {
  // Android Capacitor deep link
  const deepLink = `stylesaathi://auth/callback#session_token=${encodeURIComponent(
    auth.session.token
  )}`;
  return c.redirect(deepLink, 302);
}
```

In `android/app/src/main/AndroidManifest.xml`:
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="stylesaathi"
        android:host="auth"
        android:path="/callback" />
</intent-filter>
```

### 4.2 Finding Classification (SEC-02 — Severity: CRITICAL)
- **Exact Location:** `worker/src/auth/routes.ts` (lines 256–259), `android/app/src/main/AndroidManifest.xml` (lines 26–35).
- **Vulnerability Mechanism:**
  1. **Custom Scheme Interception:** The Android operating system provides **zero ownership verification** for custom schemes (`stylesaathi://`). Any malicious application installed on the user's device can declare the identical intent filter in its `AndroidManifest.xml`.
  2. **Direct Delivery of Final Bearer Token:** The URL fragment `#session_token=<token>` contains the **actual 30-day bearer session credential**. When Chrome Custom Tabs executes the 302 redirect, Android resolves the intent. If a malicious app intercepts the intent (or prompts the user via a system disambiguation dialog), the malicious app reads `intent.getData().toString()` including the fragment and steals the bearer session token.
  3. **Zero Proof of Possession:** The token returned via the deep link requires no secondary secret or PKCE verifier to be redeemed. Once intercepted, the attacker has permanent, full access to the user's account.
  4. **Log & History Exposure:** Full URLs with custom schemes can be logged to Android system logcat and browser history.
- **Attack Scenario:**
  A user installs a rogue wallpaper, game, or utility app on their phone. That app declares an intent filter for `stylesaathi://auth/callback`. When the user logs in to StyleSaathi via Google, the malicious app captures the deep link redirect and exfiltrates the victim's session token to an attacker-controlled C2 server.
- **Impact:** Immediate and complete account takeover for any Android user.
- **Required Remediation:**
  1. **Never pass bearer session tokens over custom URI schemes.**
  2. Implement the **Authorization Code Exchange Pattern**:
     - When Google OAuth succeeds, the worker generates a short-lived (60-second), single-use, high-entropy `exchange_code`.
     - The worker redirects to: `stylesaathi://auth/callback?code=<exchange_code>`.
     - The mobile app intercepts the deep link, extracts the `code`, and executes a secure, TLS-encrypted `POST /api/auth/token` call sending `{ code, code_verifier }`.
     - The worker validates the code and verifies that the `code_verifier` matches the PKCE challenge generated by the mobile client at session start.
     - Even if a rogue app intercepts `stylesaathi://auth/callback?code=...`, it cannot exchange the code because it does not possess the in-memory `code_verifier`.
  3. Upgrade from custom URI schemes (`stylesaathi://`) to **Android App Links** (`https://stylesaathi.pages.dev/auth/callback`) verified cryptographically via `/.well-known/assetlinks.json`.
- **Blocks Phase 3C:** **YES (Hard Blocker)**.

---

## 5. Google OAuth & Identity Security Audit

### 5.1 Investigation
The Google OAuth service was inspected in `worker/src/auth/oauth.ts` and `worker/src/auth/routes.ts`.

#### A. ID Token Signature Verification (SEC-03 — Severity: CRITICAL)
In `worker/src/auth/oauth.ts` (lines 210–240):
```typescript
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  keyOrJwks?: JwtVerifyKey
): Promise<GoogleProfile> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing ID token');
  }

  let payload: any;

  if (keyOrJwks) {
    const result = await jwtVerify(idToken, keyOrJwks as any, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    payload = result.payload;
  } else {
    // Decode and validate standard claims
    payload = decodeJwt(idToken); // <--- DECODE ONLY, NO RS256 SIGNATURE VERIFICATION!
    const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
    if (!payload.iss || !validIssuers.includes(payload.iss)) {
      throw new Error(`Invalid token issuer: ${payload.iss}`);
    }
    if (payload.aud !== clientId) {
      throw new Error(`Invalid token audience: ${payload.aud}`);
    }
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      throw new Error('ID token has expired');
    }
  }
```
And in `worker/src/auth/routes.ts` (line 228):
```typescript
const profile = await verifyGoogleIdToken(tokens.id_token, clientId);
```
**CRITICAL VULNERABILITY:** `keyOrJwks` is **omitted** by the router!
`decodeJwt(idToken)` merely decodes the unverified base64 JSON payload. It does **NOT** verify the digital RS256 signature against Google's public key certificates (`https://www.googleapis.com/oauth2/v3/certs`)!
- **Violation:** Direct violation of OpenID Connect Core 1.0 (Section 3.1.3.7: "The Client MUST validate the signature of the ID Token according to JWS using the keys supplied in the IdP's JWKS document").
- **Attack Scenario:** Any crafted or modified JWT with `{ "iss": "https://accounts.google.com", "aud": clientId, "sub": "victim-sub", "email": "victim@example.com" }` is accepted as an authentic, Google-verified identity if an attacker controls or proxies the token endpoint response.
- **Required Remediation:** Instantiate `createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))` from `jose` and pass it to `jwtVerify` so every incoming ID token is cryptographically verified against Google's rotating RSA public keys.
- **Blocks Phase 3C:** **YES (Hard Blocker)**.

#### B. Account Takeover via Unverified Email Linking (SEC-04 — Severity: HIGH)
In `worker/src/auth/oauth.ts` (lines 335–348):
```typescript
// 2. Check if a user exists with the same email
interface UserRow {
  id: string;
  email: string;
}

const existingUser = await db
  .prepare(`SELECT id, email FROM user WHERE email = ?`)
  .bind(profile.email)
  .first<UserRow>();

if (existingUser) {
  userId = existingUser.id; // <--- LINKS WITHOUT CHECKING email_verified!
}
```
**HIGH SEVERITY VULNERABILITY:**
The code links the incoming Google profile to an existing user based solely on email equality (`profile.email === existingUser.email`), **without verifying that `profile.email_verified === true`**!
- **Attack Scenario:**
  1. A victim registers an account on StyleSaathi with `alice@workplace.com`.
  2. An attacker registers a Google account (or Google Workspace alias) for `alice@workplace.com`, but does not verify ownership. Google marks `email_verified: false` in the ID token.
  3. The attacker signs in to StyleSaathi using this Google account.
  4. StyleSaathi matches `alice@workplace.com`, binds `userId = existingUser.id`, links the attacker's Google account to Alice's profile, and issues an active session.
  5. The attacker now possesses Alice's StyleSaathi account and all her wardrobe data.
- **Required Remediation:**
  Enforce explicit verification before account linking:
  ```typescript
  if (!profile.email_verified) {
    throw new Error('Google account email is not verified. Account linking rejected.');
  }
  ```
- **Blocks Phase 3C:** **YES (Hard Blocker)**.

#### C. Missing Nonce Parameter (SEC-09 — Severity: Medium)
In `worker/src/auth/oauth.ts`:
The authorization URL constructed in `buildGoogleAuthorizationUrl` does not include a `nonce` parameter, and `verifyGoogleIdToken` does not validate a nonce claim.
- **Risk:** Without a `nonce`, the ID token cannot be cryptographically tied to the user's active client session, exposing the system to potential token replay across different sessions.
- **Remediation:** Include a high-entropy random nonce in the authorization request and verify `payload.nonce === expectedNonce`.

---

## 6. Session Security & D1 Storage Audit

### 6.1 Plaintext Session Tokens Stored in D1 (SEC-01 — Severity: CRITICAL)
- **Exact Location:** `worker/migrations/0001_initial_schema.sql` (line 25), `worker/src/auth/session.ts` (lines 53–56, 126–128).
- **Vulnerability Mechanism:**
  When a session is created:
  ```typescript
  const token = generateSecureToken(32); // 64-char hex string
  ...
  await db.prepare('INSERT INTO session (id, userId, token, ...) VALUES (?, ?, ?, ...)')
    .bind(id, userId, token, ...).run();
  ```
  The raw 256-bit bearer token is written directly to the SQLite `session` table in **PLAINTEXT**.
  When validating:
  ```typescript
  SELECT ... FROM session s JOIN user u ON s.userId = u.id WHERE s.token = ?
  ```
  The database is queried directly using the raw token.
- **Attack Scenario:**
  1. An attacker exploits a future SQL injection, D1 read replica leakage, backup exfiltration, or worker debug dump.
  2. The attacker reads the `session` table.
  3. Because tokens are stored in plaintext, the attacker instantly possesses the active credentials of **every logged-in user in the system**.
  4. The attacker can impersonate any user worldwide without cracking hashes or triggering alarms.
- **Industry Standard (OWASP, RFC 6750, Better Auth, Stripe, GitHub):**
  Raw session tokens must **NEVER** be persisted in plaintext. Only a cryptographic hash (`SHA-256(token)`) may be stored in the database.
- **Required Remediation:**
  1. Compute `tokenHash = toHex(await crypto.subtle.digest('SHA-256', encoder.encode(token)))`.
  2. Insert `tokenHash` into `session.token` (or rename column to `token_hash`).
  3. On validation, hash the incoming token from `Authorization: Bearer <token>` and query `WHERE token = ?` passing `tokenHash`.
  4. If the D1 database is ever leaked, the attacker cannot use the stored hashes as bearer tokens.
- **Blocks Phase 3C:** **YES (Hard Blocker)**.

### 6.2 Session Rotation & Invalidation
- **Session Expiration:** Correctly enforced via ISO 8601 timestamps (`s.expiresAt > Date.now()`). Eager pruning of expired sessions is implemented.
- **Revocation:** Correctly deletes the session row from D1 on `/api/auth/sign-out`.
- **Session Rotation:** Lacking. A session token remains valid for 30 days without sliding-window rotation or rotation upon privilege escalation.

### 6.3 Cookie Security
- `Set-Cookie` uses `HttpOnly: true`, `Secure: true`, `SameSite: 'Lax'`, and `Max-Age: 2592000`.
- **Cross-Domain Caveat:** In production, if Cloudflare Pages is hosted at `stylesaathi.pages.dev` and the Worker is at `stylesaathi-api.<subdomain>.workers.dev`, third-party cookie restrictions in Safari, Chrome, and Firefox will block the session cookie. This reinforces why `Authorization: Bearer <token>` must be the primary authentication mechanism.

---

## 7. Abuse Protection & Operational Security Audit

### 7.1 Unauthenticated D1 Write Amplification / Quota DoS (SEC-05 — Severity: HIGH)
- **Exact Location:** `worker/src/auth/routes.ts` (lines 93–138), `worker/src/auth/oauth.ts` (lines 69–78).
- **Vulnerability Mechanism:**
  `GET /api/auth/sign-in/social` is completely unauthenticated and unprotected by rate limiting. Every invocation performs a database write:
  ```typescript
  await db.prepare('INSERT INTO verification (id, identifier, value, expiresAt, ...) VALUES (?, ?, ?, ...)')
    .bind(...).run();
  ```
- **Attack Scenario:**
  - StyleSaathi operates on Cloudflare D1 Free Tier with a **daily limit of 100,000 row writes**.
  - An attacker runs a basic shell loop:
    ```bash
    seq 1 100000 | xargs -P 50 -I {} curl -s "https://api.stylesaathi.in/api/auth/sign-in/social?provider=google"
    ```
  - In under 3 minutes, the entire daily 100,000 write quota for the D1 database is consumed.
  - The D1 database enters quota-exhaustion mode.
  - **All write operations across the entire application (user signups, logins, sync pushes, wardrobe creation, deletions) immediately fail with HTTP 500 / 503 D1 quota errors.**
  - Operating budget is ₹0, so no automated upgrade occurs; the application remains dead for all users until quota resets at midnight UTC.
- **Impact:** Total application-wide denial of service with zero financial cost to the attacker.
- **Required Remediation:**
  1. **Eliminate D1 writes on OAuth initiation.**
     Do not store OAuth state and PKCE verifier in D1!
     Instead, store them in a signed, short-lived (10-minute) `HttpOnly` cookie or encrypted state token signed with an `AUTH_SECRET` (HMAC-SHA256).
     This reduces D1 writes on OAuth initiation from **1 write per attempt to 0 writes per attempt**.
  2. Implement an in-memory or IP-based rate limiting guard on `/api/auth/sign-in/social`.
- **Blocks Phase 3C:** **YES (Hard Blocker)**.

### 7.2 Non-Atomic State Consumption (SEC-08 — Severity: Medium)
In `worker/src/auth/oauth.ts` (lines 115–128):
```typescript
const row = await db.prepare('SELECT ... FROM verification WHERE identifier = ?').first();
if (!row) return null;
await db.prepare('DELETE FROM verification WHERE id = ?').run();
```
The state lookup and deletion are **two independent queries** executed without a transaction. Under high-concurrency race conditions, two concurrent requests with identical state can both succeed in reading before the row is deleted.
- **Remediation:** Use atomic SQLite `RETURNING`:
  ```sql
  DELETE FROM verification WHERE identifier = ? RETURNING *;
  ```

---

## 8. Required Test Suite Gap Analysis

A rigorous review of `worker/tests/auth.test.ts` was conducted to evaluate real test coverage against critical failure modes.

### 8.1 Critical Testing Gaps Identified (SEC-10 — Severity: Medium)

1. **Mock-Polluted Integration Tests:**
   In `worker/tests/auth.test.ts` (lines 560–575 and 615–630), `verifyGoogleIdToken` was **spied and completely mocked out** (`vi.spyOn(oauthModule, 'verifyGoogleIdToken').mockResolvedValue(mockProfile)`).
   As a consequence, the actual ID token parsing and signature verification code was never tested during HTTP route execution! This is why the missing signature verification (SEC-03) went completely undetected by the test suite!
2. **Missing Test for `email_verified: false`:**
   Zero tests assert that an unverified Google account cannot link to an existing user.
3. **Missing Test for Wrong Audience:**
   Zero tests assert that an ID token issued for an attacker's client ID (`aud != GOOGLE_CLIENT_ID`) is rejected.
4. **Missing Test for Expired State in HTTP Route:**
   The HTTP callback route `/api/auth/callback/google` is never tested with an expired state timestamp.
5. **Missing Test for Plaintext Token Invariant:**
   Zero tests assert that session tokens are hashed at rest. In fact, the test suite asserts that the plaintext token exists in the database.
6. **Missing Test for Deep-Link Token Interception:**
   Tests merely assert `location.toContain('stylesaathi://auth/callback#session_token=')`, validating the existence of the vulnerable pattern rather than challenging it.

---

## 9. Comprehensive Remediation Matrix

To achieve authorization for Phase 3C (Delta Synchronization), the following remediations must be implemented and independently audited:

| Ref | Remediation Step | Target File(s) | Prerequisite for Phase 3C? |
| :--- | :--- | :--- | :---: |
| **REM-01** | Store SHA-256 hashed session tokens in D1; query by hash | `session.ts`, `schema.sql` | **YES** |
| **REM-02** | Replace deep-link bearer token with single-use authorization exchange code | `routes.ts`, `oauth.ts` | **YES** |
| **REM-03** | Verify Google ID token RS256 signature against Google JWKS (`jose`) | `oauth.ts`, `routes.ts` | **YES** |
| **REM-04** | Reject account linking when `profile.email_verified !== true` | `oauth.ts` | **YES** |
| **REM-05** | Eliminate D1 writes on OAuth initiation; use signed state cookie / HMAC | `routes.ts`, `oauth.ts` | **YES** |
| **REM-06** | Replace non-atomic SELECT + DELETE with atomic `DELETE ... RETURNING *` | `oauth.ts` | Recommended |
| **REM-07** | Set `android:allowBackup="false"` and specify EncryptedSharedPreferences | `AndroidManifest.xml` | Recommended |
| **REM-08** | Remove mock spies from `auth.test.ts` and test real cryptographic verification | `auth.test.ts` | Recommended |
| **REM-09** | Update documentation to clarify custom auth architecture | `README.md`, docs | Recommended |

---

## 10. Audit Conclusion

The Phase 3B authentication implementation established a well-structured Hono router, clean TypeScript types, and high-entropy token generation. However, critical vulnerabilities in **plaintext token storage**, **deep-link credential exposure**, **unverified JWT signatures**, **unverified email account takeover**, and **unauthenticated D1 write amplification** render the current authentication baseline unsafe for production or for supporting synchronization.

**Phase 3C (Delta Synchronization Engine) must NOT be authorized until the 5 blocking remediations (REM-01 through REM-05) are implemented, verified with automated tests, and passed through a re-audit.**

