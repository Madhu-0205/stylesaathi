import { AuthRepository, User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const GUEST_SESSION_KEY = 'stylesaathi-guest-session-v1';

export class SupabaseAuthRepository implements AuthRepository {
  private memStorage = new Map<string, string>();

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

  private mapSupabaseUser(sbUser: any): User {
    const email = sbUser.email || '';
    const metaName = sbUser.user_metadata?.name || sbUser.user_metadata?.full_name;
    const fallbackName = metaName || (email ? email.split('@')[0] : 'StyleSaathi Member');

    return {
      id: sbUser.id,
      email,
      name: fallbackName,
      isGuest: false,
      createdAt: sbUser.created_at ? new Date(sbUser.created_at).getTime() : Date.now(),
    };
  }

  /**
   * Retrieves the current user identity.
   * Priority:
   * 1. Real active Supabase cloud session (if configured)
   * 2. Local guest session (if user chose "Continue without account")
   * 3. null (unauthenticated)
   */
  async getUser(): Promise<User | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Supabase getSession error:', error.message);
        } else if (data?.session?.user) {
          return this.mapSupabaseUser(data.session.user);
        }
      } catch (err) {
        console.warn('Failed to verify Supabase session:', err);
      }
    }

    // Check for local guest session
    const guestRaw = this.getRaw(GUEST_SESSION_KEY);
    if (guestRaw) {
      try {
        const parsed = JSON.parse(guestRaw);
        if (parsed && parsed.isGuest) {
          return parsed as User;
        }
      } catch {}
    }

    return null;
  }

  /**
   * Initiates real Google OAuth flow with redirect.
   */
  async signInWithGoogle(): Promise<User | { url?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Cloud authentication is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable Google sign-in.'
      );
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: origin,
      },
    });

    if (error) {
      throw new Error(error.message || 'Google authentication failed');
    }

    return { url: data?.url ?? undefined };
  }

  /**
   * Sends a 6-digit OTP code to the user's email address.
   */
  async sendEmailOtp(email: string, name?: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Cloud authentication is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable email sign-in.'
      );
    }

    const cleanedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanedEmail,
      options: {
        shouldCreateUser: true,
        data: name?.trim() ? { name: name.trim() } : undefined,
      },
    });

    if (error) {
      // Translate technical error into user-friendly message
      if (error.message.includes('rate limit')) {
        throw new Error('Too many login attempts. Please wait 60 seconds before trying again.');
      }
      throw new Error(error.message || 'Failed to send login code. Please try again.');
    }
  }

  /**
   * Verifies the 6-digit OTP code entered by the user.
   */
  async verifyEmailOtp(email: string, token: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Cloud authentication is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
    }

    const cleanedEmail = email.trim().toLowerCase();
    const cleanedToken = token.trim();

    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanedEmail,
      token: cleanedToken,
      type: 'email',
    });

    if (error || !data?.user) {
      throw new Error(error?.message || 'Invalid or expired code. Please request a new code.');
    }

    // Clear local guest identity flag since user is now officially authenticated
    this.removeRaw(GUEST_SESSION_KEY);

    return this.mapSupabaseUser(data.user);
  }

  /**
   * Backward-compatible entrypoint: sends OTP for passwordless auth.
   */
  async signInWithEmail(email: string, name?: string): Promise<User> {
    await this.sendEmailOtp(email, name);
    // Return pending state indicator or throw to guide UI to OTP entry
    throw new Error('OTP_REQUIRED: A 6-digit login code has been sent to your email.');
  }

  /**
   * Establishes a local guest session.
   * Guest data stays strictly on device and never fakes a cloud account.
   */
  async continueAsGuest(): Promise<User> {
    const existing = this.getRaw(GUEST_SESSION_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed?.isGuest) return parsed;
      } catch {}
    }

    const guestUser: User = {
      id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: 'Guest Stylist',
      isGuest: true,
      createdAt: Date.now(),
    };
    this.setRaw(GUEST_SESSION_KEY, JSON.stringify(guestUser));
    return guestUser;
  }

  /**
   * Signs out cleanly.
   * Invalidates remote Supabase session and removes local guest session.
   */
  async signOut(): Promise<void> {
    this.removeRaw(GUEST_SESSION_KEY);
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error during Supabase signOut:', err);
      }
    }
  }

  async clear(): Promise<void> {
    await this.signOut();
    this.memStorage.clear();
  }

  /**
   * Subscribes to Supabase authentication state changes.
   */
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    if (!isSupabaseConfigured()) {
      return () => {};
    }

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        this.removeRaw(GUEST_SESSION_KEY);
        callback(this.mapSupabaseUser(session.user));
      } else if (event === 'SIGNED_OUT') {
        const guest = await this.getUser();
        callback(guest);
      } else {
        const currentUser = await this.getUser();
        callback(currentUser);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }
}

export const supabaseAuthRepository = new SupabaseAuthRepository();
