// ============================================================================
// STYLESAATHI 3.0 — CLIENT PKCE & UNIFIED AUTHENTICATION UTILITIES
// Workstream 2 Hardening: RFC 7636 PKCE & Memory-Only Session Token Security
// ============================================================================

import type { User } from '../../types';

const PKCE_VERIFIER_STORAGE_KEY = 'stylesaathi_pending_pkce_verifier';
const DEFAULT_STAGING_WORKER_URL = 'https://stylesaathi-api-staging.madhuvalurouthu52.workers.dev';

// In-memory session token store (Strict Zero-Persistence Invariant)
// Bearer session tokens MUST NEVER be stored in localStorage or sessionStorage.
let inMemorySessionToken: string | null = null;
let inMemoryUserId: string | null = null;

// In-flight code redemption deduplication lock (React 18 StrictMode resilience)
let inFlightExchangePromise: Promise<{ sessionToken: string; userId: string }> | null = null;
let inFlightExchangeCode: string | null = null;

/**
 * Returns the resolved Cloudflare Worker base URL from environment or staging default.
 */
export function getWorkerBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_WORKER_URL) return import.meta.env.VITE_WORKER_URL;
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  }
  return DEFAULT_STAGING_WORKER_URL;
}

/**
 * Sets the active session token in-memory only.
 */
export function setInMemorySession(sessionToken: string | null, userId: string | null = null): void {
  inMemorySessionToken = sessionToken;
  inMemoryUserId = userId;
}

/**
 * Returns the current in-memory session token.
 */
export function getInMemorySessionToken(): string | null {
  return inMemorySessionToken;
}

/**
 * Returns the current in-memory user ID.
 */
export function getInMemoryUserId(): string | null {
  return inMemoryUserId;
}

/**
 * Clears the in-memory session token.
 */
export function clearInMemorySession(): void {
  inMemorySessionToken = null;
  inMemoryUserId = null;
}

/**
 * Converts a Uint8Array to a URL-safe Base64 string without padding (RFC 7636 Base64url).
 */
export function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a cryptographically secure random PKCE code_verifier (RFC 7636 Section 4.1).
 * Uses Web Crypto API crypto.getRandomValues(). Never uses Math.random().
 */
export function generatePkceVerifier(length = 64): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Web Crypto API (crypto.getRandomValues) is required for secure PKCE generation.');
  }

  // RFC 7636 charset: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let verifier = '';
  for (let i = 0; i < length; i++) {
    verifier += charset[randomBytes[i] % charset.length];
  }
  return verifier;
}

/**
 * Generates the S256 code_challenge from a code_verifier (RFC 7636 Section 4.2).
 */
export async function generatePkceChallenge(codeVerifier: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is required for SHA-256 PKCE challenge calculation.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/**
 * Stores the pending PKCE code_verifier in sessionStorage across the OAuth redirect round-trip.
 * NOTE: Only the transient code_verifier is stored in sessionStorage; session tokens are NEVER stored here.
 */
export function savePendingPkceVerifier(verifier: string): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
    } catch {
      // sessionStorage unavailable (e.g. private browsing storage quota)
    }
  }
}

/**
 * Retrieves and atomically removes the pending PKCE code_verifier from sessionStorage.
 * Single-use: once retrieved, it is removed immediately to prevent replay.
 */
export function getAndClearPendingPkceVerifier(): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  try {
    const verifier = window.sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
    if (verifier) {
      window.sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
      return verifier;
    }
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

/**
 * Extracts the single-use exchange code from window.location.hash (#code=<exchange_code>)
 * and IMMEDIATELY scrubs the URL fragment using history.replaceState() to ensure
 * the code never lingers in the address bar, browser history, screenshots, or referrer headers.
 *
 * Never logs or exposes raw codes.
 */
export function extractAndScrubExchangeCode(): string | null {
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }

  const hash = window.location.hash;
  if (!hash || !hash.includes('code=')) {
    return null;
  }

  try {
    // Parse fragment as query-like parameters
    const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(fragment);
    const code = params.get('code');

    // Immediately scrub the fragment from browser address bar and history
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, document.title, cleanUrl);
    } else {
      window.location.hash = '';
    }

    if (code && code.trim().length > 0) {
      return code.trim();
    }
  } catch {
    // Malformed fragment
  }

  return null;
}

