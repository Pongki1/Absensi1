import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Mail,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Wifi,
  X,
} from 'lucide-react';
import type {
  AuthProviderKind,
  ClassRoomRecord,
  GoogleAccessRequest,
  SchoolAccountSummary,
  SchoolSettings,
  UserRole,
} from '../types/attendance';
import {
  approveGoogleAccessRequest,
  createSchoolAccount,
  deleteGoogleAccessRequest,
  deleteSchoolAccount,
  getStoredAuthToken,
  listGoogleAccessRequests,
  listSchoolAccounts,
  rejectGoogleAccessRequest,
  updateSchoolAccount,
} from '../services/authService';
import { PageBanner } from '../components/PageBanner';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsPageProps {
  settings: SchoolSettings;
  classes: ClassRoomRecord[];
  currentUserId: string;
  currentUserRole: UserRole;
  canImportMaster?: boolean;
  canManageAccounts?: boolean;
  canEditSystemSettings?: boolean;
  accountsSyncTick?: number;
  liveSyncConnected?: boolean;
  studentCount?: number;
  teacherCount?: number;
  logCount?: number;
  onSaveSettings: (nextSettings: SchoolSettings) => void;
  onOpenMasterImport?: () => void;
  onResetAttendance?: () => void;
  onClearMasterData?: () => void;
  onAccountsChanged?: () => void;
}

