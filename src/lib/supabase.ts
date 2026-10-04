import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (import.meta.env as any).NEXT_PUBLIC_SUPABASE_URL ||
  (import.meta.env as any).SUPABASE_URL;

const rawKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (import.meta.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (import.meta.env as any).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta.env as any).SUPABASE_ANON_KEY ||
  (import.meta.env as any).SUPABASE_PUBLISHABLE_KEY;

export const supabaseUrl: string = typeof rawUrl === 'string' ? rawUrl.trim().replace(/^["']|["']$/g, '') : '';
export const supabaseAnonKey: string = typeof rawKey === 'string' ? rawKey.trim().replace(/^["']|["']$/g, '') : '';

/**
 * Checks whether Supabase has been configured with a valid URL and publishable anon key.
 * Never throws.
 */
export const isSupabaseConfigured = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

let clientInstance: SupabaseClient | null = null;

/**
 * Retrieves the initialized Supabase client singleton.
 * Throws a clean, actionable error if configuration is missing.
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (clientInstance) return clientInstance;
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local or your hosting environment.'
    );
  }
  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'stylesaathi-supabase-auth-token',
    },
  });
  return clientInstance;
};

/**
 * Proxy export for convenient client access.
 * If Supabase is unconfigured, throws an actionable configuration error upon method invocation
 * instead of crashing during initial module load.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getSupabaseClient();
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});
