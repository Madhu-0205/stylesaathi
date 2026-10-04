import { AuthRepository, User } from '../types';

const AUTH_USER_KEY = 'stylesaathi-auth-user-v1';

export class LocalStorageAuthRepository implements AuthRepository {
  private memStorage = new Map<string, string>();
  private listeners = new Set<(user: User | null) => void>();

  private getRaw(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return this.memStorage.get(key) || null;
  }

  private setRaw(key: string, val: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
        return;
      }
    } catch {}
    this.memStorage.set(key, val);
  }

  private removeRaw(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    this.memStorage.delete(key);
  }

  private notify(user: User | null): void {
    for (const listener of this.listeners) {
      try {
        listener(user);
      } catch (err) {
        console.warn('Listener error in LocalStorageAuthRepository:', err);
      }
    }
  }

  async getUser(): Promise<User | null> {
    const raw = this.getRaw(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async signInWithGoogle(): Promise<User> {
    const user: User = {
      id: `usr_g_${Date.now()}`,
      name: 'StyleSaathi Member',
      email: 'member@stylesaathi.in',
      isGuest: false,
      createdAt: Date.now(),
    };
    this.setRaw(AUTH_USER_KEY, JSON.stringify(user));
    this.notify(user);
    return user;
  }

  async sendEmailOtp(_email: string, _name?: string): Promise<void> {
    // Local mock for unit tests: no-op
  }

  async verifyEmailOtp(email: string, name?: string): Promise<User> {
    return this.signInWithEmail(email, name);
  }

  async signInWithEmail(email: string, name?: string): Promise<User> {
    const cleanedEmail = email.trim().toLowerCase();
    const fallbackName = name?.trim() || cleanedEmail.split('@')[0] || 'StyleSaathi Member';
    const user: User = {
      id: `usr_e_${Date.now()}`,
      name: fallbackName,
      email: cleanedEmail,
      isGuest: false,
      createdAt: Date.now(),
    };
    this.setRaw(AUTH_USER_KEY, JSON.stringify(user));
    this.notify(user);
    return user;
  }

  async continueAsGuest(): Promise<User> {
    const user: User = {
      id: `guest_${Date.now()}`,
      name: 'Guest Stylist',
      isGuest: true,
      createdAt: Date.now(),
    };
    this.setRaw(AUTH_USER_KEY, JSON.stringify(user));
    this.notify(user);
    return user;
  }

  async signOut(): Promise<void> {
    this.removeRaw(AUTH_USER_KEY);
    this.notify(null);
  }

  async clear(): Promise<void> {
    await this.signOut();
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const authRepository = new LocalStorageAuthRepository();