const BASE_ASSIGNABLE_ROLES: UserRole[] = [
  'Guru Piket',
  'Guru Kelas',
  'Kepala Sekolah',
  'Admin Sekolah',
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  classes,
  currentUserId,
  currentUserRole,
  canImportMaster = false,
  canManageAccounts = false,
  canEditSystemSettings = false,
  accountsSyncTick = 0,
  liveSyncConnected = false,
  studentCount = 0,
  teacherCount = 0,
  logCount = 0,
  onSaveSettings,
  onOpenMasterImport,
  onResetAttendance,
  onClearMasterData,
  onAccountsChanged,
}) => {
  const isOnline = useOnlineStatus();
  const { isInstalled } = usePWAInstall();
  const [sourceDownloadAvailable, setSourceDownloadAvailable] = useState(false);
  const [downloadingSource, setDownloadingSource] = useState(false);
  const [sourceDownloadError, setSourceDownloadError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<'attendance' | 'clear_all' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSuperAdmin = currentUserRole === 'Super Admin';
  const assignableRoles: UserRole[] = isSuperAdmin
    ? [...BASE_ASSIGNABLE_ROLES, 'Super Admin']
    : BASE_ASSIGNABLE_ROLES;

  // School settings editable state
  const [formSettings, setFormSettings] = useState<SchoolSettings>(settings);

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  // Authorized accounts & Google access requests
  const [accounts, setAccounts] = useState<SchoolAccountSummary[]>([]);
  const [requests, setRequests] = useState<GoogleAccessRequest[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'Semua' | UserRole>('Semua');

  // Per-request role/class selection state
  const [requestDrafts, setRequestDrafts] = useState<
    Record<string, { role: UserRole; classId: string }>
  >({});
  const [reviewingReqId, setReviewingReqId] = useState<string | null>(null);

  // Add/Edit account modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SchoolAccountSummary | null>(null);
  const [accEmail, setAccEmail] = useState('');
  const [accName, setAccName] = useState('');
  const [accRole, setAccRole] = useState<UserRole>('Guru Kelas');
  const [accClassId, setAccClassId] = useState<string>(classes[0]?.id ?? '');
  const [accProvider, setAccProvider] = useState<AuthProviderKind>('google');
  const [accPassword, setAccPassword] = useState('');
  const [accActive, setAccActive] = useState(true);
  const [accSaving, setAccSaving] = useState(false);
  const [accFormError, setAccFormError] = useState<string | null>(null);

  const fetchAuthorizationData = useCallback(async () => {
    if (!canManageAccounts) return;
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const [accList, reqList] = await Promise.all([
        listSchoolAccounts(),
        listGoogleAccessRequests(),
      ]);
      setAccounts(accList);
      setRequests(reqList);
      setRequestDrafts((prev) => {
        const next = { ...prev };
        for (const r of reqList) {
          if (!next[r.id]) {
            next[r.id] = {
              role: r.requestedRole ?? 'Guru Kelas',
              classId: r.requestedClassId || classes[0]?.id || '',
            };
          }
        }
        return next;
      });
    } catch (err) {
      setAccountsError(
        err instanceof Error ? err.message : 'Gagal memuat daftar otorisasi pengguna.'
      );
    } finally {
      setAccountsLoading(false);
    }
  }, [canManageAccounts, classes]);

  useEffect(() => {
    void fetchAuthorizationData();
  }, [fetchAuthorizationData, accountsSyncTick]);

  useEffect(() => {
    if (!canManageAccounts) {
      setSourceDownloadAvailable(false);
      return;
    }
    const token = getStoredAuthToken();
    if (!token) {
      setSourceDownloadAvailable(false);
      return;
    }

    let active = true;
    fetch('/api/download-source', {
      method: 'HEAD',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => {
        if (active) setSourceDownloadAvailable(res.ok);
      })
      .catch(() => {
        if (active) setSourceDownloadAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [canManageAccounts]);

  const handleDownloadSource = async () => {
    if (!canManageAccounts) return;
    const token = getStoredAuthToken();
    if (!token) {
      setSourceDownloadError('Sesi tidak ditemukan. Silakan masuk ulang sebagai Super Admin atau Kepala Sekolah.');
      return;
    }

    setDownloadingSource(true);
    setSourceDownloadError(null);
    try {
      const res = await fetch('/api/download-source', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message || 'Gagal mengunduh paket source code.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'smart-absensi-tkit-source.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setSourceDownloadError(
        err instanceof Error ? err.message : 'Gagal mengunduh paket source code.'
      );
    } finally {
      setDownloadingSource(false);
    }
  };

  const handleSaveSchoolSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formSettings);
    setNotice('Profil sekolah dan jam operasional berhasil disimpan ke server pusat.');
  };

  const openCreateAccount = (
    presetRole: UserRole = 'Guru Kelas',
    presetProvider: AuthProviderKind = 'google'
  ) => {
    setEditingAccount(null);
    setAccEmail('');
    setAccName('');
    setAccRole(presetRole);
    setAccClassId(classes[0]?.id ?? '');
    setAccProvider(presetProvider);
    setAccPassword('');
    setAccActive(true);
    setAccFormError(null);
    setAccountModalOpen(true);
  };

  const openEditAccount = (acc: SchoolAccountSummary) => {
    setEditingAccount(acc);
    setAccEmail(acc.email);
    setAccName(acc.fullName);
    setAccRole(acc.role);
    setAccClassId(acc.assignedClassId || classes[0]?.id || '');
    setAccProvider(acc.authProvider ?? 'both');
    setAccPassword('');
    setAccActive(acc.isActive);
    setAccFormError(null);
    setAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccFormError(null);
    setAccSaving(true);

    try {
      if (editingAccount) {
        const updated = await updateSchoolAccount(editingAccount.id, {
          email: accEmail.trim(),
          fullName: accName.trim(),
          role: accRole,
          assignedClassId: accRole === 'Guru Kelas' ? accClassId : null,
          isActive: accActive,
          authProvider: accProvider,
          newPassword: accPassword.trim() ? accPassword : undefined,
        });
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setNotice(`Otorisasi akun ${updated.email} berhasil diperbarui.`);
      } else {
        const created = await createSchoolAccount({
          email: accEmail.trim(),
          fullName: accName.trim(),
          role: accRole,
          assignedClassId: accRole === 'Guru Kelas' ? accClassId : null,
          authProvider: accProvider,
          password: accProvider === 'google' ? undefined : accPassword,
        });
        setAccounts((prev) => [...prev, created]);
        setNotice(
          `Akun ${created.email} (${created.role}) telah diberi izin akses ke sistem.`
        );
      }
      setAccountModalOpen(false);
      onAccountsChanged?.();
    } catch (err) {
      setAccFormError(err instanceof Error ? err.message : 'Gagal menyimpan otorisasi akun.');
    } finally {
      setAccSaving(false);
    }
  };

  const handleToggleAccountActive = async (acc: SchoolAccountSummary) => {
    try {
      const updated = await updateSchoolAccount(acc.id, { isActive: !acc.isActive });
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setNotice(
        `Izin akses ${updated.email} kini berstatus ${updated.isActive ? 'Aktif' : 'Nonaktif'}.`
      );
      onAccountsChanged?.();
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Gagal memperbarui status izin.');
    }
  };

  const handleDeleteAccount = async (acc: SchoolAccountSummary) => {
    try {
      await deleteSchoolAccount(acc.id);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
      setNotice(`Akun ${acc.email} telah dihapus dari daftar izin.`);
      onAccountsChanged?.();
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Gagal menghapus akun.');
    }
  };

  const handleApproveRequest = async (reqItem: GoogleAccessRequest) => {
    const draft = requestDrafts[reqItem.id] ?? {
      role: reqItem.requestedRole ?? 'Guru Kelas',
      classId: reqItem.requestedClassId || classes[0]?.id || '',
    };
    setReviewingReqId(reqItem.id);
    setAccountsError(null);
    try {
      const { account, request } = await approveGoogleAccessRequest(reqItem.id, {
        role: draft.role,
        assignedClassId: draft.role === 'Guru Kelas' ? draft.classId : null,
      });
      setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
      setAccounts((prev) => {
        const exists = prev.some((a) => a.id === account.id);
        return exists
          ? prev.map((a) => (a.id === account.id ? account : a))
          : [...prev, account];
      });
      setNotice(
        `Akun Google ${account.email} disetujui sebagai ${account.role}${
          account.assignedClassName ? ` (${account.assignedClassName})` : ''
        }.`
      );
      onAccountsChanged?.();
    } catch (err) {
      setAccountsError(
        err instanceof Error ? err.message : 'Gagal menyetujui permintaan izin Google.'
      );
    } finally {
      setReviewingReqId(null);
    }
  };

  const handleRejectRequest = async (reqItem: GoogleAccessRequest) => {
    setReviewingReqId(reqItem.id);
    setAccountsError(null);
    try {
      const updated = await rejectGoogleAccessRequest(reqItem.id);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setNotice(`Permintaan akses Google dari ${reqItem.email} ditolak.`);
      onAccountsChanged?.();
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Gagal menolak permintaan.');
    } finally {
      setReviewingReqId(null);
    }
  };

  const handleClearRequest = async (requestId: string) => {
    try {
      await deleteGoogleAccessRequest(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      // Ignore
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const reviewedRequests = requests.filter((r) => r.status !== 'pending');
  const filteredAccounts = accounts.filter(
    (acc) => roleFilter === 'Semua' || acc.role === roleFilter
  );

  const renderProviderLabel = (acc: SchoolAccountSummary) => {
    const p = acc.authProvider ?? 'both';
    if (p === 'google') return 'Google Guru';
    if (p === 'password') return 'Email & Sandi';
    return 'Google + Sandi';
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageBanner
        title={
          canEditSystemSettings
            ? 'Pengaturan Sistem & Otorisasi Akun'
            : 'Otorisasi Pengguna & Sinkronisasi Server'
        }
        description="Super Admin dan Kepala Sekolah mengatur izin login Akun Google masing-masing guru (Guru Piket & Guru Kelas), memantau sinkronisasi 1 server storage pusat, serta konfigurasi sistem."
      />

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-md border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 1A. Antrean Persetujuan Login Akun Google Guru */}
      {canManageAccounts && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Permintaan Izin Login Akun Google Guru
                </h2>
                {pendingRequests.length > 0 && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 tabular-nums">
                    {pendingRequests.length} Menunggu
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Saat guru mencoba masuk dengan akun Google pribadi/sekolah yang belum terdaftar, permintaannya muncul di sini agar Super Admin atau Kepala Sekolah dapat memberikan peran resmi.
              </p>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="p-5 text-xs text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Tidak ada permintaan login Google yang menunggu persetujuan. Anda juga dapat mendaftarkan email Google guru terlebih dahulu pada tabel di bawah.
              </span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingRequests.map((reqItem) => {
                const draft = requestDrafts[reqItem.id] ?? {
                  role: reqItem.requestedRole ?? 'Guru Kelas',
                  classId: reqItem.requestedClassId || classes[0]?.id || '',
                };
                const isBusy = reviewingReqId === reqItem.id;

                return (
                  <div
                    key={reqItem.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-amber-50/30"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {reqItem.photoUrl ? (
                        <img
                          src={reqItem.photoUrl}
                          alt={reqItem.fullName}
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm shrink-0">
                          {reqItem.fullName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {reqItem.fullName}
                        </p>
                        <p className="text-xs font-mono text-blue-700 truncate">
                          {reqItem.email}
                        </p>
                        {reqItem.note && (
                          <p className="text-xs text-slate-600 mt-1">
                            Catatan guru: &ldquo;{reqItem.note}&rdquo;
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Permintaan terakhir:{' '}
                          {new Date(reqItem.lastAttemptAt).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        value={draft.role}
                        disabled={isBusy}
                        onChange={(e) => {
                          const nextRole = e.target.value as UserRole;
                          setRequestDrafts((prev) => ({
                            ...prev,
                            [reqItem.id]: { ...draft, role: nextRole },
                          }));
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 min-h-[38px]"
                      >
                        {assignableRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      {draft.role === 'Guru Kelas' && (
                        <select
                          value={draft.classId}
                          disabled={isBusy}
                          onChange={(e) => {
                            const nextClassId = e.target.value;
                            setRequestDrafts((prev) => ({
                              ...prev,
                              [reqItem.id]: { ...draft, classId: nextClassId },
                            }));
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 min-h-[38px]"
                        >
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.namaKelas}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleApproveRequest(reqItem)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 min-h-[38px]"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isBusy ? 'Memproses...' : 'Setujui Izin'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRejectRequest(reqItem)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 min-h-[38px]"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {reviewedRequests.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500">
                Riwayat Permintaan Terbaru ({reviewedRequests.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {reviewedRequests.slice(0, 6).map((r) => (
                  <div
                    key={r.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="font-mono text-slate-700">{r.email}</span>
                    <span
                      className={`font-semibold ${
                        r.status === 'approved' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {r.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleClearRequest(r.id)}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label={`Hapus riwayat ${r.email}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1B. Authorized Users & Pre-Authorized Google Accounts */}
      {canManageAccounts && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Daftar Akun Terotorisasi (Google Guru &amp; Email Sekolah)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftarkan email Google masing-masing Guru Piket atau Guru Kelas agar mereka dapat langsung masuk dengan tombol Google tanpa perlu menunggu antrean.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openCreateAccount('Guru Piket', 'google')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 min-h-[40px]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Beri Izin Guru Piket</span>
              </button>
              <button
                type="button"
                onClick={() => openCreateAccount('Guru Kelas', 'google')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 min-h-[40px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Beri Izin Guru Kelas</span>
              </button>
            </div>
          </div>

          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                ['Semua', 'Guru Piket', 'Guru Kelas', 'Kepala Sekolah', 'Admin Sekolah', 'Super Admin'] as const
              ).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    roleFilter === r
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              {filteredAccounts.length} akun terdaftar
            </span>
          </div>

          {accountsError && (
            <div className="m-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{accountsError}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">Nama Petugas / Guru</th>
                  <th className="py-3 px-4">Email Google / Sekolah</th>
                  <th className="py-3 px-4">Metode Login</th>
                  <th className="py-3 px-4">Peran &amp; Kelas</th>
                  <th className="py-3 px-4">Status Izin</th>
                  <th className="py-3 px-5 text-right">Kelola</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {accountsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Memuat daftar otorisasi akun...
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Tidak ada akun untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => {
                    const lockedForCurrent =
                      acc.role === 'Super Admin' && currentUserRole !== 'Super Admin';

                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2.5">
                            {acc.photoUrl ? (
                              <img
                                src={acc.photoUrl}
                                alt={acc.fullName}
                                className="h-7 w-7 rounded-full border border-slate-200 object-cover shrink-0"
                              />
                            ) : null}
                            <div>
                              <p className="font-semibold text-slate-900">{acc.fullName}</p>
                              {acc.approvedBy && (
                                <p className="text-[11px] text-slate-400">
                                  Otoritas: {acc.approvedBy}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-blue-700">{acc.email}</td>
                        <td className="py-3 px-4 text-slate-600">{renderProviderLabel(acc)}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{acc.role}</p>
                          <p className="text-[11px] text-slate-500">
                            {acc.assignedClassName || 'Semua (Sekolah)'}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            disabled={acc.id === currentUserId || lockedForCurrent}
                            onClick={() => void handleToggleAccountActive(acc)}
                            className={`font-semibold disabled:opacity-60 ${
                              acc.isActive
                                ? 'text-emerald-700 hover:underline'
                                : 'text-rose-700 hover:underline'
                            }`}
                          >
                            {acc.isActive ? 'Diizinkan' : 'Dinonaktifkan'}
                          </button>
                        </td>
                        <td className="py-3 px-5 text-right">
                          {lockedForCurrent ? (
                            <span className="text-[11px] text-slate-400">Terkunci (Super Admin)</span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditAccount(acc)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Ubah Izin</span>
                              </button>
                              {acc.id !== currentUserId && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAccount(acc)}
                                  aria-label={`Hapus akun ${acc.email}`}
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Editable School Settings & Operational Hours (Super Admin / Admin Sekolah) */}
      {canEditSystemSettings && (
        <form
          onSubmit={handleSaveSchoolSettings}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Profil Sekolah &amp; Jam Operasional
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengaturan batas keterlambatan digunakan otomatis pada pemindaian Gerbang Masuk.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 min-h-[40px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lembaga
              </label>
              <input
                type="text"
                value={formSettings.namaSekolah}
                onChange={(e) =>
                  setFormSettings((p) => ({ ...p, namaSekolah: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alamat Sekolah
              </label>
              <input
                type="text"
                value={formSettings.alamatSekolah}
                onChange={(e) =>
                  setFormSettings((p) => ({ ...p, alamatSekolah: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tahun Ajaran
              </label>
              <input
                type="text"
                value={formSettings.tahunAjaran}
                onChange={(e) =>
                  setFormSettings((p) => ({ ...p, tahunAjaran: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Semester Aktif
              </label>
              <select
                value={formSettings.semester}
                onChange={(e) =>
                  setFormSettings((p) => ({
                    ...p,
                    semester: e.target.value as 'Ganjil' | 'Genap',
                  }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[42px]"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Masuk TK
              </label>
              <input
                type="time"
                value={formSettings.jamMasukTK}
                onChange={(e) =>
                  setFormSettings((p) => ({ ...p, jamMasukTK: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Masuk SD
              </label>
              <input
                type="time"
                value={formSettings.jamMasukSD}
                onChange={(e) =>
                  setFormSettings((p) => ({ ...p, jamMasukSD: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Batas Terlambat
              </label>
              <input
                type="time"
                value={formSettings.batasTerlambat}
                onChange={(e) =>
                  setFormSettings((p) => ({ ...p, batasTerlambat: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Pulang TK
              </label>
              <input
                type="time"
                value={formSettings.jamPulangTK}
                onChange={(e) =>
                  setFormSettings((p) => ({ ...p, jamPulangTK: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Pulang SD
              </label>
              <input
                type="time"
                value={formSettings.jamPulangSD}
                onChange={(e) =>
                  setFormSettings((p) => ({ ...p, jamPulangSD: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
              />
            </div>
          </div>
        </form>
      )}

      {/* 3. Master Excel Import */}
      {canImportMaster && onOpenMasterImport && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">
              Import Massal Excel (Siswa, Guru &amp; Kepala Sekolah)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unduh template Excel Master berisi 3 sheet (<span className="font-mono">Siswa</span>,{' '}
              <span className="font-mono">Guru</span>, <span className="font-mono">Kepala_Sekolah</span>)
              lalu unggah sekaligus untuk mengisi data resmi sekolah dengan cepat.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenMasterImport}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Buka Import Excel Terpadu</span>
          </button>
        </div>
      )}

      {/* 4. Reset Attendance & Clear Master Data */}
      {canImportMaster && (onResetAttendance || onClearMasterData) && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Reset Kehadiran &amp; Pengosongan Data
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Saat ini tersimpan di server pusat:{' '}
              <strong className="font-mono text-slate-800">{studentCount}</strong> siswa ·{' '}
              <strong className="font-mono text-slate-800">{teacherCount}</strong> guru/kepsek ·{' '}
              <strong className="font-mono text-slate-800">{logCount}</strong> log absensi
            </p>
          </div>

          {confirmMode ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-rose-900">
                {confirmMode === 'attendance'
                  ? 'Reset semua status kehadiran siswa & guru kembali ke Belum Scan / Belum Absen dan hapus seluruh log absensi?'
                  : 'Hapus seluruh daftar siswa, guru, kepala sekolah, orang tua, dan log absensi agar dimulai dari 0?'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmMode === 'attendance') {
                      onResetAttendance?.();
                      setNotice('Semua kehadiran siswa dan guru berhasil direset ke awal.');
                    } else {
                      onClearMasterData?.();
                      setNotice('Seluruh data siswa, guru, kepala sekolah, dan log berhasil dikosongkan.');
                    }
                    setConfirmMode(null);
                  }}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 font-semibold text-white hover:bg-rose-700"
                >
                  Ya, Lanjutkan
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmMode(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {onResetAttendance && (
                <button
                  type="button"
                  onClick={() => setConfirmMode('attendance')}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors min-h-[40px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Kehadiran Hari Ini</span>
                </button>
              )}
              {onClearMasterData && (
                <button
                  type="button"
                  onClick={() => setConfirmMode('clear_all')}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors min-h-[40px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan Semua Data Input</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Status Integrasi 1 Server Storage & PWA */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Status Integrasi 1 Server Storage &amp; PWA
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Seluruh aktivitas Guru Piket, Guru Kelas, Kepala Sekolah, dan Super Admin tersimpan terpusat dan tersinkron langsung.
            </p>
          </div>
          <PWAInstallButton variant="primary" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900">Mode Pemasangan</p>
              <p className="text-slate-600">
                {isInstalled ? 'Terpasang (Standalone)' : 'Browser / Siap Pasang'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900">Konektivitas Live</p>
              <p className="text-slate-600">
                {isOnline
                  ? liveSyncConnected
                    ? 'Online · Stream Real-Time Aktif'
                    : 'Online · Tersinkron ke Server'
                  : 'Offline Lokal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900">Penyimpanan Terpusat</p>
              <p className="text-slate-600">1 Server Storage + Google OAuth</p>
            </div>
          </div>
        </div>
      </div>

      {/* Publish & Source Download */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Globe className="w-4 h-4 text-blue-600" />
            <span>Siap Publish &amp; Deploy</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Aplikasi terintegrasi dengan Google Login, otorisasi Super Admin &amp; Kepala Sekolah, serta penyimpanan terpusat server Node.js (`npm run build` &amp; `npm start`).
          </p>
        </div>

        {canManageAccounts && sourceDownloadAvailable && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Unduh Paket Source Code Lengkap (.zip)
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Khusus akun Super Admin, Admin Sekolah &amp; Kepala Sekolah. Tanpa Secrets maupun data runtime lokal.
              </p>
              {sourceDownloadError && (
                <p className="text-xs font-medium text-rose-700">{sourceDownloadError}</p>
              )}
            </div>
            <button
              type="button"
              disabled={downloadingSource}
              onClick={() => void handleDownloadSource()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors min-h-[40px]"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingSource ? 'Menyiapkan Arsip...' : 'Unduh Source (.zip)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Account Modal */}
      {accountModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  {editingAccount ? 'Ubah Otorisasi Akun' : 'Beri Izin Akun Baru'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveAccount(e)} className="p-5 space-y-4">
              {accFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {accFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Petugas / Guru *
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Contoh: Ustadzah Siti (Wali Kelas TK A)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[42px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Google / Email Sekolah *
                </label>
                <input
                  type="email"
                  required
                  value={accEmail}
                  onChange={(e) => setAccEmail(e.target.value)}
                  placeholder="namaguru@gmail.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Metode Masuk yang Diizinkan
                </label>
                <select
                  value={accProvider}
                  onChange={(e) => setAccProvider(e.target.value as AuthProviderKind)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[42px]"
                >
                  <option value="google">Akun Google Guru (Tanpa Kata Sandi)</option>
                  <option value="both">Akun Google + Kata Sandi Sekolah</option>
                  <option value="password">Email &amp; Kata Sandi Sekolah Saja</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peran Akun *
                  </label>
                  <select
                    value={accRole}
                    onChange={(e) => setAccRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[42px]"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {accRole === 'Guru Kelas' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kelas Binaan *
                    </label>
                    <select
                      value={accClassId}
                      onChange={(e) => setAccClassId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[42px]"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.namaKelas}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {accProvider !== 'google' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingAccount
                      ? 'Kata Sandi Baru (Kosongkan jika tidak diganti)'
                      : 'Kata Sandi Awal (Minimal 6 karakter) *'}
                  </label>
                  <input
                    type="password"
                    required={!editingAccount}
                    minLength={editingAccount && !accPassword ? undefined : 6}
                    value={accPassword}
                    onChange={(e) => setAccPassword(e.target.value)}
                    placeholder={editingAccount ? '••••••••' : 'Minimal 6 karakter'}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[42px]"
                  />
                </div>
              )}

              {editingAccount && editingAccount.id !== currentUserId && (
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accActive}
                    onChange={(e) => setAccActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>Akun aktif dan diizinkan masuk ke sistem</span>
                </label>
              )}

              <div className="pt-2 flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[42px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={accSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 min-h-[42px]"
                >
                  {accSaving ? 'Menyimpan...' : editingAccount ? 'Simpan Otorisasi' : 'Beri Izin Masuk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
