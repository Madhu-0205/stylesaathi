import { describe, it, expect, vi } from 'vitest';
import { app } from '../src/index';
import { WorkerEnv, D1Database, HealthCheckResponse } from '../src/types';

describe('Workstream 1: Hono Worker Application, Health Check & CORS Tests', () => {
  const createMockDb = (aliveValue: number | null = 1, shouldThrow = false): D1Database => {
    return {
      prepare: vi.fn((query: string) => {
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn(async () => {
            if (shouldThrow) {
              throw new Error('D1_ERROR: Internal SQLite disk I/O error at /var/data/stylesaathi.db');
            }
            return aliveValue !== null ? { alive: aliveValue } : null;
          }),
          run: vi.fn(),
          all: vi.fn(),
        } as any;
      }),
      batch: vi.fn(),
      exec: vi.fn(),
    };
  };

  describe('Health Check Endpoint (/api/health)', () => {
    it('returns 200 OK and connected status when D1 database is healthy', async () => {
      const mockDb = createMockDb(1);
      const env: WorkerEnv = {
        DB: mockDb,
        APP_ENV: 'production',
      };

      const res = await app.request('/api/health', {}, env);
      expect(res.status).toBe(200);

      const body = (await res.json()) as HealthCheckResponse;
      expect(body.status).toBe('ok');
      expect(body.service).toBe('stylesaathi-api');
      expect(body.database).toBe('connected');
      expect(body.environment).toBe('production');
      expect(body.details?.error).toBeUndefined();
      expect(typeof body.timestamp).toBe('string');
    });

    it('masks raw database error in production to prevent information disclosure', async () => {
      const mockDb = createMockDb(1, true); // Throws internal error with disk path
      const env: WorkerEnv = {
        DB: mockDb,
        APP_ENV: 'production',
      };

      const res = await app.request('/api/health', {}, env);
      expect(res.status).toBe(503);

      const body = (await res.json()) as HealthCheckResponse;
      expect(body.status).toBe('degraded');
      expect(body.database).toBe('error');
      // Crucial security invariant: raw disk paths and internal error details MUST NOT leak in production
      expect(body.details?.error).toBe('Database service unavailable');
      expect(body.details?.error).not.toContain('disk I/O error');
      expect(body.details?.error).not.toContain('/var/data');
    });

    it('preserves detailed database error in development for actionable diagnostics', async () => {
      const mockDb = createMockDb(1, true);
      const env: WorkerEnv = {
        DB: mockDb,
        APP_ENV: 'development',
      };

      const res = await app.request('/api/health', {}, env);
      expect(res.status).toBe(503);

      const body = (await res.json()) as HealthCheckResponse;
      expect(body.status).toBe('degraded');
      expect(body.database).toBe('error');
      expect(body.details?.error).toContain('Internal SQLite disk I/O error');
    });

    it('handles unconfigured D1 database gracefully in test mode', async () => {
      const env: WorkerEnv = {
        DB: undefined as any,
        APP_ENV: 'test',
      };

      const res = await app.request('/api/health', {}, env);
      expect(res.status).toBe(200);

      const body = (await res.json()) as HealthCheckResponse;
      expect(body.status).toBe('ok');
      expect(body.database).toBe('unconfigured');
    });

    it('returns structured 404 JSON for unknown API routes', async () => {
      const res = await app.request('/api/non-existent-route', { method: 'GET' });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body).toEqual({
        error: 'NOT_FOUND',
        message: 'The requested endpoint GET /api/non-existent-route was not found on this server.',
      });
    });
  });

  describe('CORS Guard Middleware & Origin Validation', () => {
    it('attaches Access-Control-Allow-Origin for Android Capacitor origin (https://localhost)', async () => {
      const env: WorkerEnv = {
        DB: createMockDb(1),
        APP_ENV: 'development',
      };

      const res = await app.request(
        '/api/health',
        {
          headers: {
            Origin: 'https://localhost',
          },
        },
        env
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
      expect(res.headers.get('Vary')).toBe('Origin');
    });

    it('handles OPTIONS preflight for Android Capacitor origin (https://localhost) with 204 No Content', async () => {
      const env: WorkerEnv = {
        DB: createMockDb(1),
        APP_ENV: 'development',
      };

      const res = await app.request(
        '/api/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://localhost',
          },
        },
        env
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET, POST');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });

    it('continues to support production web origin (https://stylesaathi.pages.dev)', async () => {
      const env: WorkerEnv = {
        DB: createMockDb(1),
      };

      const res = await app.request(
        '/api/health',
        {
          headers: {
            Origin: 'https://stylesaathi.pages.dev',
          },
        },
        env
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://stylesaathi.pages.dev');
    });

    it('continues to support iOS Capacitor origin (capacitor://localhost)', async () => {
      const env: WorkerEnv = {
        DB: createMockDb(1),
      };

      const res = await app.request(
        '/api/health',
        {
          headers: {
            Origin: 'capacitor://localhost',
          },
        },
        env
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('capacitor://localhost');
    });

    it('rejects OPTIONS preflight from unauthorized origin with 403 Forbidden', async () => {
      const env: WorkerEnv = {
        DB: createMockDb(1),
      };

      const res = await app.request(
        '/api/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://malicious-attacker.com',
          },
        },
        env
      );

      expect(res.status).toBe(403);
      const text = await res.text();
      expect(text).toContain('CORS origin unauthorized');
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('omits Access-Control-Allow-Origin on standard requests from unauthorized origins', async () => {
      const env: WorkerEnv = {
        DB: createMockDb(1),
      };

      const res = await app.request(
        '/api/health',
        {
          headers: {
            Origin: 'https://malicious-attacker.com',
          },
        },
        env
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('allows requests without an Origin header to pass through without CORS headers', async () => {
      const env: WorkerEnv = {
        DB: createMockDb(1),
      };

      const res = await app.request('/api/health', {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });
});
