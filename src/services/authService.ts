import { getBrowserSupabaseClient } from '../lib/supabaseBrowser';
import { signInWithGoogleAccount, signOutFirebaseAuth } from '../lib/firebaseAuth';
import type {
  AuthProviderKind,
  GoogleAccessRequest,
  SchoolAccountSummary,
  UserRole,
} from '../types/attendance';

export type VerifiedDbRole =
  | 'super_admin'
  | 'principal'
  | 'gate_staff'
  | 'teacher'
  | 'admin_sekolah'
  | 'kepala_sekolah'
  | 'petugas_gerbang'
  | 'guru_piket'
  | 'guru_kelas'
  | 'guru'
  | 'orang_tua';

export interface SchoolUserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  appRole: UserRole;
  assignedClassId: string | null;
  assignedClassName: string | null;
  isActive: boolean;
  authProvider?: AuthProviderKind;
  photoUrl?: string | null;
  authSource: 'school_server' | 'supabase';
}

export type ProfileResolutionResult =
  | { status: 'valid'; profile: SchoolUserProfile }
  | { status: 'missing_profile'; message: string }
  | { status: 'inactive'; message: string }
  | { status: 'unknown_role'; message: string }
  | { status: 'error'; message: string };

export type GoogleSignInOutcome =
  | { status: 'approved'; profile: SchoolUserProfile }
  | {
      status: 'pending_approval';
      idToken: string;
      request: GoogleAccessRequest;
      message: string;
    }
  | { status: 'inactive'; message: string }
  | { status: 'error'; message: string };

const AUTH_TOKEN_KEY = 'smart_absensi_auth_token_v1';

const ROLE_MAPPING: Record<VerifiedDbRole, UserRole> = {
  super_admin: 'Super Admin',
  principal: 'Kepala Sekolah',
  gate_staff: 'Guru Piket',
  teacher: 'Guru Kelas',
  admin_sekolah: 'Admin Sekolah',
  kepala_sekolah: 'Kepala Sekolah',
  petugas_gerbang: 'Guru Piket',
  guru_piket: 'Guru Piket',
  guru_kelas: 'Guru Kelas',
  guru: 'Guru Kelas',
  orang_tua: 'Orang Tua',
};

function isKnownDbRole(role: unknown): role is VerifiedDbRole {
  return typeof role === 'string' && Object.prototype.hasOwnProperty.call(ROLE_MAPPING, role);
}

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function accountToProfile(account: SchoolAccountSummary): SchoolUserProfile {
  return {
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    role: account.role,
    appRole: account.role,
    assignedClassId: account.assignedClassId,
    assignedClassName: account.assignedClassName,
    isActive: account.isActive,
    authProvider: account.authProvider ?? 'both',
    photoUrl: account.photoUrl ?? null,
    authSource: 'school_server',
  };
}

export function formatSafeAuthError(rawMessage: string | undefined): string {
  const msg = (rawMessage || '').toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'Email atau kata sandi tidak sesuai.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Email akun belum terkonfirmasi.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Terlalu banyak percobaan login. Silakan tunggu beberapa saat.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Gagal menghubungi layanan autentikasi. Periksa koneksi internet Anda.';
  }
  return 'Login gagal. Pastikan email dan kata sandi akun sekolah Anda benar.';
}

async function exchangeGoogleIdTokenWithServer(idToken: string): Promise<GoogleSignInOutcome> {
  try {
    const res = await fetch('/api/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ idToken }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      token?: string;
      account?: SchoolAccountSummary;
      request?: GoogleAccessRequest;
      message?: string;
    };

    if (res.ok && data.status === 'approved' && data.token && data.account) {
      setStoredAuthToken(data.token);
      return { status: 'approved', profile: accountToProfile(data.account) };
    }

    if (data.status === 'pending_approval' && data.request) {
      return {
        status: 'pending_approval',
        idToken,
        request: data.request,
        message:
          data.message ||
          'Akun Google Anda menunggu otorisasi izin dari Super Admin / Kepala Sekolah.',
      };
    }

    if (data.status === 'inactive') {
      return {
        status: 'inactive',
        message:
          data.message || 'Akun Google Anda sedang dinonaktifkan oleh Super Admin / Kepala Sekolah.',
      };
    }

    return {
      status: 'error',
      message: data.message || 'Gagal memverifikasi akun Google pada server sekolah.',
    };
  } catch {
    return {
      status: 'error',
      message: 'Gagal terhubung ke server sekolah saat memverifikasi akun Google.',
    };
  }
}

