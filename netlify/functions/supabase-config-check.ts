import { hasEnvSecret } from '../../server/supabaseClient.ts';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return Response.json(
      { error: 'Metode tidak diizinkan.' },
      { status: 405, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const hasSupabaseUrl = hasEnvSecret(process.env.SUPABASE_URL);
  const hasSupabasePublishableKey = hasEnvSecret(process.env.SUPABASE_PUBLISHABLE_KEY);

  return Response.json(
    {
      backendRuntime: 'ACTIVE',
      SUPABASE_URL: hasSupabaseUrl ? 'YES' : 'NO',
      SUPABASE_PUBLISHABLE_KEY: hasSupabasePublishableKey ? 'YES' : 'NO',
      ready: hasSupabaseUrl && hasSupabasePublishableKey ? 'YES' : 'NO',
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
};
