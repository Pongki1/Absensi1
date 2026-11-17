import { normalizeSupabaseProjectUrl } from '../../server/supabaseClient.ts';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return Response.json(
      { error: 'Metode tidak diizinkan.' },
      { status: 405, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const supabaseUrl = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL);
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    return Response.json(
      {
        error: 'Konfigurasi publik Supabase belum tersedia atau format URL tidak valid.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return Response.json(
    {
      supabaseUrl,
      supabasePublishableKey,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
};
