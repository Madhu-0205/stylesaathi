# StyleSaathi 3.0 — Phase 2: Migration Acceptance Checklist
## Production Migration Verification & Cutover Gates (Corrected V2)

> **Document Type:** Migration Acceptance & Quality Assurance Checklist (Post-Challenge Revision)  
> **Status:** PENDING IMPLEMENTATION (Implementation Strictly Blocked Pending Phase 3 Authorization)  
> **Budget Constraint:** Absolute ₹0 Operating Cost (Zero Paid Upgrades, Zero Pay-As-You-Go, Zero Surprise Billing, Zero Credit Card Requirement)  
> **Authoritative References:**  
> - `docs/infrastructure/STYLESAATHI_PHASE_1_ZERO_COST_INFRASTRUCTURE_AUDIT.md`  
> - `docs/infrastructure/STYLESAATHI_PHASE_1_1_INDEPENDENT_VERIFICATION.md`  
> - `docs/infrastructure/STYLESAATHI_PHASE_2_ZERO_COST_MIGRATION_BLUEPRINT.md`  
> - `docs/infrastructure/STYLESAATHI_PHASE_2_1_FINAL_ARCHITECTURE_CHALLENGE.md`  
> - `docs/infrastructure/STYLESAATHI_PHASE_2_2_CORRECTION_LOG.md`  

---

## Instructions for Implementation & Review
This checklist serves as the authoritative, non-negotiable verification gate for migrating StyleSaathi 3.0 from Supabase to Cloudflare D1 + Better Auth + Workers Free + Pages. Every checkpoint must be empirically verified with test logs, code inspection, or live demonstration before proceeding to subsequent phases.

---

## Gate 1: Strict ₹0 Infrastructure & Billing Safety Gate
*Objective: Guarantee zero spending, zero credit card requirement, and zero risk of surprise invoices.*

- [ ] **1.1 Cloudflare Account Safety:** Verify Cloudflare account is on the Free tier with **zero credit card or payment method on file**.
- [ ] **1.2 D1 Hard Spending Limits:** Confirm D1 daily limits (5M reads, 100k writes, 5 GB storage) are hard limits that fail-closed rather than auto-upgrading to paid tiers.
- [ ] **1.3 Workers Free Cap:** Confirm Workers Free plan caps requests at 100,000/day and returns HTTP 429 when exhausted without billing triggers.
- [ ] **1.4 Pages Free Tier:** Confirm Cloudflare Pages provides unlimited bandwidth and requests for static asset hosting.
- [ ] **1.5 Identity Provider Billing:** Confirm Google OAuth 2.0 Client ID is created under Google Cloud Free Tier without billing account attachment.
- [ ] **1.6 Email Service Zero Billing:** Confirm Brevo account is on the Free plan (300 emails/day hard limit) with zero credit card attached.
- [ ] **1.7 Fail-Closed Client Behavior:** Verify that when cloud APIs return HTTP 429 or network errors, the client functions seamlessly in local offline mode without user interruption or data loss.

---

## Gate 2: Better Auth Stateful Sessions & Android Mobile Security Gate
*Objective: Guarantee secure, passwordless authentication compatible with Capacitor Android WebViews.*

- [ ] **2.1 Worker CPU Budget Compliance:** Benchmark Better Auth endpoints on Cloudflare Workers; confirm CPU execution time is strictly $\le$ 3 ms per request (well within 10 ms limit).
- [ ] **2.2 Password Authentication Prohibited:** Verify registration and login endpoints explicitly reject password-based auth to prevent 50–120 ms CPU exhaustion timeouts.
- [ ] **2.3 Google OAuth Standalone Functionality:** Verify OpenID Connect / OAuth 2.0 PKCE flow functions independently on Web and Android Capacitor (`stylesaathi://auth/callback` deep link) with zero email delivery dependencies.
- [ ] **2.4 Google OAuth "In Production" Status:** Verify Google Cloud Console consent screen is set to "In Production" with public Privacy Policy and Terms of Service URLs on Pages, allowing unlisted user logins.
- [ ] **2.5 Optional Email OTP Handling:** Confirm Email OTP operates as an optional extension; if unconfigured or over daily quota (300/day), Worker returns HTTP 429/503 and client directs user to Google OAuth.
- [ ] **2.6 Stateful Bearer Token Transport:** Confirm Better Auth `bearer()` plugin is active, passing opaque tokens via `Authorization: Bearer <token>` headers, querying D1 `session` table on each request (<4% of daily read quota).
- [ ] **2.7 Token Expiration & Instant Revocation:** Verify session expires in 30 days (with 7-day sliding window) and deleting a session row in D1 immediately renders the Bearer token invalid across all edge nodes.
- [ ] **2.8 Android Auto-Backup Exclusion:** Inspect `android/app/src/main/res/xml/backup_rules.xml` and `data_extraction_rules.xml`; confirm `CapacitorStorage.xml` and SQLite/IndexedDB stores are explicitly excluded from `adb backup` and Google Cloud Auto-Backup.
- [ ] **2.9 Threat Model Documentation:** Confirm documentation explicitly acknowledges physical rooted-device limitations and specifies the `@aparajita/capacitor-secure-storage` upgrade path for at-rest hardware Keystore encryption.

