// ============================================================================
// STYLESAATHI 3.0 — D1 STATEFUL SESSION SERVICE (HARDENED)
// Workstream 2 Hardening: SEC-01 (Session Token Hashing at Rest)
// ============================================================================

import type { D1Database } from '../types';
import type { User, Session, AuthContext, SessionCreationResult } from './types';
import { generateSecureToken, sha256Hex } from './crypto';

/**
 * Creates a new stateful session in Cloudflare D1.
 * CRITICAL SECURITY INVARIANT (SEC-01):
 * The raw session token is NEVER stored in the database.
 * Only the SHA-256 hash of the token is persisted.
 * The raw token is returned once to the caller for client delivery.
 */
export async function createSession(
  db: D1Database,
  userId: string,
  options?: {
    ipAddress?: string | null;
    userAgent?: string | null;
    ttlDays?: number;
  }
): Promise<SessionCreationResult> {
  const id = crypto.randomUUID();
  const rawToken = generateSecureToken(32); // 256 bits of cryptographic entropy
  const tokenHash = await sha256Hex(rawToken); // SHA-256 hash stored at rest

  const ttlDays = options?.ttlDays ?? 30;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = now.toISOString();
  const updatedAt = createdAt;
  const ipAddress = options?.ipAddress ?? null;
  const userAgent = options?.userAgent ?? null;

  await db
    .prepare(
      `INSERT INTO session (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, userId, tokenHash, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
    .run();

  const session: Session = {
    id,
    userId,
    token: tokenHash, // Database record contains only the hash
    expiresAt,
    ipAddress,
    userAgent,
    createdAt,
    updatedAt,
  };

  return {
    session,
    rawToken, // Sent to client (via cookie or exchange code), never persisted
  };
}

/**
 * Validates a raw session token against the D1 session and user tables.
 * CRITICAL SECURITY INVARIANT (SEC-01):
 * Hashes the incoming token and looks up by SHA-256 hash.
 * Returns the authenticated user and session, or null if invalid or expired.
 */
export async function validateSession(
  db: D1Database,
  rawToken: string
): Promise<AuthContext | null> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    return null;
  }

  // Defend against excessively long or malformed input tokens
  if (rawToken.length > 256) {
    return null;
  }

  // Hash the incoming raw token before database query
  const tokenHash = await sha256Hex(rawToken);

  interface SessionUserRow {
    session_id: string;
    session_userId: string;
    session_token: string;
    session_expiresAt: string;
    session_ipAddress: string | null;
    session_userAgent: string | null;
    session_createdAt: string;
    session_updatedAt: string;
    user_id: string;
    user_name: string;
    user_email: string;
    user_emailVerified: number;
    user_image: string | null;
    user_createdAt: string;
    user_updatedAt: string;
  }

  const row = await db
    .prepare(
      `SELECT 
         s.id as session_id, s.userId as session_userId, s.token as session_token,
         s.expiresAt as session_expiresAt, s.ipAddress as session_ipAddress,
         s.userAgent as session_userAgent, s.createdAt as session_createdAt,
         s.updatedAt as session_updatedAt,
         u.id as user_id, u.name as user_name, u.email as user_email,
         u.emailVerified as user_emailVerified, u.image as user_image,
         u.createdAt as user_createdAt, u.updatedAt as user_updatedAt
       FROM session s
       JOIN user u ON s.userId = u.id
       WHERE s.token = ?`
    )
    .bind(tokenHash)
    .first<SessionUserRow>();

  if (!row) {
    return null;
  }

  // Check TTL expiration
  const expiresAtMs = new Date(row.session_expiresAt).getTime();
  if (isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    // Eager cleanup of expired session
    try {
      await db.prepare('DELETE FROM session WHERE id = ?').bind(row.session_id).run();
    } catch {
      // Best-effort cleanup
    }
    return null;
  }

  const user: User = {
    id: row.user_id,
    name: row.user_name,
    email: row.user_email,
    emailVerified: Number(row.user_emailVerified),
    image: row.user_image,
    createdAt: row.user_createdAt,
    updatedAt: row.user_updatedAt,
  };

  const session: Session = {
    id: row.session_id,
    userId: row.session_userId,
    token: row.session_token,
    expiresAt: row.session_expiresAt,
    ipAddress: row.session_ipAddress,
    userAgent: row.session_userAgent,
    createdAt: row.session_createdAt,
    updatedAt: row.session_updatedAt,
  };

  return { user, session };
}

/**
 * Revokes a session immediately from D1 by raw token.
 * Hashes raw token and deletes the matching row.
 * Returns true if a session was found and removed.
 */
export async function revokeSession(db: D1Database, rawToken: string): Promise<boolean> {
  if (!rawToken || typeof rawToken !== 'string') return false;
  const tokenHash = await sha256Hex(rawToken);
  const res = await db.prepare('DELETE FROM session WHERE token = ?').bind(tokenHash).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Revokes all active sessions for a user (e.g. security reset or password change).
 * Returns count of deleted sessions.
 */
export async function revokeAllUserSessions(db: D1Database, userId: string): Promise<number> {
  if (!userId) return 0;
  const res = await db.prepare('DELETE FROM session WHERE userId = ?').bind(userId).run();
  return res.meta?.changes ?? 0;
}
