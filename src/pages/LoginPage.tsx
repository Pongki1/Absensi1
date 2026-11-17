import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { DEFAULT_CLASSES } from '../data/schoolData';
import type { GoogleAccessRequest, UserRole } from '../types/attendance';
import {
  checkGoogleApprovalStatus,
  submitPendingGooglePreference,
  type GoogleSignInOutcome,
  type SchoolUserProfile,
} from '../services/authService';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onGoogleSignIn: () => Promise<GoogleSignInOutcome>;
  onGoogleApproved?: (profile: SchoolUserProfile) => void;
  initialError?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSignIn,
  onGoogleSignIn,
  onGoogleApproved,
  initialError = null,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);

  // Pending Google authorization state
  const [pendingGoogle, setPendingGoogle] = useState<{
    idToken: string;
    request: GoogleAccessRequest;
  } | null>(null);
  const [reqRole, setReqRole] = useState<UserRole>('Guru Kelas');
  const [reqClassId, setReqClassId] = useState<string>(DEFAULT_CLASSES[0]?.id ?? '');
  const [reqNote, setReqNote] = useState('');
  const [reqNotice, setReqNotice] = useState<string | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);

  const displayError = errorMessage || initialError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Mohon masukkan email dan kata sandi akun sekolah Anda.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const err = await onSignIn(email.trim(), password);
    setPassword('');
    setSubmitting(false);

    if (err) {
      setErrorMessage(err);
    }
  };

  const handleGoogleButtonClick = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    setReqNotice(null);

    const outcome = await onGoogleSignIn();
    setGoogleLoading(false);

    if (outcome.status === 'approved') {
      return;
    }

    if (outcome.status === 'pending_approval') {
      setPendingGoogle({ idToken: outcome.idToken, request: outcome.request });
      setReqRole(outcome.request.requestedRole ?? 'Guru Kelas');
      setReqClassId(outcome.request.requestedClassId ?? DEFAULT_CLASSES[0]?.id ?? '');
      setReqNote(outcome.request.note ?? '');
      return;
    }

    setErrorMessage(outcome.message);
  };

  const handleSavePreference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogle) return;
    setSavingPreference(true);
    setReqNotice(null);
    setErrorMessage(null);

    try {
      const updated = await submitPendingGooglePreference(pendingGoogle.idToken, {
        requestedRole: reqRole,
        requestedClassId: reqRole === 'Guru Kelas' ? reqClassId : null,
        note: reqNote,
      });
      setPendingGoogle({ ...pendingGoogle, request: updated });
      setReqNotice(
        'Pengajuan peran & kelas berhasil dikirim ke Super Admin dan Kepala Sekolah.'
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal mengirim pengajuan peran.'
      );
    } finally {
      setSavingPreference(false);
    }
  };

  const handleCheckApproval = async () => {
    if (!pendingGoogle) return;
    setCheckingApproval(true);
    setReqNotice(null);
    setErrorMessage(null);

    const outcome = await checkGoogleApprovalStatus(pendingGoogle.idToken);
    setCheckingApproval(false);

    if (outcome.status === 'approved') {
      if (onGoogleApproved) {
        onGoogleApproved(outcome.profile);
      } else {
        window.location.reload();
      }
      return;
    }

    if (outcome.status === 'pending_approval') {
      setPendingGoogle({ idToken: outcome.idToken, request: outcome.request });
      setReqNotice(
        'Masih menunggu persetujuan Super Admin / Kepala Sekolah. Silakan hubungi Kepala Sekolah atau Operator Sekolah.'
      );
      return;
    }

    setPendingGoogle(null);
    setErrorMessage(outcome.message);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-5">
        {/* Main Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3.5">
              <img
                src="/assets/aistudio/logo_TKIT_1e974d49.png"
                alt="Logo TKIT AL-I'ANAH"
                className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-contain p-1 shrink-0"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  SMART ABSENSI TKIT AL-I&apos;ANAH
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Portal Login Akun Google Guru, Guru Piket, Guru Kelas, Kepala Sekolah &amp; Super Admin
                </p>
              </div>
            </div>
            <PWAInstallButton variant="primary" />
          </div>

          {displayError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm text-rose-800"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {pendingGoogle ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  {pendingGoogle.request.photoUrl ? (
                    <img
                      src={pendingGoogle.request.photoUrl}
                      alt={pendingGoogle.request.fullName}
                      className="h-11 w-11 rounded-full border border-amber-200 object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-amber-800">
                      Menunggu Otorisasi Izin Super Admin / Kepala Sekolah
                    </p>
                    <h2 className="text-base font-bold text-slate-900 truncate mt-0.5">
                      {pendingGoogle.request.fullName}
                    </h2>
                    <p className="text-xs font-mono text-slate-700 truncate">
                      {pendingGoogle.request.email}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Akun Google Anda sudah tercatat di server pusat sekolah. Agar dapat masuk,{' '}
                  <strong>Super Admin</strong> atau <strong>Kepala Sekolah</strong> perlu menyetujui akun Anda dan menentukan peran (Guru Piket / Guru Kelas).
                </p>
              </div>

              {reqNotice && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{reqNotice}</span>
                </div>
              )}

              <form
                onSubmit={(e) => void handleSavePreference(e)}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
              >
                <p className="text-xs font-semibold text-slate-800">
                  Ajukan Tugas / Kelas Anda (Opsional — Memudahkan Persetujuan):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Peran yang Diajukan
                    </label>
                    <select
                      value={reqRole}
                      onChange={(e) => setReqRole(e.target.value as UserRole)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 min-h-[40px]"
                    >
                      <option value="Guru Kelas">Guru Kelas (Wali Kelas)</option>
                      <option value="Guru Piket">Guru Piket (Gerbang Masuk &amp; Pulang)</option>
                      <option value="Kepala Sekolah">Kepala Sekolah</option>
                    </select>
                  </div>

                  {reqRole === 'Guru Kelas' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kelas Binaan
                      </label>
                      <select
                        value={reqClassId}
                        onChange={(e) => setReqClassId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 min-h-[40px]"
                      >
                        {DEFAULT_CLASSES.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.namaKelas}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Catatan Singkat
                  </label>
                  <input
                    type="text"
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    placeholder="Contoh: Wali Kelas TK A atau Guru Piket Senin-Rabu"
                    maxLength={140}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 min-h-[40px]"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={savingPreference}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 min-h-[40px]"
                  >
                    <span>{savingPreference ? 'Mengirim...' : 'Kirim Pengajuan Peran'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={checkingApproval}
                    onClick={() => void handleCheckApproval()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 min-h-[40px]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingApproval ? 'animate-spin' : ''}`} />
                    <span>{checkingApproval ? 'Memeriksa...' : 'Cek Status Izin Sekarang'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingGoogle(null);
                      setReqNotice(null);
                      setErrorMessage(null);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[40px]"
                  >
                    Gunakan Akun Lain
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Google Sign-In for Each Teacher / Staff */}
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  disabled={googleLoading || submitting}
                  onClick={() => void handleGoogleButtonClick()}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 transition-colors shadow-xs min-h-[48px]"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {googleLoading
                      ? 'Menghubungkan ke Akun Google...'
                      : 'Masuk dengan Akun Google Guru / Pimpinan'}
                  </span>
                </button>
                <p className="text-[11px] text-center text-slate-500 leading-relaxed">
                  Guru dapat masuk menggunakan akun Google masing-masing. Akses akan aktif setelah diberi otoritas izin oleh Super Admin atau Kepala Sekolah.
                </p>
              </div>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-semibold text-slate-400">
                  atau login dengan email &amp; sandi
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Email + Password Login Form */}
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Masukkan alamat email akun"
                      disabled={submitting || googleLoading}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 min-h-[46px]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi akun"
                      disabled={submitting || googleLoading}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 min-h-[46px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || googleLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors min-h-[48px]"
                >
                  <span>{submitting ? 'Memverifikasi Akun...' : 'Login'}</span>
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </>
          )}

          {/* Security Info Strip */}
          <div className="mt-5 pt-5 border-t border-slate-100 flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">
                Terhubung ke 1 Server Storage Pusat Sekolah
              </p>
              <p className="mt-0.5">
                Seluruh absensi Gerbang Masuk/Pulang (Guru Piket) dan Absensi Kelas (Guru Kelas) tersinkron langsung ke akun Kepala Sekolah &amp; Super Admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
