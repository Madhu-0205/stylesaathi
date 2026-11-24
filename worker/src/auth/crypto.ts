// ============================================================================
// STYLESAATHI 3.0 — CRYPTOGRAPHIC UTILITIES & AUTHENTICATED ENCRYPTION
// Workstream 2 Hardening: SEC-01, SEC-02, SEC-03, SEC-05, SEC-08, SEC-09
// ============================================================================

import { EncryptJWT, jwtDecrypt } from 'jose';
import type { OAuthTxPayload } from './types';

/**
 * Computes a SHA-256 digest of an input string and returns a 64-character lowercase hex string.
 * Used for session token hashing at rest (SEC-01) and exchange code hashing (SEC-02).
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a cryptographically strong random hex string.
 * Default 32 bytes = 256 bits of entropy (64 hex characters).
 */
export function generateSecureToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a byte buffer to a standard URL-safe Base64 string without padding.
 */
export function toBase64Url(buffer: Uint8Array | ArrayBuffer): string {
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
 * Generates an RFC 7636 compliant PKCE code verifier and SHA-256 code challenge (S256).
 */
export async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = toBase64Url(verifierBytes);

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = toBase64Url(digest);

  return { codeVerifier, codeChallenge };
}

/**
 * Verifies that a client-provided code verifier matches a previously registered code challenge.
 */
export async function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> {
  if (!codeVerifier || !codeChallenge) return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const computedChallenge = toBase64Url(digest);
  return computedChallenge === codeChallenge;
}

/**
 * Derives a 32-byte key suitable for AES-256-GCM JWE direct encryption.
 * In production (APP_ENV === 'production'), fails closed if AUTH_SECRET is missing or empty.
 * In development / test, provides a deterministic local fallback if AUTH_SECRET is omitted.
 */
export async function getAuthSecretKey(authSecret?: string, appEnv?: string): Promise<Uint8Array> {
  if (appEnv === 'production' || appEnv === 'staging') {
    if (!authSecret || typeof authSecret !== 'string' || authSecret.trim().length === 0) {
      throw new Error(`CONFIGURATION_ERROR: AUTH_SECRET must be configured in ${appEnv === 'staging' ? 'staging' : 'production'} environments.`);
    }
  }
  const secretSource = authSecret || 'stylesaathi-dev-auth-secret-key-32b-minimum-entropy';
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secretSource));
  return new Uint8Array(digest);
}

/**
 * Encrypts OAuth transaction data into an authenticated JWE (A256GCM).
 * Stored in an HttpOnly cookie to eliminate D1 write amplification on OAuth initiation (SEC-05).
 */
export async function encryptOAuthTx(
  payload: OAuthTxPayload,
  secretKey: Uint8Array
): Promise<string> {
  return await new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('10m') // 10 minutes TTL
    .encrypt(secretKey);
}

/**
 * Decrypts and authenticates an OAuth transaction JWE.
 * Returns null if the token is tampered, expired, or malformed.
 */
export async function decryptOAuthTx(
  jwt: string,
  secretKey: Uint8Array
): Promise<OAuthTxPayload | null> {
  try {
    const { payload } = await jwtDecrypt(jwt, secretKey);
    return payload as unknown as OAuthTxPayload;
  } catch {
    return null;
  }
}

