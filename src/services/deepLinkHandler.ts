import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';

export interface CallbackValidationResult {
  isValid: boolean;
  code?: string;
  error?: string;
}

/**
 * Validates deep link callback URLs with strict structural checks.
 * Rejects any URL that does not match stylesaathi://auth/callback with a code parameter.
 * Never logs or exposes raw codes.
 */
export function validateOAuthCallbackUrl(rawUrl: string): CallbackValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'Empty or invalid callback URL' };
  }

  try {
    const parsed = new URL(rawUrl);

    if (parsed.protocol !== 'stylesaathi:') {
      return { isValid: false, error: `Invalid protocol: expected stylesaathi: but got ${parsed.protocol}` };
    }

    const host = parsed.hostname || parsed.host;
    if (host !== 'auth') {
      return { isValid: false, error: `Invalid host: expected auth but got ${host}` };
    }

    if (parsed.pathname !== '/callback' && parsed.pathname !== '') {
      // In custom schemes, stylesaathi://auth/callback has pathname '/callback'
      return { isValid: false, error: `Invalid pathname: expected /callback but got ${parsed.pathname}` };
    }

    // Check error parameter returned by OAuth provider if any
    const providerError = parsed.searchParams.get('error_description') || parsed.searchParams.get('error');
    if (providerError) {
      return { isValid: false, error: `OAuth provider error: ${providerError}` };
    }

    const code = parsed.searchParams.get('code');
    if (!code || !code.trim()) {
      return { isValid: false, error: 'Missing authorization code in callback parameters' };
    }

    return { isValid: true, code: code.trim() };
  } catch {
    return { isValid: false, error: 'Malformed callback URL' };
  }
}

export class DeepLinkAuthHandler {
  private processedCodes = new Set<string>();
  private isHandling = false;
  private isInitialized = false;
  private unregisterListener?: () => void;

  /**
   * Clears processed code cache (primarily for deterministic unit testing).
   */
  public reset(): void {
    this.processedCodes.clear();
    this.isHandling = false;
    this.isInitialized = false;
    if (this.unregisterListener) {
      this.unregisterListener();
      this.unregisterListener = undefined;
    }
  }

  /**
   * Processes a deep link URL, validating structure and exchanging authorization code.
   */
  public async handleDeepLink(
    url: string,
    onSuccess?: (user: User) => void,
    onError?: (error: string) => void
  ): Promise<boolean> {
    const validation = validateOAuthCallbackUrl(url);

    if (!validation.isValid || !validation.code) {
      if (validation.error && !url.includes('auth/callback')) {
        // Not an auth callback (could be another deep link in the future), ignore gracefully
        return false;
      }
      onError?.(validation.error || 'Invalid authentication callback');
      return false;
    }

    const code = validation.code;

    // Duplicate callback protection
    if (this.processedCodes.has(code)) {
      return false;
    }

    if (this.isHandling) {
      return false;
    }

    this.isHandling = true;
    this.processedCodes.add(code);

    try {
      // Close in-app browser / Custom Tab if open
      if (Capacitor.isNativePlatform()) {
        try {
          await Browser.close();
        } catch {
          // Browser may already be closed by user or system
        }
      }

      if (!isSupabaseConfigured()) {
        throw new Error('Cloud authentication is not configured');
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data?.session?.user) {
        const errorMsg = error?.message || 'Failed to establish authenticated session';
        onError?.(errorMsg);
        return false;
      }

      const sbUser = data.session.user;
      const email = sbUser.email || '';
      const metaName = sbUser.user_metadata?.name || sbUser.user_metadata?.full_name;
      const fallbackName = metaName || (email ? email.split('@')[0] : 'StyleSaathi Member');

      const user: User = {
        id: sbUser.id,
        email,
        name: fallbackName,
        isGuest: false,
        createdAt: sbUser.created_at ? new Date(sbUser.created_at).getTime() : Date.now(),
      };

      onSuccess?.(user);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected authentication error';
      onError?.(message);
      return false;
    } finally {
      this.isHandling = false;
    }
  }

  /**
   * Initializes deep link listeners for both cold start and warm application states.
   */
  public async initialize(
    onSuccess?: (user: User) => void,
    onError?: (error: string) => void
  ): Promise<() => void> {
    if (this.isInitialized) {
      return this.unregisterListener || (() => {});
    }
    this.isInitialized = true;

    // Only install Capacitor listeners on native or when Capacitor App is available
    if (Capacitor.isNativePlatform()) {
      // 1. Warm start: listen for deep links arriving while app is running
      const listenerHandle = await App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
        if (event?.url) {
          await this.handleDeepLink(event.url, onSuccess, onError);
        }
      });

      // 2. Cold start: check if app was launched via deep link
      try {
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
          await this.handleDeepLink(launchUrl.url, onSuccess, onError);
        }
      } catch {
        // Launch URL not available or failed to read
      }

      this.unregisterListener = () => {
        listenerHandle.remove();
        this.isInitialized = false;
      };

      return this.unregisterListener;
    }

    return () => {
      this.isInitialized = false;
    };
  }
}

export const deepLinkAuthHandler = new DeepLinkAuthHandler();
