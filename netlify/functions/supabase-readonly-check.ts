import { createServerSupabaseClient } from '../../server/supabaseClient.ts';

type ReadOnlyCheckStatus =
  | 'CONNECTED_READ_ONLY'
  | 'CONNECTED_ACCESS_DENIED'
  | 'CONNECTION_ERROR';

function sanitizeSafeError(code: string | undefined, message: string | undefined): string {
  const raw = message || 'Terjadi kesalahan saat memeriksa koneksi Supabase.';
  const cleaned = raw
    .replace(/https?:\/\/[^\s'"]+/gi, '[URL_REDACTED]')
    .replace(/\b(eyJ[A-Za-z0-9_-]+\.?[A-Za-z0-9_.-]*|sb_[A-Za-z0-9_-]+)\b/g, '[KEY_REDACTED]');
  return code ? `[${code}] ${cleaned}` : cleaned;
}

function classifySupabaseError(
  httpStatus: number,
  code: string | undefined,
  message: string | undefined
): ReadOnlyCheckStatus {
  const msg = (message || '').toLowerCase();

  if (
    msg.includes('invalid api key') ||
    msg.includes('no api key') ||
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    code === 'PGRST205'
  ) {
    return 'CONNECTION_ERROR';
  }

  if (
    code === '42501' ||
    httpStatus === 401 ||
    httpStatus === 403 ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('insufficient_privilege') ||
    msg.includes('not allowed')
  ) {
    return 'CONNECTED_ACCESS_DENIED';
  }

  return 'CONNECTION_ERROR';
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return Response.json(
      { error: 'Metode tidak diizinkan.' },
      { status: 405, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return Response.json(
      {
        backendRuntime: 'ACTIVE',
        supabaseConnection: 'ERROR',
        tableTested: 'public.school_settings',
        queryType: 'SELECT_HEAD_COUNT',
        rowCount: null,
        status: 'CONNECTION_ERROR' as ReadOnlyCheckStatus,
        safeError:
          'Konfigurasi environment SUPABASE_URL atau SUPABASE_PUBLISHABLE_KEY tidak tersedia.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const { count, error, status: httpStatus } = await supabase
      .from('school_settings')
      .select('*', { count: 'exact', head: true });

    if (!error) {
      return Response.json(
        {
          backendRuntime: 'ACTIVE',
          supabaseConnection: 'CONNECTED',
          tableTested: 'public.school_settings',
          queryType: 'SELECT_HEAD_COUNT',
          rowCount: typeof count === 'number' ? count : null,
          status: 'CONNECTED_READ_ONLY' as ReadOnlyCheckStatus,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const classifiedStatus = classifySupabaseError(httpStatus, error.code, error.message);
    const responseHttpStatus = classifiedStatus === 'CONNECTED_ACCESS_DENIED' ? 403 : 502;

    return Response.json(
      {
        backendRuntime: 'ACTIVE',
        supabaseConnection:
          classifiedStatus === 'CONNECTED_ACCESS_DENIED' ? 'CONNECTED' : 'ERROR',
        tableTested: 'public.school_settings',
        queryType: 'SELECT_HEAD_COUNT',
        rowCount: null,
        status: classifiedStatus,
        safeError: sanitizeSafeError(error.code, error.message),
      },
      { status: responseHttpStatus, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : 'Gagal menghubungi endpoint Supabase.';
    return Response.json(
      {
        backendRuntime: 'ACTIVE',
        supabaseConnection: 'ERROR',
        tableTested: 'public.school_settings',
        queryType: 'SELECT_HEAD_COUNT',
        rowCount: null,
        status: 'CONNECTION_ERROR' as ReadOnlyCheckStatus,
        safeError: sanitizeSafeError(undefined, errMsg),
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
};
