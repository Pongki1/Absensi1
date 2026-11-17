import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  createServerSupabaseClient,
  hasEnvSecret,
  normalizeSupabaseProjectUrl,
} from './server/supabaseClient.ts';
import { buildSourceZipBuffer } from './server/sourceArchive.ts';
import { SchoolStore } from './server/schoolStore.ts';
import { verifyFirebaseGoogleIdToken } from './server/firebaseTokenVerifier.ts';
import type {
  AttendanceStatus,
  AuthProviderKind,
  GateType,
  ScanMethod,
  SchoolAccountSummary,
  SchoolDatabaseSnapshot,
  SchoolSyncEvent,
  StudentRecord,
  UserRole,
} from './src/types/attendance.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

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

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) return token;
  }
  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  return queryToken || null;
}

function isAdminRole(role: UserRole): boolean {
  return role === 'Admin Sekolah' || role === 'Super Admin';
}

function isAuthorizerRole(role: UserRole): boolean {
  return role === 'Admin Sekolah' || role === 'Super Admin' || role === 'Kepala Sekolah';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  const schoolStore = new SchoolStore(import.meta.dirname);

  // Real-time Server-Sent Events (SSE) clients for 1 central storage synchronization
  const syncClients = new Set<{
    res: Response;
    accountId: string;
    role: UserRole;
  }>();

  const broadcastSyncEvent = (event: SchoolSyncEvent) => {
    const payload = `event: school_sync\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of syncClients) {
      try {
        client.res.write(payload);
      } catch {
        syncClients.delete(client);
      }
    }
  };

  const resolveAuthorizedAccount = async (
    req: Request
  ): Promise<{ account: SchoolAccountSummary; isLocalAccount: boolean } | null> => {
    const token = extractBearerToken(req);
    if (!token) return null;

    const localAccount = schoolStore.verifySessionToken(token);
    if (localAccount) {
      return { account: localAccount, isLocalAccount: true };
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) return null;

    try {
      const { data: userData, error } = await supabase.auth.getUser(token);
      if (error || !userData.user) return null;

      return {
        account: {
          id: userData.user.id,
          email: userData.user.email ?? '',
          fullName: userData.user.user_metadata?.full_name || userData.user.email || 'Petugas Sekolah',
          role: 'Admin Sekolah',
          assignedClassId: null,
          assignedClassName: null,
          isActive: true,
          authProvider: 'password',
          createdAt: userData.user.created_at,
        },
        isLocalAccount: false,
      };
    } catch {
      return null;
    }
  };

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      service: 'smart-absensi-backend',
      runtime: 'nodejs',
      environment: isProduction ? 'production' : 'development',
      timestamp: new Date().toISOString(),
    });
  });

  // Safe Secrets availability diagnostic (strictly YES/NO, never exposes values)
  app.get('/api/supabase-config-check', (_req: Request, res: Response) => {
    const hasSupabaseUrl = hasEnvSecret(process.env.SUPABASE_URL);
    const hasSupabasePublishableKey = hasEnvSecret(process.env.SUPABASE_PUBLISHABLE_KEY);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      backendRuntime: 'ACTIVE',
      SUPABASE_URL: hasSupabaseUrl ? 'YES' : 'NO',
      SUPABASE_PUBLISHABLE_KEY: hasSupabasePublishableKey ? 'YES' : 'NO',
      ready: hasSupabaseUrl && hasSupabasePublishableKey ? 'YES' : 'NO',
    });
  });

  // Public Supabase runtime config for browser client (ONLY Project URL & Publishable Key)
  app.get('/api/supabase-public-config', (_req: Request, res: Response) => {
    const supabaseUrl = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL);
    const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

    res.setHeader('Cache-Control', 'no-store');

    if (!supabaseUrl || !supabasePublishableKey) {
      res.status(500).json({
        error: 'Konfigurasi publik Supabase belum tersedia atau format URL tidak valid.',
      });
      return;
    }

    res.json({
      supabaseUrl,
      supabasePublishableKey,
    });
  });

  // Read-only SELECT head/count check against public.school_settings
  app.get('/api/supabase-readonly-check', async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');

    const supabase = createServerSupabaseClient();
    if (!supabase) {
      res.status(500).json({
        backendRuntime: 'ACTIVE',
        supabaseConnection: 'ERROR',
        tableTested: 'public.school_settings',
        queryType: 'SELECT_HEAD_COUNT',
        rowCount: null,
        status: 'CONNECTION_ERROR' as ReadOnlyCheckStatus,
        safeError: 'Konfigurasi environment SUPABASE_URL atau SUPABASE_PUBLISHABLE_KEY tidak tersedia.',
      });
      return;
    }

    try {
      const { count, error, status: httpStatus } = await supabase
        .from('school_settings')
        .select('*', { count: 'exact', head: true });

      if (!error) {
        res.status(200).json({
          backendRuntime: 'ACTIVE',
          supabaseConnection: 'CONNECTED',
          tableTested: 'public.school_settings',
          queryType: 'SELECT_HEAD_COUNT',
          rowCount: typeof count === 'number' ? count : null,
          status: 'CONNECTED_READ_ONLY' as ReadOnlyCheckStatus,
        });
        return;
      }

      const classifiedStatus = classifySupabaseError(
        httpStatus,
        error.code,
        error.message
      );
      const responseHttpStatus =
        classifiedStatus === 'CONNECTED_ACCESS_DENIED' ? 403 : 502;

      res.status(responseHttpStatus).json({
        backendRuntime: 'ACTIVE',
        supabaseConnection:
          classifiedStatus === 'CONNECTED_ACCESS_DENIED' ? 'CONNECTED' : 'ERROR',
        tableTested: 'public.school_settings',
        queryType: 'SELECT_HEAD_COUNT',
        rowCount: null,
        status: classifiedStatus,
        safeError: sanitizeSafeError(error.code, error.message),
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menghubungi endpoint Supabase.';
      res.status(502).json({
        backendRuntime: 'ACTIVE',
        supabaseConnection: 'ERROR',
        tableTested: 'public.school_settings',
        queryType: 'SELECT_HEAD_COUNT',
        rowCount: null,
        status: 'CONNECTION_ERROR' as ReadOnlyCheckStatus,
        safeError: sanitizeSafeError(undefined, errMsg),
      });
    }
  });

  // --- Built-in Production School Auth (Email/Password + Google OAuth via Firebase ID Token) ---
  app.post('/api/auth/login', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ code: 'invalid_input', message: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const result = schoolStore.authenticateEmailPassword(email, password);
    if (!result.ok) {
      res.status(401).json({ code: result.code, message: result.message });
      return;
    }

    res.json({
      token: result.token,
      account: result.account,
    });
  });

  app.post('/api/auth/google-login', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const { idToken } = (req.body ?? {}) as { idToken?: string };
    if (typeof idToken !== 'string' || !idToken.trim()) {
      res.status(400).json({ message: 'Token autentikasi Google tidak ditemukan.' });
      return;
    }

    try {
      const identity = await verifyFirebaseGoogleIdToken(idToken.trim(), import.meta.dirname);
      const outcome = schoolStore.authenticateGoogleIdentity(identity);

      if (outcome.status === 'approved') {
        res.json({
          status: 'approved',
          token: outcome.token,
          account: outcome.account,
        });
        return;
      }

      if (outcome.status === 'inactive') {
        res.status(403).json({
          status: 'inactive',
          message: outcome.message,
        });
        return;
      }

      // Notify connected Super Admin / Kepala Sekolah that a Google account is waiting for authorization
      broadcastSyncEvent({
        type: 'accounts_updated',
        updatedAt: new Date().toISOString(),
        actorName: outcome.request.fullName,
        summary: `Permintaan otorisasi login Google dari ${outcome.request.email}`,
      });

      res.status(403).json({
        status: 'pending_approval',
        message:
          'Akun Google Anda berhasil diverifikasi, namun belum diberi otoritas akses oleh Super Admin / Kepala Sekolah.',
        request: outcome.request,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Verifikasi token Google gagal dilakukan.';
      res.status(401).json({ status: 'error', message: msg });
    }
  });

  app.post('/api/auth/google-request-preference', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const { idToken, requestedRole, requestedClassId, note } = (req.body ?? {}) as {
      idToken?: string;
      requestedRole?: UserRole | null;
      requestedClassId?: string | null;
      note?: string | null;
    };
    if (typeof idToken !== 'string' || !idToken.trim()) {
      res.status(400).json({ message: 'Token Google wajib disertakan.' });
      return;
    }

    try {
      const identity = await verifyFirebaseGoogleIdToken(idToken.trim(), import.meta.dirname);
      const updated = schoolStore.updatePendingGoogleRequestPreference(identity.email, {
        requestedRole,
        requestedClassId,
        note,
      });
      if (!updated) {
        res.status(404).json({ message: 'Permintaan akses Google tidak ditemukan.' });
        return;
      }

      broadcastSyncEvent({
        type: 'accounts_updated',
        updatedAt: new Date().toISOString(),
        actorName: updated.fullName,
        summary: `Pengajuan peran ${updated.requestedRole ?? 'Petugas'} dari ${updated.email}`,
      });

      res.json({ request: updated });
    } catch (err) {
      res.status(401).json({
        message: err instanceof Error ? err.message : 'Verifikasi Google gagal.',
      });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
      return;
    }
    res.json({ account: auth.account });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth || !auth.isLocalAccount) {
      res.status(401).json({ message: 'Akses perubahan sandi tidak diizinkan.' });
      return;
    }
    const { currentPassword, newPassword } = (req.body ?? {}) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const result = schoolStore.changeOwnPassword(
      auth.account.id,
      String(currentPassword ?? ''),
      String(newPassword ?? '')
    );
    if (!result.ok) {
      res.status(400).json({ message: result.message });
      return;
    }
    res.json({ ok: true });
  });

  // --- User Authorization & Google Request Management (Super Admin, Admin Sekolah & Kepala Sekolah) ---
  app.get('/api/auth/google-requests', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({ message: 'Autentikasi diperlukan.' });
      return;
    }
    if (!isAuthorizerRole(auth.account.role)) {
      res.status(403).json({
        message: 'Hanya Super Admin, Admin Sekolah, atau Kepala Sekolah yang dapat melihat antrean otorisasi Google.',
      });
      return;
    }
    res.json({ requests: schoolStore.listAccessRequests() });
  });

  app.post('/api/auth/google-requests/:id/approve', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth || !isAuthorizerRole(auth.account.role)) {
      res.status(403).json({
        message: 'Hanya Super Admin, Admin Sekolah, atau Kepala Sekolah yang dapat memberi izin pengguna.',
      });
      return;
    }
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = (req.body ?? {}) as {
      role?: UserRole;
      assignedClassId?: string | null;
      fullName?: string;
    };
    const result = schoolStore.approveAccessRequest(idParam, {
      role: body.role ?? 'Guru Kelas',
      assignedClassId: body.assignedClassId ?? null,
      fullName: body.fullName,
      actorRole: auth.account.role,
      actorName: auth.account.fullName,
    });
    if (!result.ok) {
      res.status(400).json({ message: result.message });
      return;
    }

    broadcastSyncEvent({
      type: 'accounts_updated',
      updatedAt: new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
      summary: `Izin akses diberikan ke ${result.account.email} (${result.account.role})`,
    });

    res.json({ account: result.account, request: result.request });
  });

  app.post('/api/auth/google-requests/:id/reject', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth || !isAuthorizerRole(auth.account.role)) {
      res.status(403).json({
        message: 'Hanya Super Admin, Admin Sekolah, atau Kepala Sekolah yang dapat menolak permintaan.',
      });
      return;
    }
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = schoolStore.rejectAccessRequest(idParam, auth.account.fullName);
    if (!result.ok) {
      res.status(404).json({ message: result.message });
      return;
    }

    broadcastSyncEvent({
      type: 'accounts_updated',
      updatedAt: new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
      summary: `Permintaan akses ${result.request.email} ditolak`,
    });

    res.json({ request: result.request });
  });

  app.delete('/api/auth/google-requests/:id', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth || !isAuthorizerRole(auth.account.role)) {
      res.status(403).json({ message: 'Akses ditolak.' });
      return;
    }
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    schoolStore.deleteAccessRequest(idParam);
    broadcastSyncEvent({
      type: 'accounts_updated',
      updatedAt: new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
    });
    res.json({ ok: true });
  });

  app.get('/api/auth/accounts', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({ message: 'Autentikasi diperlukan.' });
      return;
    }
    if (!isAuthorizerRole(auth.account.role)) {
      res.status(403).json({
        message: 'Hanya Super Admin, Admin Sekolah, atau Kepala Sekolah yang dapat melihat daftar akun.',
      });
      return;
    }
    res.json({ accounts: schoolStore.listAccounts() });
  });

  app.post('/api/auth/accounts', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth || !isAuthorizerRole(auth.account.role)) {
      res.status(403).json({
        message: 'Hanya Super Admin, Admin Sekolah, atau Kepala Sekolah yang dapat menambahkan izin akun.',
      });
      return;
    }
    const body = (req.body ?? {}) as {
      email?: string;
      fullName?: string;
      role?: UserRole;
      assignedClassId?: string | null;
      password?: string;
      authProvider?: AuthProviderKind;
    };
    const result = schoolStore.createAccount({
      email: String(body.email ?? ''),
      fullName: String(body.fullName ?? ''),
      role: body.role ?? 'Guru Kelas',
      assignedClassId: body.assignedClassId ?? null,
      password: body.password ? String(body.password) : undefined,
      authProvider: body.authProvider,
      actorRole: auth.account.role,
      actorName: auth.account.fullName,
    });
    if (!result.ok) {
      res.status(400).json({ message: result.message });
      return;
    }

    broadcastSyncEvent({
      type: 'accounts_updated',
      updatedAt: new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
      summary: `Akun ${result.account.email} (${result.account.role}) ditambahkan`,
    });

    res.status(201).json({ account: result.account });
  });

  app.patch('/api/auth/accounts/:id', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth || !isAuthorizerRole(auth.account.role)) {
      res.status(403).json({
        message: 'Hanya Super Admin, Admin Sekolah, atau Kepala Sekolah yang dapat memperbarui otorisasi akun.',
      });
      return;
    }
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = (req.body ?? {}) as {
      email?: string;
      fullName?: string;
      role?: UserRole;
      assignedClassId?: string | null;
      isActive?: boolean;
      newPassword?: string;
      authProvider?: AuthProviderKind;
    };
    const result = schoolStore.updateAccount(idParam, body, auth.account.role);
    if (!result.ok) {
      res.status(400).json({ message: result.message });
      return;
    }

    broadcastSyncEvent({
      type: 'accounts_updated',
      updatedAt: new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
      summary: `Akun ${result.account.email} diperbarui`,
    });

    res.json({ account: result.account });
  });

  app.delete('/api/auth/accounts/:id', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth || !isAuthorizerRole(auth.account.role)) {
      res.status(403).json({ message: 'Anda tidak memiliki izin menghapus akun.' });
      return;
    }
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = schoolStore.deleteAccount(idParam, auth.account.id, auth.account.role);
    if (!result.ok) {
      res.status(400).json({ message: result.message });
      return;
    }

    broadcastSyncEvent({
      type: 'accounts_updated',
      updatedAt: new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
    });

    res.json({ ok: true });
  });

  // --- Real-Time SSE Stream + Persistent Shared 1-Server School Storage API ---
  app.get('/api/school-data/stream', async (req: Request, res: Response) => {
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({ message: 'Autentikasi diperlukan untuk sinkronisasi real-time.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const clientEntry = {
      res,
      accountId: auth.account.id,
      role: auth.account.role,
    };
    syncClients.add(clientEntry);

    res.write(
      `event: connected\ndata: ${JSON.stringify({
        connectedAt: new Date().toISOString(),
        role: auth.account.role,
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        syncClients.delete(clientEntry);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      syncClients.delete(clientEntry);
    });
  });

  app.get('/api/school-data', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({ message: 'Autentikasi diperlukan untuk memuat data sekolah.' });
      return;
    }
    res.json(schoolStore.getSnapshot());
  });

  app.put('/api/school-data', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({ message: 'Autentikasi diperlukan untuk menyimpan data sekolah.' });
      return;
    }
    const patch = (req.body ?? {}) as Partial<SchoolDatabaseSnapshot>;
    const updated = schoolStore.saveSnapshot(
      patch,
      auth.account.role,
      auth.account.assignedClassId
    );

    broadcastSyncEvent({
      type: 'snapshot_updated',
      updatedAt: updated.updatedAt ?? new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
      summary: 'Pembaruan data sekolah tersimpan ke server pusat',
    });

    res.json(updated);
  });

  app.post('/api/school-data/students/mutate', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({ message: 'Autentikasi diperlukan.' });
      return;
    }
    const body = (req.body ?? {}) as {
      type?: 'add' | 'import' | 'update' | 'delete';
      student?: StudentRecord;
      students?: StudentRecord[];
      studentId?: string;
    };
    if (!body.type) {
      res.status(400).json({ message: 'Jenis operasi siswa tidak valid.' });
      return;
    }

    const result = schoolStore.mutateStudents({
      type: body.type,
      student: body.student,
      students: body.students,
      studentId: body.studentId,
      actorRole: auth.account.role,
      actorClassId: auth.account.assignedClassId,
    });

    if (!result.ok) {
      res.status(result.statusCode).json({ message: result.message });
      return;
    }

    broadcastSyncEvent({
      type: 'snapshot_updated',
      updatedAt: result.snapshot.updatedAt ?? new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
      summary: 'Perubahan data siswa tersinkron ke server pusat',
    });

    res.json(result.snapshot);
  });

  app.post('/api/school-data/attendance', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({ message: 'Autentikasi diperlukan untuk mencatat absensi.' });
      return;
    }
    const body = (req.body ?? {}) as {
      studentId?: string;
      gateType?: GateType;
      method?: ScanMethod;
      status?: AttendanceStatus;
      keterangan?: string;
      waktu?: string;
      tanggal?: string;
    };
    if (!body.studentId || !body.gateType || !body.method || !body.status) {
      res.status(400).json({ message: 'Data absensi tidak lengkap.' });
      return;
    }
    const result = schoolStore.recordAttendance({
      studentId: body.studentId,
      gateType: body.gateType,
      method: body.method,
      status: body.status,
      petugasNama: auth.account.fullName,
      petugasRole: auth.account.role,
      keterangan: body.keterangan,
      waktu: body.waktu,
      tanggal: body.tanggal,
    });
    if (!result) {
      res.status(404).json({ message: 'Siswa tidak ditemukan di database sekolah.' });
      return;
    }

    broadcastSyncEvent({
      type: 'attendance_recorded',
      updatedAt: result.snapshot.updatedAt ?? new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
      summary: `${result.student.nama} (${result.student.kelasNama}) · ${body.gateType}: ${body.status}`,
    });

    res.json(result);
  });

  app.post('/api/school-data/reset', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth || !isAdminRole(auth.account.role)) {
      res.status(403).json({ message: 'Hanya Super Admin atau Admin Sekolah yang dapat mereset data.' });
      return;
    }
    const body = (req.body ?? {}) as { mode?: 'attendance' | 'all' };
    const mode = body.mode === 'all' ? 'all' : 'attendance';
    const snapshot = schoolStore.resetData(mode);

    broadcastSyncEvent({
      type: 'snapshot_updated',
      updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
      actorName: auth.account.fullName,
      actorRole: auth.account.role,
      summary: mode === 'all' ? 'Semua data master & log direset' : 'Kehadiran harian direset',
    });

    res.json(snapshot);
  });

  // Download complete source code archive — strictly restricted to Super Admin, Admin Sekolah, & Kepala Sekolah
  app.head('/api/download-source', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).end();
      return;
    }
    if (!isAuthorizerRole(auth.account.role)) {
      res.status(403).end();
      return;
    }
    res.status(200).end();
  });

  app.get('/api/download-source', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = await resolveAuthorizedAccount(req);
    if (!auth) {
      res.status(401).json({
        message: 'Autentikasi diperlukan untuk mengunduh source code aplikasi.',
      });
      return;
    }
    if (!isAuthorizerRole(auth.account.role)) {
      res.status(403).json({
        message:
          'Unduh source code hanya tersedia untuk akun Super Admin, Admin Sekolah, dan Kepala Sekolah.',
      });
      return;
    }

    try {
      const { buffer, fileCount } = buildSourceZipBuffer(import.meta.dirname);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="smart-absensi-tkit-source.zip"'
      );
      res.setHeader('X-Source-File-Count', String(fileCount));
      res.status(200).send(buffer);
    } catch {
      res.status(500).json({
        error: 'Gagal menyiapkan arsip source code aplikasi.',
      });
    }
  });

  // Guard unknown /api/* paths so they never fall through to SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  const httpServer = http.createServer(app);

  if (isProduction) {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(
        express.static(distDir, {
          setHeaders(staticRes, filePath) {
            if (
              filePath.endsWith('sw.js') ||
              filePath.endsWith('registerSW.js') ||
              filePath.endsWith('manifest.webmanifest') ||
              filePath.endsWith('index.html')
            ) {
              staticRes.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
          },
        })
      );
      app.get('*', (_req: Request, res: Response) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  } else {
    const enableHmr =
      process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: enableHmr ? { server: httpServer } : false,
        ws: enableHmr ? { server: httpServer } : false,
        watch: enableHmr ? {} : null,
      },
      appType: 'spa',
    });

    if (!enableHmr) {
      app.get('/@vite/client', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(`const sheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay {}
`);
      });
    }

    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[SMART ABSENSI] Server Node.js berjalan di http://0.0.0.0:${PORT} (${
        isProduction ? 'production' : 'development + Vite middleware'
      })`
    );
  });
}

startServer().catch((err) => {
  console.error('[SMART ABSENSI] Gagal menjalankan server backend:', err);
  process.exit(1);
});