---

## Gate 3: Database Conversion & Embedded JSON Relational Authorization Gate
*Objective: Guarantee 100% schema parity in SQLite/D1 and eliminate IDOR vulnerabilities across relational and JSON columns.*

- [ ] **3.1 Exact SQLite DDL Execution:** Confirm all 8 application tables, 4 Better Auth tables, and the `deletion_tombstones` table initialize cleanly in D1.
- [ ] **3.2 Foreign Key Enforcement:** Verify foreign key constraints are enforced and cascading deletes execute properly.
- [ ] **3.3 Column Mapping Fidelity:**
  - Verify PostgreSQL `UUID` $\rightarrow$ SQLite `TEXT` (UUIDv4 lowercase string).
  - Verify PostgreSQL `TIMESTAMPTZ` $\rightarrow$ SQLite `TEXT` (ISO 8601 UTC string).
  - Verify PostgreSQL `TEXT[]` $\rightarrow$ SQLite `TEXT` (JSON array string).
  - Verify PostgreSQL `JSONB` $\rightarrow$ SQLite `TEXT` (JSON object string).
  - Verify PostgreSQL `BOOLEAN` $\rightarrow$ SQLite `INTEGER` (`0` or `1`).
- [ ] **3.4 Calendar Monotonic Trigger:** Verify SQLite trigger `trg_calendar_plan_status_guard` aborts any attempt to transition a `worn` plan to `planned` or `cancelled`.
- [ ] **3.5 Parameterized Relational Ownership (Anti-IDOR):**
  - Verify `wear_events` insert uses atomic subselect `WHERE id = ? AND user_id = ?`.
  - Empirically test that User A cannot log a wear event referencing User B's `wardrobe_item_id` (must return HTTP 403 / 0 rows inserted).
- [ ] **3.6 Embedded JSON Item Validation:** Verify Worker `/api/sync/push` parses JSON payloads in `calendar_plans` (`outfit`) and `saved_outfits` (`slots`), querying D1 to ensure all referenced garment IDs belong to `auth.userId` and are not deleted (rejecting unowned IDs with HTTP 403).

---

## Gate 4: Dual-Tier Quota-Aware Synchronization & Offline State Machine Gate
*Objective: Prevent dead-lettering of valid user mutations during cloud quota exhaustion.*

- [ ] **4.1 Dual-Tier Quota Classification:** Confirm Worker intercepts D1 errors using both structured codes (7500, `D1_QUOTA_EXCEEDED`, `D1_OVERLOADED`) and defensive regex matching (`daily (row )?(write|read) limit`, `d1 db is overloaded`).
- [ ] **4.2 Structured HTTP 429 Contract:** Confirm Worker returns HTTP 429 with `{ error: "CLOUD_QUOTA_EXCEEDED", retryAfterMs: <nextMidnightUtc> }`.
- [ ] **4.3 Queue State Machine Transition:** Verify `syncQueue.ts` transitions to `quota_paused` when receiving `CLOUD_QUOTA_EXCEEDED` or HTTP 429.
- [ ] **4.4 Attempt Count Freeze:** Prove that while in `quota_paused`, `attemptCount` is **NOT** incremented towards `maxAttempts` (5).
- [ ] **4.5 Zero Dead-Letter on Quota:** Prove that valid user mutations NEVER transition to `dead_letter` status due to cloud quota exhaustion.
- [ ] **4.6 FIFO Ordering & Dependency Resolution:** Confirm FIFO mutation processing order is strictly preserved once quota resets at midnight UTC.
- [ ] **4.7 Crash Recovery:** Verify `syncQueue.recoverFromCrash()` resets any stale `in_flight` mutations back to `pending` upon app launch.

---

## Gate 5: Local Image & Streaming Backup/Restore Gate
*Objective: Guarantee zero cloud image storage costs and bounded-memory user data portability.*

