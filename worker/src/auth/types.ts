// ============================================================================
// STYLESAATHI 3.0 — AUTHENTICATION SERVICE TYPES
// Custom Cloudflare Worker & D1 Authentication Engine (Zero-Cost Architecture)
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: number;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string; // In D1, this holds the SHA-256 hash of the token (SEC-01)
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionCreationResult {
  session: Session;
  rawToken: string; // High-entropy unhashed token delivered once to the client
}

export interface Account {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  scope?: string | null;
  password?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Verification {
  id: string;
  identifier: string;
  value: string;
  expiresAt: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AuthContext {
  user: User;
  session: Session;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Payload encrypted into an authenticated JWE cookie during OAuth initiation.
 * Avoids any D1 row writes on unauthenticated GET/POST /api/auth/sign-in/social (SEC-05).
 */
export interface OAuthTxPayload {
  state: string;
  nonce: string;
  codeVerifier: string;
  clientCodeChallenge?: string | null;
  platform: 'web' | 'android';
  redirectUri: string;
  createdAt: number;
}

/**
 * Payload stored in D1 verification table for single-use exchange codes (SEC-02).
 */
export interface ExchangeCodePayload {
  userId: string;
  sessionToken: string;
  clientCodeChallenge?: string | null;
  createdAt: number;
}
