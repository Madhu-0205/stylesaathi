import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, AuthStatus } from '../types';
import { authRepository } from '../repositories/LocalStorageAuthRepository';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isGuest: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, name?: string) => Promise<User>;
  continueAsGuest: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let mounted = true;
    authRepository.getUser().then((storedUser) => {
      if (!mounted) return;
      if (storedUser) {
        setUser(storedUser);
        setStatus(storedUser.isGuest ? 'guest' : 'authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const newUser = await authRepository.signInWithGoogle();
    setUser(newUser);
    setStatus('authenticated');
    return newUser;
  }, []);

  const signInWithEmail = useCallback(async (email: string, name?: string) => {
    const newUser = await authRepository.signInWithEmail(email, name);
    setUser(newUser);
    setStatus('authenticated');
    return newUser;
  }, []);

  const continueAsGuest = useCallback(async () => {
    const guestUser = await authRepository.continueAsGuest();
    setUser(guestUser);
    setStatus('guest');
    return guestUser;
  }, []);

  const signOut = useCallback(async () => {
    await authRepository.signOut();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isGuest: status === 'guest',
      signInWithGoogle,
      signInWithEmail,
      continueAsGuest,
      signOut,
    }),
    [user, status, signInWithGoogle, signInWithEmail, continueAsGuest, signOut]
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
