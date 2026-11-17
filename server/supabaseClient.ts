import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function hasEnvSecret(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeSupabaseProjectUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function createServerSupabaseClient(): SupabaseClient | null {
  const url = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL);
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    return null;
  }

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
