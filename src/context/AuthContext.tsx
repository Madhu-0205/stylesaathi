import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, AuthStatus } from '../types';
import { supabaseAuthRepository } from '../repositories/SupabaseAuthRepository';
import { isSupabaseConfigured } from '../lib/supabase';
import { syncService } from '../lib/sync/syncService';
import { deepLinkAuthHandler } from '../services/deepLinkHandler';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import {
  generatePkceVerifier,
  generatePkceChallenge,
  savePendingPkceVerifier,
  getAndClearPendingPkceVerifier,
  extractAndScrubExchangeCode,
  redeemExchangeCode,
  fetchAuthenticatedUser,
  getWorkerBaseUrl,
  getInMemorySessionToken,
  revokeWorkerSession,
  deleteWorkerAccount,
  extractAndScrubAuthError,
} from '../lib/auth/pkce';

export interface AuthErrorInfo {
  code: string;
  message: string;
}

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isGuest: boolean;
  isCloudConfigured: boolean;
  authError: AuthErrorInfo | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | { url?: string }>;
  sendEmailOtp: (email: string, name?: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<User>;
  signInWithEmail: (email: string, name?: string) => Promise<User>;
  continueAsGuest: () => Promise<User>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const isCloudConfigured = isSupabaseConfigured();

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Restore session on boot or process incoming PKCE exchange code
  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      // 0. Check for authentication errors returned from OAuth callback redirect (#auth_error=...)
      const incomingAuthError = extractAndScrubAuthError();
      if (incomingAuthError) {
        const friendlyMessage =
          incomingAuthError === 'session_expired' || incomingAuthError === 'INVALID_STATE'
            ? 'Your sign-in session expired or was interrupted. For your security, Google sign-in transactions must be completed within 10 minutes.'
            : incomingAuthError === 'access_denied'
            ? 'Google sign-in was cancelled or access was declined.'
            : 'We could not securely verify your Google sign-in. Please try again.';
        if (mounted) {
          setAuthError({ code: incomingAuthError, message: friendlyMessage });
        }
      }
      // 1. Check for single-use PKCE exchange code in URL fragment (#code=<exchange_code>)
      // Immediately scrubs the fragment to protect the code from URL leakage/history
      const exchangeCode = extractAndScrubExchangeCode();

      if (exchangeCode) {
        const verifier = getAndClearPendingPkceVerifier();
        if (verifier) {
          try {
            const workerBaseUrl = getWorkerBaseUrl();
            const { sessionToken, userId } = await redeemExchangeCode(
              workerBaseUrl,
              exchangeCode,
              verifier
            );

            let authUser: User;
            try {
              authUser = await fetchAuthenticatedUser(workerBaseUrl, sessionToken);
            } catch {
              authUser = {
                id: userId,
                email: '',
                name: 'StyleSaathi Member',
                isGuest: false,
                createdAt: Date.now(),
              };
            }

            if (!mounted) return;
            setUser(authUser);
            setStatus('authenticated');
            syncService.setCurrentUser(authUser);
            syncService.setAuthToken(sessionToken);

            await syncService.migrateGuestData(authUser);
            await syncService.recoverAndSync();
            return;
          } catch (exchangeErr) {
            console.error('PKCE exchange code redemption failed on boot:', exchangeErr);
          }
        } else {
          console.warn('PKCE exchange code present in URL but pending verifier missing from storage.');
        }
      }

      // 2. Check if an in-memory session token exists (e.g. warm SPA re-render)
      const inMemoryToken = getInMemorySessionToken();
      if (inMemoryToken) {
        try {
          const workerBaseUrl = getWorkerBaseUrl();
          const authUser = await fetchAuthenticatedUser(workerBaseUrl, inMemoryToken);
          if (!mounted) return;
          setUser(authUser);
          setStatus('authenticated');
          syncService.setCurrentUser(authUser);
          syncService.setAuthToken(inMemoryToken);
          return;
        } catch {
          // Token expired or invalid
        }
      }

      // 3. Fallback to local guest session or configured Supabase session
      const storedUser = await supabaseAuthRepository.getUser();
      if (!mounted) return;
      if (storedUser) {
        setUser(storedUser);
        setStatus(storedUser.isGuest ? 'guest' : 'authenticated');
        syncService.setCurrentUser(storedUser);
      } else {
        setUser(null);
        setStatus('unauthenticated');
        syncService.setCurrentUser(null);
        syncService.setAuthToken(null);
      }
    };

    bootstrapAuth();

    const unsubscribe = supabaseAuthRepository.onAuthStateChange?.((changedUser) => {
      if (!mounted) return;
      if (changedUser) {
        setUser(changedUser);
        setStatus(changedUser.isGuest ? 'guest' : 'authenticated');
        syncService.setCurrentUser(changedUser);
        if (!changedUser.isGuest) {
          syncService.migrateGuestData(changedUser).then(() => {
            syncService.recoverAndSync();
          });
        }
      } else {
        // Only clear if no in-memory Worker session is active
        if (!getInMemorySessionToken()) {
          setUser(null);
          setStatus('unauthenticated');
          syncService.setCurrentUser(null);
          syncService.setAuthToken(null);
        }
      }
    });

    // Initialize Android deep link listener for PKCE OAuth callback
    let cleanupDeepLink: (() => void) | undefined;
    deepLinkAuthHandler
      .initialize((authenticatedUser) => {
        if (!mounted) return;
        setUser(authenticatedUser);
        setStatus('authenticated');
        syncService.setCurrentUser(authenticatedUser);
        const token = getInMemorySessionToken();
        if (token) {
          syncService.setAuthToken(token);
        }
        syncService.migrateGuestData(authenticatedUser).then(() => {
          syncService.recoverAndSync();
        });
      })
      .then((cleanup) => {
        cleanupDeepLink = cleanup;
      });

    return () => {
      mounted = false;
      unsubscribe?.();
      cleanupDeepLink?.();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const isNative =
      typeof Capacitor !== 'undefined' &&
      typeof Capacitor.isNativePlatform === 'function' &&
      Capacitor.isNativePlatform();

    try {
      // 1. Generate cryptographically secure PKCE verifier and S256 challenge
      const verifier = generatePkceVerifier();
      const challenge = await generatePkceChallenge(verifier);
      savePendingPkceVerifier(verifier);

      // 2. Build Worker social sign-in initiation URL
      const workerBaseUrl = getWorkerBaseUrl();
      const platform = isNative ? 'android' : 'web';
      const authUrl = `${workerBaseUrl.replace(/\/+$/, '')}/api/auth/sign-in/social?provider=google&platform=${platform}&client_code_challenge=${encodeURIComponent(challenge)}`;

      if (isNative) {
        await Browser.open({ url: authUrl });
        return { url: authUrl };
      } else {
        if (typeof window !== 'undefined') {
          window.location.href = authUrl;
        }
        return { url: authUrl };
      }
    } catch (err) {
      // If Worker flow initiation fails and Supabase is configured, fallback to Supabase
      if (isSupabaseConfigured()) {
        const res = await supabaseAuthRepository.signInWithGoogle();
        if ('id' in res) {
          setUser(res);
          setStatus('authenticated');
          syncService.setCurrentUser(res);
          await syncService.migrateGuestData(res);
          await syncService.recoverAndSync();
          return res;
        }
        if (res.url && typeof window !== 'undefined') {
          window.location.href = res.url;
        }
        return res;
      }
      throw err;
    }
  }, []);

  const sendEmailOtp = useCallback(async (email: string, name?: string) => {
    if (supabaseAuthRepository.sendEmailOtp) {
      await supabaseAuthRepository.sendEmailOtp(email, name);
    }
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    if (!supabaseAuthRepository.verifyEmailOtp) {
      throw new Error('Email OTP verification is not supported in this environment');
    }
    const verifiedUser = await supabaseAuthRepository.verifyEmailOtp(email, token);
    setUser(verifiedUser);
    setStatus('authenticated');
    syncService.setCurrentUser(verifiedUser);
    await syncService.migrateGuestData(verifiedUser);
    await syncService.recoverAndSync();
    return verifiedUser;
  }, []);

  const signInWithEmail = useCallback(async (email: string, name?: string) => {
    const newUser = await supabaseAuthRepository.signInWithEmail(email, name);
    setUser(newUser);
    setStatus('authenticated');
    syncService.setCurrentUser(newUser);
    await syncService.migrateGuestData(newUser);
    await syncService.recoverAndSync();
    return newUser;
  }, []);

  const continueAsGuest = useCallback(async () => {
    const guestUser = await supabaseAuthRepository.continueAsGuest();
    setUser(guestUser);
    setStatus('guest');
    syncService.setCurrentUser(guestUser);
    return guestUser;
  }, []);

  const signOut = useCallback(async () => {
    const workerBaseUrl = getWorkerBaseUrl();
    await revokeWorkerSession(workerBaseUrl);
    await supabaseAuthRepository.signOut();
    setUser(null);
    setStatus('unauthenticated');
    syncService.setCurrentUser(null);
    syncService.setAuthToken(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const workerBaseUrl = getWorkerBaseUrl();
    const token = getInMemorySessionToken();
    if (token) {
      try {
        await deleteWorkerAccount(workerBaseUrl, token);
      } catch (err) {
        console.warn('Worker account deletion warning:', err);
      }
    }
    if (supabaseAuthRepository.deleteAccount) {
      await supabaseAuthRepository.deleteAccount();
    } else {
      await supabaseAuthRepository.signOut();
    }
    setUser(null);
    setStatus('unauthenticated');
    syncService.setCurrentUser(null);
    syncService.setAuthToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isGuest: status === 'guest',
      isCloudConfigured,
      authError,
      clearAuthError,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signInWithEmail,
      continueAsGuest,
      signOut,
      deleteAccount,
    }),
    [
      user,
      status,
      isCloudConfigured,
      authError,
      clearAuthError,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signInWithEmail,
      continueAsGuest,
      signOut,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
