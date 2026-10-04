import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, AuthStatus } from '../types';
import { supabaseAuthRepository } from '../repositories/SupabaseAuthRepository';
import { isSupabaseConfigured } from '../lib/supabase';
import { syncService } from '../lib/sync/syncService';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isGuest: boolean;
  isCloudConfigured: boolean;
  signInWithGoogle: () => Promise<User | { url?: string }>;
  sendEmailOtp: (email: string, name?: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<User>;
  signInWithEmail: (email: string, name?: string) => Promise<User>;
  continueAsGuest: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const isCloudConfigured = isSupabaseConfigured();

  // Restore session on boot
  useEffect(() => {
    let mounted = true;
    supabaseAuthRepository.getUser().then((storedUser) => {
      if (!mounted) return;
      if (storedUser) {
        setUser(storedUser);
        setStatus(storedUser.isGuest ? 'guest' : 'authenticated');
        syncService.setCurrentUser(storedUser);
      } else {
        setUser(null);
        setStatus('unauthenticated');
        syncService.setCurrentUser(null);
      }
    });

    const unsubscribe = supabaseAuthRepository.onAuthStateChange?.((changedUser) => {
      if (!mounted) return;
      if (changedUser) {
        setUser(changedUser);
        setStatus(changedUser.isGuest ? 'guest' : 'authenticated');
        syncService.setCurrentUser(changedUser);
        if (!changedUser.isGuest) {
          // Trigger guest data migration if previously guest
          syncService.migrateGuestData(changedUser).then(() => {
            syncService.recoverAndSync();
          });
        }
      } else {
        setUser(null);
        setStatus('unauthenticated');
        syncService.setCurrentUser(null);
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const res = await supabaseAuthRepository.signInWithGoogle();
    if ('id' in res) {
      setUser(res);
      setStatus('authenticated');
      syncService.setCurrentUser(res);
      await syncService.migrateGuestData(res);
      await syncService.recoverAndSync();
      return res;
    }
    // If OAuth returns a redirect URL, the browser redirects
    if (res.url && typeof window !== 'undefined') {
      window.location.href = res.url;
    }
    return res;
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
    await supabaseAuthRepository.signOut();
    setUser(null);
    setStatus('unauthenticated');
    syncService.setCurrentUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isGuest: status === 'guest',
      isCloudConfigured,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signInWithEmail,
      continueAsGuest,
      signOut,
    }),
    [
      user,
      status,
      isCloudConfigured,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signInWithEmail,
      continueAsGuest,
      signOut,
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