export async function signInWithGooglePopup(): Promise<GoogleSignInOutcome> {
  try {
    const googleUser = await signInWithGoogleAccount();
    return await exchangeGoogleIdTokenWithServer(googleUser.idToken);
  } catch (err) {
    return {
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Login dengan akun Google gagal dilakukan.',
    };
  }
}

export async function checkGoogleApprovalStatus(idToken: string): Promise<GoogleSignInOutcome> {
  return exchangeGoogleIdTokenWithServer(idToken);
}

export async function submitPendingGooglePreference(
  idToken: string,
  input: {
    requestedRole?: UserRole | null;
    requestedClassId?: string | null;
    note?: string | null;
  }
): Promise<GoogleAccessRequest> {
  const res = await fetch('/api/auth/google-request-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ idToken, ...input }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    request?: GoogleAccessRequest;
    message?: string;
  };
  if (!res.ok || !data.request) {
    throw new Error(data.message || 'Gagal mengirim pengajuan peran ke Super Admin / Kepala Sekolah.');
  }
  return data.request;
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<
  | { ok: true; profile: SchoolUserProfile }
  | { ok: false; message: string }
> {
  const cleanEmail = email.trim();

  // 1. Primary: Built-in School Auth Server (/api/auth/login)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    if (res.ok) {
      const data = (await res.json()) as { token?: string; account?: SchoolAccountSummary };
      if (data.token && data.account) {
        setStoredAuthToken(data.token);
        return { ok: true, profile: accountToProfile(data.account) };
      }
    }

    if (res.status === 401) {
      const errBody = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      if (errBody.code !== 'not_found') {
        return {
          ok: false,
          message: errBody.message || 'Email atau kata sandi tidak sesuai.',
        };
      }
    }
  } catch {
    // Fall through to Supabase Auth if /api/auth/login is unavailable
  }

  // 2. Secondary: Supabase Auth (for external Supabase Auth accounts if configured)
  try {
    const supabase = await getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user) {
      return {
        ok: false,
        message: formatSafeAuthError(error?.message),
      };
    }

    const profileRes = await fetchOwnVerifiedProfile(
      data.user.id,
      data.user.email ?? cleanEmail
    );
    if (profileRes.status !== 'valid') {
      await supabase.auth.signOut().catch(() => {});
      return { ok: false, message: profileRes.message };
    }

    if (data.session?.access_token) {
      setStoredAuthToken(data.session.access_token);
    }
    return { ok: true, profile: profileRes.profile };
  } catch {
    return {
      ok: false,
      message: 'Email atau kata sandi tidak sesuai.',
    };
  }
}

export async function restoreActiveSession(): Promise<SchoolUserProfile | null> {
  const token = getStoredAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { account?: SchoolAccountSummary };
        if (data.account) {
          return accountToProfile(data.account);
        }
      }
      if (res.status === 401) {
        setStoredAuthToken(null);
      }
    } catch {
      // Check Supabase below
    }
  }

  try {
    const supabase = await getBrowserSupabaseClient();
    const { data: sessionData, error } = await supabase.auth.getSession();
    if (error || !sessionData.session?.user) {
      return null;
    }
    const profileRes = await fetchOwnVerifiedProfile(
      sessionData.session.user.id,
      sessionData.session.user.email ?? ''
    );
    if (profileRes.status === 'valid') {
      if (sessionData.session.access_token) {
        setStoredAuthToken(sessionData.session.access_token);
      }
      return profileRes.profile;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchOwnVerifiedProfile(
  userId: string,
  userEmail: string
): Promise<ProfileResolutionResult> {
  try {
    const supabase = await getBrowserSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return {
        status: 'error',
        message:
          'Profil akun tidak dapat dimuat dari database sekolah. Pastikan kebijakan akses profil Anda aktif.',
      };
    }

    if (!data) {
      return {
        status: 'missing_profile',
        message: 'Akun ini belum memiliki profil sekolah pada tabel profiles.',
      };
    }

    if (data.is_active !== true) {
      return {
        status: 'inactive',
        message: 'Akun Anda berstatus nonaktif. Akses aplikasi ditolak.',
      };
    }

    if (!isKnownDbRole(data.role)) {
      return {
        status: 'unknown_role',
        message: 'Role profil pada database tidak dikenal. Akses aplikasi ditolak.',
      };
    }

    const fullName =
      typeof data.full_name === 'string' && data.full_name.trim()
        ? data.full_name.trim()
        : 'Pengguna Sekolah';

    return {
      status: 'valid',
      profile: {
        id: String(data.id),
        email: userEmail,
        fullName,
        role: data.role,
        appRole: ROLE_MAPPING[data.role],
        assignedClassId: null,
        assignedClassName: null,
        isActive: true,
        authSource: 'supabase',
      },
    };
  } catch {
    return {
      status: 'error',
      message: 'Terjadi gangguan saat memeriksa profil akun sekolah.',
    };
  }
}

export async function signOutSchoolAccount(): Promise<void> {
  setStoredAuthToken(null);
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  await signOutFirebaseAuth();
  try {
    const supabase = await getBrowserSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore if Supabase not initialized
  }
}

function authHeaders(): Record<string, string> {
  const token = getStoredAuthToken();
  return token
    ? {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      }
    : {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: data.message || 'Gagal memperbarui kata sandi.' };
  }
  return { ok: true };
}

