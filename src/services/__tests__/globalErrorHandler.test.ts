// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sanitizeErrorMessage,
  classifyErrorSeverity,
  recordDiagnosticLog,
  getDiagnosticsBuffer,
  clearDiagnosticsBuffer,
  installGlobalErrorHandlers,
} from '../globalErrorHandler';

describe('globalErrorHandler', () => {
  beforeEach(() => {
    clearDiagnosticsBuffer();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeErrorMessage', () => {
    it('redacts JWT tokens completely', () => {
      const raw = 'Auth error with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('eyJhbGci');
      expect(sanitized).toContain('[REDACTED_JWT]');
    });

    it('redacts sensitive query parameters like code and access_token', () => {
      const raw = 'Failed callback: https://callback?code=secret_auth_code_123&state=abc&access_token=token_xyz';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('secret_auth_code_123');
      expect(sanitized).not.toContain('token_xyz');
      expect(sanitized).toContain('code=[REDACTED]');
      expect(sanitized).toContain('access_token=[REDACTED]');
    });

    it('preserves clean non-sensitive error messages', () => {
      const clean = 'Database connection timed out';
      expect(sanitizeErrorMessage(clean)).toBe(clean);
    });
  });

  describe('classifyErrorSeverity', () => {
    it('identifies network and quota errors as recoverable', () => {
      const netErr = classifyErrorSeverity('Failed to fetch from remote origin');
      expect(netErr.isFatal).toBe(false);

      const quotaErr = classifyErrorSeverity('QuotaExceededError: Local disk storage full');
      expect(quotaErr.isFatal).toBe(false);
    });

    it('identifies unexpected code runtime errors as potentially fatal', () => {
      const syntaxErr = classifyErrorSeverity('TypeError: Cannot read properties of undefined');
      expect(syntaxErr.isFatal).toBe(true);
    });
  });

  describe('diagnostic ring buffer', () => {
    it('maintains maximum bounded capacity without memory leaks', () => {
      for (let i = 0; i < 30; i++) {
        recordDiagnosticLog({
          type: 'error',
          message: `Error event number ${i}`,
          isFatal: false,
        });
      }

      const buffer = getDiagnosticsBuffer();
      expect(buffer.length).toBe(20);
      expect(buffer[buffer.length - 1].message).toBe('Error event number 29');
    });
  });

  describe('installGlobalErrorHandlers', () => {
    it('installs cleanly and records intercepted promise rejections', () => {
      const uninstall = installGlobalErrorHandlers();

      // Dispatch mock rejection event in jsdom environment
      const fakeEvent = new Event('unhandledrejection') as any;
      fakeEvent.reason = new Error('Simulated unhandled async rejection');
      fakeEvent.preventDefault = vi.fn();

      window.dispatchEvent(fakeEvent);

      const buffer = getDiagnosticsBuffer();
      expect(buffer.some((b) => b.message.includes('Simulated unhandled async rejection'))).toBe(true);

      uninstall();
    });
  });
});
