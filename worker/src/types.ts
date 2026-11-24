// ============================================================================
// STYLESAATHI 3.0 — WORKER TYPES & ENVIRONMENT BINDINGS
// Workstream 1: D1 Database & Worker Scaffolding
// ============================================================================

import type { User, Session } from './auth/types';

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: {
    duration?: number;
    rows_read?: number;
    rows_written?: number;
    last_row_id?: number;
    changes?: number;
  };
  error?: string;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface WorkerEnv {
  DB: D1Database;
  APP_ENV?: string;
  ALLOWED_ORIGINS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_SECRET?: string;
  APP_URL?: string;
  TEST_JWKS_KEY?: any;
}

export interface AuthVariables {
  user: User;
  session: Session;
  testJwksKey?: any;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  database: 'connected' | 'unconfigured' | 'error';
  details?: {
    latencyMs?: number;
    error?: string;
  };
}