/**
 * Extracts authentication errors returned via URL fragment (#auth_error=<code_or_reason>)
 * or search query (?auth_error=...) and IMMEDIATELY scrubs the URL to prevent
 * exposing parameters in browser history or address bar.
 * Never logs raw parameters.
 */
export function extractAndScrubAuthError(): string | null {
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }

  let errorCode: string | null = null;
  const hash = window.location.hash;
  const search = window.location.search;

  if (hash && hash.includes('auth_error=')) {
    try {
      const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
      const params = new URLSearchParams(fragment);
      errorCode = params.get('auth_error');
    } catch {
      // Malformed fragment
    }
  } else if (search && search.includes('auth_error=')) {
    try {
      const params = new URLSearchParams(search);
      errorCode = params.get('auth_error');
    } catch {
      // Malformed search
    }
  }

  if (errorCode && errorCode.trim().length > 0) {
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, document.title, cleanUrl);
    } else {
      window.location.hash = '';
    }
    return errorCode.trim();
  }

  return null;
}

/**
 * Exchanges a single-use exchange code and PKCE verifier for a session token via TLS POST.
 * Deduplicates in-flight requests for the same code to protect against React 18 StrictMode double-mounting.
 */
export async function redeemExchangeCode(
  apiBaseUrl: string,
  exchangeCode: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ sessionToken: string; userId: string }> {
  if (!exchangeCode || !codeVerifier) {
    throw new Error('Both exchange code and PKCE code_verifier are required for token exchange.');
  }

  // Deduplicate concurrent in-flight requests for the same code
  if (inFlightExchangePromise && inFlightExchangeCode === exchangeCode) {
    return inFlightExchangePromise;
  }

  const performExchange = async () => {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/auth/exchange-code`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code: exchangeCode,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Exchange code redemption failed (${response.status})`;
      try {
        const errorJson = (await response.json()) as any;
        if (errorJson?.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Fallback to generic message
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as { sessionToken: string; userId: string };
    if (!data?.sessionToken) {
      throw new Error('Malformed exchange response: sessionToken missing.');
    }

    // Store in-memory only (SEC-02 / Phase 3F.10A.3)
    setInMemorySession(data.sessionToken, data.userId);

    return data;
  };

  inFlightExchangeCode = exchangeCode;
  inFlightExchangePromise = performExchange().finally(() => {
    inFlightExchangePromise = null;
    inFlightExchangeCode = null;
  });

  return inFlightExchangePromise;
}

/**
 * Fetches the authenticated user profile from Cloudflare Worker /api/auth/me using bearer token.
 */
export async function fetchAuthenticatedUser(
  apiBaseUrl: string,
  sessionToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<User> {
  if (!sessionToken) {
    throw new Error('Valid session token required to fetch user profile.');
  }

  const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/auth/me`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile (${response.status})`);
  }

  const data = (await response.json()) as any;
  const userRecord = data?.user;
  if (!userRecord || !userRecord.id) {
    throw new Error('Malformed user profile response.');
  }

  return {
    id: userRecord.id,
    email: userRecord.email || '',
    name: userRecord.name || (userRecord.email ? userRecord.email.split('@')[0] : 'StyleSaathi Member'),
    isGuest: false,
    createdAt: userRecord.createdAt ? new Date(userRecord.createdAt).getTime() : Date.now(),
  };
}

/**
 * Revokes the current session on the Worker and clears in-memory session.
 */
export async function revokeWorkerSession(
  apiBaseUrl: string,
  sessionToken?: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const token = sessionToken || getInMemorySessionToken();
  clearInMemorySession();

  if (!token) return;

  try {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/auth/sign-out`;
    await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch {
    // Best-effort remote revocation; local session is already cleared
  }
}

/**
 * Executes complete cascade account deletion and tombstone insertion on the Worker.
 */
export async function deleteWorkerAccount(
  apiBaseUrl: string,
  sessionToken?: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const token = sessionToken || getInMemorySessionToken();
  if (!token) {
    throw new Error('No active session for account deletion.');
  }

  const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/auth/delete-account`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  clearInMemorySession();

  if (!response.ok) {
    let errorMsg = `Account deletion failed (${response.status})`;
    try {
      const errJson = (await response.json()) as any;
      if (errJson?.message) errorMsg = errJson.message;
    } catch {}
    throw new Error(errorMsg);
  }
}


