# StyleSaathi 3.0 — Phase 3F.6: Staging Worker Dry-Run & Deployment Readiness Audit Report

**Date:** November 7, 2026  
**Phase:** 3F.6 — Staging Worker Deployment Dry-Run & Security Audit  
**Target Worker:** `stylesaathi-api-staging`  
**Target Environment:** Staging (`[env.staging]`)  
**Target D1 Database:** `stylesaathi-db-staging` (`c8a7b07e-0664-4533-af17-86374fd3a8cd`)  
**Budget & Plan:** Cloudflare Free Plan (₹0 / $0.00 — Zero billing, zero paid services)  
**Final Gate Verdict:** **PASS** (Dry-run succeeded cleanly; zero deployments executed)

---

## 1. Executive Summary

Phase 3F.6 conducted a pre-deployment dry-run and comprehensive security audit of the staging Cloudflare Worker (`stylesaathi-api-staging`).

### Key Outcomes:
1. **Dry-Run Succeeded Cleanly:** Wrangler bundled the Worker without errors, reporting a total upload size of **258.57 KiB** (gzipped: **55.06 KiB**), utilizing only ~25% of the 1 MB Cloudflare Workers Free Tier limit.
2. **Staging Bindings Verified:**
   - `env.DB`: Bound to D1 database `stylesaathi-db-staging` (`c8a7b07e-0664-4533-af17-86374fd3a8cd`).
   - `env.APP_ENV`: Set to `"staging"`.
   - `env.ALLOWED_ORIGINS`: Restricted to staging Pages and Android Capacitor webview.
   - `env.APP_URL`: Set to `"https://staging.stylesaathi.pages.dev"`.
3. **Zero Unexpected Resources:** Confirmed zero bindings to KV, R2, Queues, Vectorize, or paid services.
4. **Hardened Secret & Error Handling:**
   - In `worker/src/auth/crypto.ts`, `getAuthSecretKey` fails closed if `AUTH_SECRET` is missing in `staging` or `production` environments; no local development fallback is permitted.
   - In `worker/src/index.ts`, raw database error messages and file paths are masked in staging and production (`Database service unavailable`) to prevent information disclosure.
5. **No Deployment Executed:** The command was executed with `--dry-run`; zero Workers were published and no remote resources were mutated.

---

## 2. Dry-Run Command & Generated Bundle Inspection

### 2.1 Command Executed
```bash
npx wrangler deploy --config worker/wrangler.toml --env staging --dry-run
```

### 2.2 Wrangler Output
```text
 ⛅️ wrangler 4.158.0
────────────────────
Total Upload: 258.57 KiB / gzip: 55.06 KiB
Your Worker has access to the following bindings:
Binding                Resource                
env.DB                 D1 Database             
  stylesaathi-db-staging
env.APP_ENV            Environment Variable    
  "staging"
env.ALLOWED_ORIGINS    Environment Variable    
  "https://staging.stylesaathi.pages.dev..."
env.APP_URL            Environment Variable    
  "https://staging.stylesaathi.pages.dev"

--dry-run: exiting now.
```

### 2.3 Bundle Analysis
- **Entry Point:** `worker/src/index.ts`
- **Compatibility Date:** `2024-11-01`
- **Compatibility Flags:** `["nodejs_compat"]`
- **Bundle Size:** `258.57 KiB` uncompressed / `55.06 KiB` gzipped.
- **Size Headroom:** 741.43 KiB headroom under the 1,000 KiB Free Tier ceiling (> 74% buffer).
- **Warnings / Deprecations:** None.

---

## 3. Staging Binding & Environment Verification

| Binding / Variable | Type | Value / Target | Verification Status |
|---|---|---|---|
| `name` | Worker Name | `stylesaathi-api-staging` | Isolated from production `stylesaathi-api` |
| `env.DB` | D1 Database | `stylesaathi-db-staging` (`c8a7b07e-0664-4533-af17-86374fd3a8cd`) | Correct remote staging UUID; 15 tables migrated |
| `env.APP_ENV` | Variable | `"staging"` | Triggers strict error masking and fail-closed secrets |
| `env.ALLOWED_ORIGINS` | Variable | `"https://staging.stylesaathi.pages.dev,https://stylesaathi-staging.pages.dev,capacitor://localhost,https://localhost"` | Strict whitelist; excludes `stylesaathi.pages.dev` |
| `env.APP_URL` | Variable | `"https://staging.stylesaathi.pages.dev"` | Staging OAuth callback origin |
| `AUTH_SECRET` | Secret | Cloudflare Secret Store | Fails closed if unconfigured |
| `GOOGLE_CLIENT_ID` | Secret | Cloudflare Secret Store | Required for social sign-in; returns 503 if missing |
| `GOOGLE_CLIENT_SECRET` | Secret | Cloudflare Secret Store | Required for token exchange |

---

## 4. Comprehensive Security Audit

