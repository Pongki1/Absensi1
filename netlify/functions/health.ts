export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return Response.json(
      { error: 'Metode tidak diizinkan.' },
      { status: 405, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return Response.json(
    {
      status: 'ok',
      service: 'smart-absensi-backend',
      runtime: 'netlify-functions',
      environment: process.env.CONTEXT || 'production',
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
};
