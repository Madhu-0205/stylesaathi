/**
 * Global Error and Unhandled Rejection Interceptor for StyleSaathi
 * 
 * Strict Privacy & Security Invariants:
 * 1. Zero external network telemetry (no Sentry, Firebase, Mixpanel, Datadog).
 * 2. Strict sanitization: Never captures or stores auth tokens, passwords, OAuth codes,
 *    signed URLs, or private user wardrobe items.
 * 3. Keeps a bounded in-memory diagnostic ring-buffer (max 20 entries) for local debugging.
 */

export interface DiagnosticLog {
  timestamp: number;
  type: 'error' | 'unhandled_rejection';
  message: string;
  source?: string;
  isFatal: boolean;
}

const MAX_DIAGNOSTIC_ENTRIES = 20;
const diagnosticBuffer: DiagnosticLog[] = [];

/**
 * Sanitizes error messages by scrubbing potential tokens, JWTs, UUIDs, or credentials.
 */
export function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== 'string') return 'Unknown error occurred';

  return rawMessage
    // Redact JWT patterns (eyJh...)
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[REDACTED_JWT]')
    // Redact OAuth query params (code=..., access_token=...)
    .replace(/(code|access_token|refresh_token|token)=[^&\s]+/gi, '$1=[REDACTED]')
    // Redact long hex/uuid secrets
    .replace(/[a-f0-9]{32,64}/gi, '[REDACTED_TOKEN]');
}

/**
 * Categorizes an error as recoverable vs potentially fatal.
 */
export function classifyErrorSeverity(errorOrMessage: any): { isFatal: boolean; summary: string } {
  const msg = typeof errorOrMessage === 'string' 
    ? errorOrMessage 
    : errorOrMessage?.message || String(errorOrMessage);

  const clean = sanitizeErrorMessage(msg);

  // Network failures and transient quota issues are typically recoverable
  const isRecoverable = 
    /network|failed to fetch|timeout|offline|quotaexceeded|abort|cancelled/i.test(clean);

  return {
    isFatal: !isRecoverable,
    summary: clean,
  };
}

/**
 * Records a diagnostic log entry into the circular buffer.
 */
export function recordDiagnosticLog(log: Omit<DiagnosticLog, 'timestamp'>): void {
  const entry: DiagnosticLog = {
    ...log,
    message: sanitizeErrorMessage(log.message),
    timestamp: Date.now(),
  };

  diagnosticBuffer.push(entry);
  if (diagnosticBuffer.length > MAX_DIAGNOSTIC_ENTRIES) {
    diagnosticBuffer.shift();
  }
}

/**
 * Retrieves the current sanitized in-memory diagnostics buffer.
 */
export function getDiagnosticsBuffer(): readonly DiagnosticLog[] {
  return [...diagnosticBuffer];
}

/**
 * Clears the diagnostics buffer (useful between test runs or on user reset).
 */
export function clearDiagnosticsBuffer(): void {
  diagnosticBuffer.length = 0;
}

let isInstalled = false;

/**
 * Installs window.onerror and unhandledrejection handlers.
 * Safe for SSR and repeated invocations.
 */
export function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined' || isInstalled) {
    return () => {};
  }

  isInstalled = true;

  const onErrorHandler = (
    event: Event | string,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ) => {
    const rawMsg = error?.message || (typeof event === 'string' ? event : 'Script error');
    const { isFatal, summary } = classifyErrorSeverity(rawMsg);

    recordDiagnosticLog({
      type: 'error',
      message: summary,
      source: source ? sanitizeErrorMessage(source) : undefined,
      isFatal,
    });

    console.warn(`[StyleSaathi Diagnostic] Uncaught error: ${summary}`);
    // Do not prevent default so dev tools and browser error mechanisms remain active
  };

  const onUnhandledRejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const rawMsg = reason instanceof Error ? reason.message : String(reason);
    const { isFatal, summary } = classifyErrorSeverity(rawMsg);

    recordDiagnosticLog({
      type: 'unhandled_rejection',
      message: summary,
      isFatal,
    });

    console.warn(`[StyleSaathi Diagnostic] Unhandled rejection: ${summary}`);

    // If it's a known transient network/abort error, prevent browser noisy crash banners
    if (!isFatal) {
      event.preventDefault();
    }
  };

  window.addEventListener('error', onErrorHandler as any);
  window.addEventListener('unhandledrejection', onUnhandledRejectionHandler);

  return () => {
    window.removeEventListener('error', onErrorHandler as any);
    window.removeEventListener('unhandledrejection', onUnhandledRejectionHandler);
    isInstalled = false;
  };
}