export async function listSchoolAccounts(): Promise<SchoolAccountSummary[]> {
  const res = await fetch('/api/auth/accounts', {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'Gagal memuat daftar akun email.');
  }
  const data = (await res.json()) as { accounts: SchoolAccountSummary[] };
  return data.accounts ?? [];
}

export async function createSchoolAccount(input: {
  email: string;
  fullName: string;
  role: UserRole;
  assignedClassId: string | null;
  password?: string;
  authProvider?: AuthProviderKind;
}): Promise<SchoolAccountSummary> {
  const res = await fetch('/api/auth/accounts', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as {
    account?: SchoolAccountSummary;
    message?: string;
  };
  if (!res.ok || !data.account) {
    throw new Error(data.message || 'Gagal menambahkan akun email.');
  }
  return data.account;
}

export async function updateSchoolAccount(
  accountId: string,
  patch: {
    email?: string;
    fullName?: string;
    role?: UserRole;
    assignedClassId?: string | null;
    isActive?: boolean;
    newPassword?: string;
    authProvider?: AuthProviderKind;
  }
): Promise<SchoolAccountSummary> {
  const res = await fetch(`/api/auth/accounts/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const data = (await res.json().catch(() => ({}))) as {
    account?: SchoolAccountSummary;
    message?: string;
  };
  if (!res.ok || !data.account) {
    throw new Error(data.message || 'Gagal memperbarui akun email.');
  }
  return data.account;
}

export async function deleteSchoolAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/auth/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'Gagal menghapus akun email.');
  }
}

export async function listGoogleAccessRequests(): Promise<GoogleAccessRequest[]> {
  const res = await fetch('/api/auth/google-requests', {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'Gagal memuat antrean izin Google.');
  }
  const data = (await res.json()) as { requests: GoogleAccessRequest[] };
  return data.requests ?? [];
}

export async function approveGoogleAccessRequest(
  requestId: string,
  input: {
    role: UserRole;
    assignedClassId: string | null;
    fullName?: string;
  }
): Promise<{ account: SchoolAccountSummary; request: GoogleAccessRequest }> {
  const res = await fetch(
    `/api/auth/google-requests/${encodeURIComponent(requestId)}/approve`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(input),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    account?: SchoolAccountSummary;
    request?: GoogleAccessRequest;
    message?: string;
  };
  if (!res.ok || !data.account || !data.request) {
    throw new Error(data.message || 'Gagal menyetujui permintaan izin Google.');
  }
  return { account: data.account, request: data.request };
}

export async function rejectGoogleAccessRequest(
  requestId: string
): Promise<GoogleAccessRequest> {
  const res = await fetch(
    `/api/auth/google-requests/${encodeURIComponent(requestId)}/reject`,
    {
      method: 'POST',
      headers: authHeaders(),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    request?: GoogleAccessRequest;
    message?: string;
  };
  if (!res.ok || !data.request) {
    throw new Error(data.message || 'Gagal menolak permintaan izin Google.');
  }
  return data.request;
}

export async function deleteGoogleAccessRequest(requestId: string): Promise<void> {
  const res = await fetch(`/api/auth/google-requests/${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'Gagal menghapus riwayat permintaan Google.');
  }
}
