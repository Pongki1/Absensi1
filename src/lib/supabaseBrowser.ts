import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface PublicSupabaseConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

let cachedClientPromise: Promise<SupabaseClient> | null = null;

async function fetchPublicSupabaseConfig(): Promise<PublicSupabaseConfig> {
  const response = await fetch('/api/supabase-public-config', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Konfigurasi autentikasi sekolah belum siap pada server.');
  }

  const data = (await response.json()) as Partial<PublicSupabaseConfig>;
  if (
    typeof data.supabaseUrl !== 'string' ||
    !data.supabaseUrl.trim() ||
    typeof data.supabasePublishableKey !== 'string' ||
    !data.supabasePublishableKey.trim()
  ) {
    throw new Error('Konfigurasi koneksi Supabase dari server tidak lengkap.');
  }

  return {
    supabaseUrl: data.supabaseUrl.trim(),
    supabasePublishableKey: data.supabasePublishableKey.trim(),
  };
}

export function getBrowserSupabaseClient(): Promise<SupabaseClient> {
  if (!cachedClientPromise) {
    cachedClientPromise = fetchPublicSupabaseConfig()
      .then((config) =>
        createClient(config.supabaseUrl, config.supabasePublishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        })
      )
      .catch((error) => {
        cachedClientPromise = null;
        throw error;
      });
  }

  return cachedClientPromise;
}
