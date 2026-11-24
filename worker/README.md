# StyleSaathi 3.0 — Cloudflare Worker & D1 Backend Foundation

This directory contains the production-grade, zero-cost backend foundation for **StyleSaathi 3.0**, powered by **Cloudflare Workers** and **Cloudflare D1** (Serverless SQLite).

> **Status:** Workstream 1 Complete & Workstream 2 Hardened (D1 Database Schema, Hono Router, CORS Guard, Health Check, Custom D1 Authentication & Hardened Google OAuth Engine).  
> **Budget:** Strict ₹0 Operating Cost (Zero paid tiers, zero auto-upgrades, zero credit card requirement).  
> **Scope Notice:** Covers Phase 3A (Workstream 1) and Phase 3B.2 (Workstream 2 Hardening). Sync APIs, image upload presigning, account deletion endpoints, and production cutover are staged for subsequent workstreams.

---

## 1. Directory Structure

```text
worker/
├── wrangler.toml                    # Cloudflare Worker configuration & D1 database binding
├── tsconfig.json                    # Worker TypeScript compiler options
├── README.md                        # Local setup, configuration & testing instructions
├── migrations/
│   └── 0001_initial_schema.sql      # Idempotent SQLite DDL (12 tables, 12 indexes, triggers)
├── src/
│   ├── index.ts                     # Hono application entry point & health check handler
│   ├── types.ts                     # Environment bindings (Env, D1Database, HealthCheckResponse, Auth)
│   ├── auth/
│   │   ├── types.ts                 # Custom auth data models (User, Session, Account, Verification)
│   │   ├── crypto.ts                # SHA-256 hashing, PKCE S256, JWE A256GCM AEAD encryption
│   │   ├── session.ts               # D1 stateful session service (hashed tokens at rest - SEC-01)
│   │   ├── oauth.ts                 # Google OAuth 2.0 (JWKS RS256, nonce, exchange codes - SEC-02..SEC-09)
│   │   └── routes.ts                # Authentication endpoints (/api/auth/*)
│   └── middleware/
│       ├── cors.ts                  # Origin validation & preflight CORS guard
│       └── auth.ts                  # Bearer token & cookie session authentication guard
└── tests/
    ├── schemaMigration.test.ts      # Native SQLite schema, FK constraint & trigger tests
    ├── workerApp.test.ts            # Hono application, health check & CORS guard tests
    └── auth.test.ts                 # Cryptographic verification, hashing at rest & exchange code tests
```

---

## 2. Hardened Authentication Architecture (Workstream 2 / Phase 3B.2)

### 2.1 Session Security: SHA-256 Token Hashing at Rest (SEC-01)
- **Token Hashing:** Raw 256-bit bearer tokens are **never** persisted in D1. Only the SHA-256 hash (`sha256Hex(rawToken)`) is stored at rest in `session.token`.
- **Preimage Resistance:** If the D1 database is leaked or dumped, an attacker cannot authenticate because the client must submit the raw token, which the server re-hashes before lookup.
- **Immediate Revocation:** Calling `/api/auth/sign-out` immediately deletes the hashed record from D1.

### 2.2 Android OAuth: Exchange Code Architecture (SEC-02 & SEC-08)
- **No Bearer Tokens in Deep Links:** Custom URL schemes (`stylesaathi://`) cannot securely transfer bearer tokens due to interception risks.
- **Single-Use Exchange Code:** The server issues a short-lived (60-second), cryptographically random `exchange_code` delivered via `stylesaathi://auth/callback?code=<exchange_code>`.
- **Client PKCE Verification:** The mobile app intercepts the deep link and executes a direct TLS `POST /api/auth/exchange-code` with `{ code, code_verifier }`.
- **Atomic Single-Use:** Consumed using SQLite `DELETE ... RETURNING *` to eliminate race conditions. An intercepted code cannot be redeemed without the client's in-memory `code_verifier`.

### 2.3 Cryptographic Google ID Token Verification (SEC-03 & SEC-09)
- **Real RS256 Verification:** In production, ID tokens are verified against Google's public JWKS (`https://www.googleapis.com/oauth2/v3/certs`) using `jwtVerify` from `jose`.
- **Claims Validation:** Strictly validates `iss`, `aud` (configured Google Client ID), `exp`, `sub`, and `nonce`.
- **Never Decodes Blindly:** `decodeJwt` is prohibited as a substitute for signature verification.

### 2.4 Safe Account Linking (SEC-04)
- **Verified Email Enforcement:** Automatic account linking to an existing user by email requires `profile.email_verified === true`.
- **Account Takeover Prevention:** Unverified Google accounts cannot link to or claim existing user accounts.

### 2.5 Zero-D1-Write OAuth Initiation (SEC-05)
- **Authenticated JWE Cookie:** Transaction state, nonce, and PKCE verifiers are encrypted into an `HttpOnly` JWE (`A256GCM`) cookie (`stylesaathi_oauth_tx`).
- **Quota DoS Immunity:** OAuth initiation performs **zero D1 writes**, preventing write amplification attacks from exhausting the D1 100k daily write limit.

---

## 3. Endpoints Specification

### Authentication Endpoints (`/api/auth/*`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/get-session` | Returns active user and session or `null` | Optional |
| `POST` | `/api/auth/sign-out` | Revokes active session in D1 and clears cookies | Optional |
| `GET` / `POST` | `/api/auth/sign-in/social` | Initiates Google OAuth (0 D1 writes) | No |
| `GET` | `/api/auth/callback/google` | Verifies JWKS & nonce; issues exchange code / cookie | No |
| `POST` | `/api/auth/exchange-code` | Exchanges single-use code + PKCE verifier for session token | No |
| `GET` | `/api/auth/me` | Protected profile check (tests auth middleware) | **Yes** |

### System Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, version, environment, and D1 ping | No |

---

## 4. Local Setup & Testing Instructions

### 4.1 Running All Worker Tests
Run all 42 automated unit and security tests (completely offline using native Node SQLite):
```bash
npx vitest run worker/tests/
```

### 4.2 Typechecking
Verify TypeScript types for the Worker:
```bash
npx tsc -p worker/tsconfig.json
```

---

## 5. Workstream Progress
- **Workstream 1 (Complete):** Project scaffolding, D1 SQLite DDL, Hono routing, CORS guard, health check, automated tests.
- **Workstream 2 (Hardened & Complete):** Custom D1 authentication service, token hashing at rest, exchange-code deep link flow, real RS256 JWKS verification, verified email enforcement, zero-write initiation, comprehensive security test suite.
- **Workstream 3 (Pending Authorization):** Delta synchronization engine (`/api/sync/push`, `/api/sync/pull`).
- **Workstream 4 (Pending Authorization):** Account deletion endpoint and streaming backup utility.