- [ ] **5.1 Cloud Image Decoupling:** In `WardrobeContext.tsx`, confirm `UPLOAD_IMAGE` mutation is omitted and `wardrobe_item` UPSERT has `dependencies: []`.
- [ ] **5.2 Local IndexedDB Storage:** Confirm garment photos are resized ($\le$ 800px WebP) and stored strictly in IndexedDB `stylesaathi-images-db`.
- [ ] **5.3 Missing Image Graceful Fallback:** Verify that garments without local images render a clean SVG silhouette placeholder with category icon and color chips.
- [ ] **5.4 Bounded-Memory Streaming Backup:** Confirm backup utility uses `fflate` in chunked/streaming mode (batches $\le$ 25 images), preventing heap exhaustion on low-memory mobile devices.
- [ ] **5.5 Zip Slip Path Traversal Protection:** Verify import parser sanitizes all file paths, stripping `../` sequences and rejecting unauthorized file extensions.
- [ ] **5.6 Non-Destructive LWW Restore:** Confirm archive import compares `imported.client_updated_at` against `local.client_updated_at` and only overwrites records if the imported version is strictly newer.

---

## Gate 6: Hardened Idempotent Account Deletion Gate
*Objective: Ensure complete, atomic erasure of cloud records and reliable local scrubbing without deadlock.*

- [ ] **6.1 Atomic 12-Statement D1 Batch:** Verify Worker endpoint `/api/account/delete` executes all 11 domain/auth DELETE statements AND the `deletion_tombstones` insert within a single atomic `env.DB.batch([...])`.
- [ ] **6.2 Cryptographic Tombstone Insertion:** Verify tombstone stores `requestId`, `sha256(deletionSecret)`, `userIdHash`, and a 7-day expiration timestamp.
- [ ] **6.3 Network Disconnect Reconciliation:** Empirically simulate a network drop immediately after D1 batch commit; verify client calls `/api/account/delete-status`, verifies the cryptographic secret, receives confirmation, and completes `wipeLocalData()`.
- [ ] **6.4 Avoid Blind 401 Wiping:** Verify that an arbitrary HTTP 401 error (without an active deletion request key and verified tombstone) does **NOT** trigger local data wiping.
- [ ] **6.5 Complete Local Scrubbing:** Verify `stylesaathi-sync-queue-db`, `stylesaathi-images-db`, `stylesaathi-needle-db`, and all 16 LocalStorage keys are erased upon verified deletion.

---

## Gate 7: Bifurcated Rollback & Data Recovery Readiness Gate
*Objective: Ensure operational clarity between safe pre-cutover testing and post-cutover disaster recovery.*

- [ ] **7.1 Pre-Cutover Shadow Rollback:** Verify that during Phase 6 Shadow Testing, setting `VITE_BACKEND_PROVIDER=supabase` in the web build safely routes traffic to Supabase with zero production data impact.
- [ ] **7.2 Post-Cutover Disaster Recovery Tool:** Verify `scripts/migrate-d1-to-supabase.ts` successfully exports D1 tables, maps SQLite data back to PostgreSQL types, and upserts them into Supabase via `service_role`.
- [ ] **7.3 Zero Local Schema Mutation:** Confirm local IndexedDB schema is 100% identical under both backend providers.

---

## Gate 8: Final Production Cutover Gate
*Objective: Authorize final decommissioning of Supabase.*

- [ ] **8.1 Full Test Suite Passing:** Confirm all unit, integration, and E2E tests pass (100% test pass rate across all test files).
- [ ] **8.2 Production Build Verification:** Confirm `npm run build` succeeds cleanly with zero TypeScript errors and zero bundle regressions.
- [ ] **8.3 Cloudflare Pages Deployment:** Verify production build is deployed to Cloudflare Pages with custom domain and automated SSL.
- [ ] **8.4 72-Hour Dual-Run Stability:** Complete 72 hours of production traffic on Cloudflare without quota violations or unexpected errors.
- [ ] **8.5 Supabase Decommissioning:** Delete Supabase project only after explicit user sign-off and verified database backup export.

---

### Verification Sign-Off Table

| Gate | Description | Verified By | Verification Date | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Gate 1** | Strict ₹0 Infrastructure & Billing Safety | Pending | — | ⏳ PENDING |
| **Gate 2** | Better Auth Stateful Sessions & Android Security | Pending | — | ⏳ PENDING |
| **Gate 3** | Database Conversion & Embedded JSON Relational Auth | Pending | — | ⏳ PENDING |
| **Gate 4** | Dual-Tier Quota-Aware Synchronization & Offline State | Pending | — | ⏳ PENDING |
| **Gate 5** | Local Image & Streaming Backup/Restore | Pending | — | ⏳ PENDING |
| **Gate 6** | Hardened Idempotent Account Deletion | Pending | — | ⏳ PENDING |
| **Gate 7** | Bifurcated Rollback & Data Recovery Readiness | Pending | — | ⏳ PENDING |
| **Gate 8** | Final Production Cutover | Pending | — | ⏳ PENDING |