### 4.1 Authentication & Session Validation
- **Token Hashing at Rest (SEC-01):** Session tokens are hashed with SHA-256 before querying D1 (`worker/src/auth/session.ts`). An attacker with database read access cannot use stored hashes as bearer tokens.
- **Fail-Closed Session Middleware (`worker/src/middleware/auth.ts`):** Requests without a token or with expired/revoked tokens are rejected with HTTP 401 Unauthorized. No development bypasses exist.
- **Fail-Closed Secret Key (`worker/src/auth/crypto.ts`):** `getAuthSecretKey` verifies `AUTH_SECRET` is present when `APP_ENV === 'staging'` or `APP_ENV === 'production'`, throwing `CONFIGURATION_ERROR` and rejecting authentication flows if omitted.

### 4.2 CORS & Origin Whitelisting
- **Preflight Inspection:** In `worker/src/middleware/cors.ts`, `OPTIONS` requests from unapproved origins (e.g., `https://malicious-site.com` or production domain) are rejected with HTTP 403 `CORS origin unauthorized`.
- **Response Headers:** Allowed origins receive explicit `Access-Control-Allow-Origin: <origin>` and `Vary: Origin`. Wildcard `*` is never returned.

### 4.3 Route Protection
- **Sync Endpoints (`/api/sync/push`, `/api/sync/pull`):** Enforce `authMiddleware()` across all methods. Unauthenticated requests are rejected with HTTP 401 before any database access occurs.
- **Account Deletion Endpoint (`/api/auth/account/delete`):** Requires an active session. Strictly prevents users from passing a foreign `targetUserId` (enforces `body.targetUserId === user.id`). Inserts a 90-day cryptographic tombstone and cascades deletions across all 11 user tables in an atomic D1 batch.

### 4.4 Diagnostic & Information Disclosure Protection
- In `worker/src/index.ts`, the `/api/health` endpoint masks database error messages when `APP_ENV` is `staging` or `production`, returning generic `"Database service unavailable"` rather than leaking SQLite file paths or internal schema information.

---

## 5. Local Test & Build Verification

- `worker/tests/stagingConfiguration.test.ts`: **14 / 14 passed** (including staging fail-closed secret test and staging error masking).
- `worker/tests/schemaMigration.test.ts`: **7 / 7 passed**.
- `worker/tests/sync.test.ts`: **29 / 29 passed**.
- `worker/tests/auth.test.ts`: **29 / 29 passed**.
- `worker/tests/workerApp.test.ts`: **12 / 12 passed**.
- **Total Worker Tests:** **91 passed, 28 skipped** (Miniflare live server suite).
- **TypeScript Typecheck (`tsc --noEmit -p tsconfig.app.json`):** **0 errors** (clean).

---

## 6. Financial & Operational Invariants

- **Financial Impact:** **₹0.00** (Free Tier only; zero billing activation).
- **Supabase Status:** 100% untouched, paused, and frozen.
- **Production Status:** Production configuration (`stylesaathi-db`, `local-stylesaathi-db-id`) remains untouched and isolated.
- **Zero Deployments:** Neither Worker nor Pages deployments were executed during this dry-run.

---

## 7. Git Status & Preserved Modifications

Confirmed all **16 modified tracked files** remain strictly preserved:
1. `android/app/src/main/AndroidManifest.xml`
2. `package-lock.json`
3. `package.json`
4. `src/App.tsx`
5. `src/__tests__/syncQueue.test.ts`
6. `src/hooks/useSyncStatus.ts`
7. `src/lib/sync/conflictResolvers.ts`
8. `src/lib/sync/syncQueue.ts`
9. `src/lib/sync/syncService.ts`
10. `src/repositories/LocalStorageCalendarRepository.ts`
11. `src/repositories/LocalStorageStyleSignalsRepository.ts`
12. `src/repositories/LocalStorageWardrobeRepository.ts`
13. `src/repositories/LocalStorageWearEventsRepository.ts`
14. `src/repositories/WardrobeRepository.ts`
15. `src/screens/ProfileScreen.tsx`
16. `src/types.ts`

- **Commits / Pushes / Resets / Stashes:** Zero.

---

## 8. Final Gate Verdict

### **Verdict:** **PASS**

The staging Worker `stylesaathi-api-staging` has passed the dry-run compilation, bundle inspection, binding verification, and comprehensive security audit with zero warnings and zero errors.

---

### Prerequisites for Live Staging Deployment (Phase 3G)

Before live staging deployment can be executed, the staging Worker requires secret provisioning via Wrangler:
```bash
# 1. Provision high-entropy session encryption secret
npx wrangler secret put AUTH_SECRET --config worker/wrangler.toml --env staging

# 2. Provision Google Cloud Console staging OAuth credentials
npx wrangler secret put GOOGLE_CLIENT_ID --config worker/wrangler.toml --env staging
npx wrangler secret put GOOGLE_CLIENT_SECRET --config worker/wrangler.toml --env staging

# 3. Deploy Worker to staging
npx wrangler deploy --config worker/wrangler.toml --env staging
```

**In accordance with instructions, execution is STOPPED. Awaiting separate explicit approval before executing live staging Worker deployment.**

