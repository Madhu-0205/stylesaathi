// ============================================================================
// STYLESAATHI 3.0 — PHASE 3F.1: STAGING CONFIGURATION & ISOLATION TEST SUITE
// Validates staging environment bindings, CORS isolation, OAuth URI structure,
// and zero-dependency isolation from production and Supabase.
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/index';
import { WorkerEnv, D1Database, HealthCheckResponse } from '../src/types';
import { resolveAllowedOrigins } from '../src/middleware/cors';

describe('StyleSaathi 3.0 — Phase 3F.1: Staging Environment Isolation', () => {
  const wranglerTomlPath = path.resolve(__dirname, '../wrangler.toml');
  const wranglerContent = fs.readFileSync(wranglerTomlPath, 'utf-8');

  describe('1. wrangler.toml Configuration & Schema Isolation', () => {
    it('defines distinct default and staging environments', () => {
      expect(wranglerContent).toContain('name = "stylesaathi-api"');
      expect(wranglerContent).toContain('[env.staging]');
      expect(wranglerContent).toContain('name = "stylesaathi-api-staging"');
    });

    it('isolates the staging D1 database binding from the default database', () => {
      // Default binding
      expect(wranglerContent).toContain('database_name = "stylesaathi-db"');
      expect(wranglerContent).toContain('database_id = "local-stylesaathi-db-id"');

      // Staging binding
      expect(wranglerContent).toContain('database_name = "stylesaathi-db-staging"');
      expect(wranglerContent).toContain('database_id = "c8a7b07e-0664-4533-af17-86374fd3a8cd"');
    });

    it('isolates staging environment variables and origins', () => {
      expect(wranglerContent).toContain('APP_ENV = "staging"');
      expect(wranglerContent).toContain('ALLOWED_ORIGINS = "https://staging.stylesaathi.pages.dev,https://stylesaathi-staging.pages.dev,capacitor://localhost,https://localhost"');
      expect(wranglerContent).toContain('APP_URL = "https://staging.stylesaathi.pages.dev"');
    });

    it('preserves the default development configuration without modification', () => {
      expect(wranglerContent).toContain('APP_ENV = "development"');
      expect(wranglerContent).toContain('ALLOWED_ORIGINS = "https://stylesaathi.pages.dev,http://localhost:5173,http://localhost:4173,capacitor://localhost,https://localhost"');
    });
  });

  describe('2. Staging CORS & Origin Restrictions', () => {
    const stagingOrigins = 'https://staging.stylesaathi.pages.dev,https://stylesaathi-staging.pages.dev,capacitor://localhost,https://localhost';
    const stagingEnv: Partial<WorkerEnv> = {
      APP_ENV: 'staging',
      ALLOWED_ORIGINS: stagingOrigins,
      APP_URL: 'https://staging.stylesaathi.pages.dev',
    };

    it('resolves exactly the configured staging origins', () => {
      const allowedSet = resolveAllowedOrigins(stagingEnv as WorkerEnv);
      expect(allowedSet.has('https://staging.stylesaathi.pages.dev')).toBe(true);
      expect(allowedSet.has('https://stylesaathi-staging.pages.dev')).toBe(true);
      expect(allowedSet.has('capacitor://localhost')).toBe(true);
      expect(allowedSet.has('https://localhost')).toBe(true);
      expect(allowedSet.has('https://stylesaathi.pages.dev')).toBe(false); // Production origin not in staging
      expect(allowedSet.has('http://localhost:5173')).toBe(false); // Dev origin not in staging
      expect(allowedSet.has('https://malicious-site.com')).toBe(false);
    });

    it('allows preflight OPTIONS for staging origin', async () => {
      const res = await app.request(
        '/api/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://stylesaathi-staging.pages.dev',
            'Access-Control-Request-Method': 'GET',
          },
        },
        stagingEnv
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://stylesaathi-staging.pages.dev');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('rejects preflight OPTIONS for unauthorized origin in staging', async () => {
      const res = await app.request(
        '/api/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://malicious-site.com',
            'Access-Control-Request-Method': 'GET',
          },
        },
        stagingEnv
      );

      expect(res.status).toBe(403);
      expect(await res.text()).toContain('CORS origin unauthorized');
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('allows Android Capacitor origin in staging', async () => {
      const res = await app.request(
        '/api/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://localhost',
            'Access-Control-Request-Method': 'POST',
          },
        },
        stagingEnv
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
    });
  });

  describe('3. Staging Health Check & Diagnostic Security', () => {
    const createMockDb = (alive = 1): D1Database => ({
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(async () => ({ alive })),
        run: vi.fn(),
        all: vi.fn(),
      } as any)),
      batch: vi.fn(),
      exec: vi.fn(),
    });

    it('reports environment as staging and status ok', async () => {
      const stagingEnv: WorkerEnv = {
        DB: createMockDb(1),
        APP_ENV: 'staging',
        ALLOWED_ORIGINS: 'https://staging.stylesaathi.pages.dev',
      };

      const res = await app.request('/api/health', {}, stagingEnv);
      expect(res.status).toBe(200);

      const body = (await res.json()) as HealthCheckResponse;
      expect(body.status).toBe('ok');
      expect(body.service).toBe('stylesaathi-api');
      expect(body.environment).toBe('staging');
      expect(body.database).toBe('connected');
    });

    it('masks raw database error in staging to prevent information disclosure', async () => {
      const failingDb: D1Database = {
        prepare: vi.fn(() => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn(async () => {
            throw new Error('D1_INTERNAL_ERROR: SQLite disk path /var/data/stylesaathi-db-staging leaked');
          }),
          run: vi.fn(),
          all: vi.fn(),
        } as any)),
        batch: vi.fn(),
        exec: vi.fn(),
      };

      const stagingEnv: WorkerEnv = {
        DB: failingDb,
        APP_ENV: 'staging',
        ALLOWED_ORIGINS: 'https://staging.stylesaathi.pages.dev',
      };

      const res = await app.request('/api/health', {}, stagingEnv);
      expect(res.status).toBe(503);

      const body = (await res.json()) as HealthCheckResponse;
      expect(body.status).toBe('degraded');
      expect(body.database).toBe('error');
      expect(body.details?.error).toBe('Database service unavailable');
      expect(JSON.stringify(body)).not.toContain('/var/data');
    });
  });

  describe('4. Staging Google OAuth Redirect URI & Configuration Specification', () => {
    it('defines standard OAuth redirect path', () => {
      const expectedRedirectPath = '/api/auth/callback/google';
      const stagingAppUrl = 'https://staging.stylesaathi.pages.dev';
      const stagingWorkerUrl = 'https://stylesaathi-api-staging.workers.dev';

      // Verify path format
      expect(expectedRedirectPath).toMatch(/^\/api\/auth\/callback\/google$/);
      // Validated expected Google Cloud Console Authorized Redirect URIs
      const validUris = [
        `${stagingAppUrl}${expectedRedirectPath}`,
        `${stagingWorkerUrl}${expectedRedirectPath}`,
      ];
      expect(validUris[0]).toBe('https://staging.stylesaathi.pages.dev/api/auth/callback/google');
      expect(validUris[1]).toBe('https://stylesaathi-api-staging.workers.dev/api/auth/callback/google');
    });

    it('fails gracefully when Google OAuth credentials are unconfigured without crashing', async () => {
      const stagingEnv: Partial<WorkerEnv> = {
        APP_ENV: 'staging',
        // GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET intentionally missing
      };

      const res = await app.request('/api/auth/sign-in/social?provider=google', {}, stagingEnv as WorkerEnv);
      expect(res.status).toBe(503);
      const json = await res.json() as any;
      expect(json.error).toBe('CONFIGURATION_ERROR');
      expect(json.message).toContain('Google OAuth client ID is not configured');
    });

    it('fails closed when AUTH_SECRET is missing in staging environment (no dev fallback permitted)', async () => {
      const { getAuthSecretKey } = await import('../src/auth/crypto');
      await expect(getAuthSecretKey(undefined, 'staging')).rejects.toThrow(
        'CONFIGURATION_ERROR: AUTH_SECRET must be configured in staging environments.'
      );
      await expect(getAuthSecretKey('', 'staging')).rejects.toThrow(
        'CONFIGURATION_ERROR: AUTH_SECRET must be configured in staging environments.'
      );
      await expect(getAuthSecretKey('   ', 'staging')).rejects.toThrow(
        'CONFIGURATION_ERROR: AUTH_SECRET must be configured in staging environments.'
      );

      // When valid staging secret provided, derives 32-byte key
      const key = await getAuthSecretKey('staging-super-secret-key-32b-length-ok', 'staging');
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });
  });

  describe('5. Supabase & Production Isolation Invariants', () => {
    it('ensures worker code has zero imports or dependencies on supabase', () => {
      const workerSrcDir = path.resolve(__dirname, '../src');
      const files = fs.readdirSync(workerSrcDir, { recursive: true }) as string[];
      for (const file of files) {
        if (typeof file === 'string' && (file.endsWith('.ts') || file.endsWith('.js'))) {
          const content = fs.readFileSync(path.join(workerSrcDir, file), 'utf-8');
          expect(content.toLowerCase()).not.toContain('@supabase');
          expect(content.toLowerCase()).not.toContain('supabase.co');
        }
      }
    });
  });
});
