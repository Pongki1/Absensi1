import React from 'react';
import { KeyRound, LogOut, Printer, ShieldCheck, Wifi } from 'lucide-react';
import type { PageId } from '../types/attendance';
import type { SchoolUserProfile } from '../services/authService';

export const PAGE_TITLES: Record<PageId, string> = {
  login: 'Login',
  dashboard: 'Dashboard',
  siswa: 'Data Siswa',
  guru: 'Data Guru & Kepala Sekolah',
  'orang-tua': 'Data Orang Tua',
  kelas: 'Data Kelas',
  'absensi-gerbang-masuk': 'Absensi Gerbang Masuk',
  'absensi-kelas': 'Absensi Kelas',
  'absensi-gerbang-pulang': 'Absensi Gerbang Pulang',
  'rekap-absensi': 'Rekap Absensi',
  pengaturan: 'Pengaturan & Otorisasi',
};

interface TopBarProps {
  activePage: PageId;
  verifiedProfile: SchoolUserProfile;
  canPrintNametags: boolean;
  liveSyncConnected?: boolean;
  lastSyncedAt?: string | null;
  onOpenPrintAll: () => void;
  onOpenChangePassword?: () => void;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  verifiedProfile,
  canPrintNametags,
  liveSyncConnected = false,
  lastSyncedAt = null,
  onOpenPrintAll,
  onOpenChangePassword,
  onLogout,
}) => {
  const canChangePassword =
    verifiedProfile.authSource === 'school_server' &&
    verifiedProfile.authProvider !== 'google';

  return (
    <header className="no-print hidden lg:flex items-center justify-between gap-6 border-b border-slate-200 bg-white px-6 py-3.5 sticky top-0 z-30">
      {/* Zone 1: Page Context Breadcrumb + Live Server Sync Indicator */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-400 whitespace-nowrap">
            TKIT AL-I&apos;ANAH
          </span>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <h1 className="text-base font-semibold text-slate-900 truncate">
            {PAGE_TITLES[activePage]}
          </h1>
        </div>

        <div
          title={
            lastSyncedAt
              ? `Terhubung 1 Server Storage · Sinkron terakhir ${lastSyncedAt}`
              : 'Terhubung 1 Server Storage'
          }
          className={`hidden xl:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
            liveSyncConnected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          <Wifi className={`w-3 h-3 ${liveSyncConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span>{liveSyncConnected ? '1 Server · Live Sync' : '1 Server Storage'}</span>
        </div>
      </div>

      {/* Zone 2 & 3: Verified Profile Summary, Primary Action & Account Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
          {verifiedProfile.photoUrl ? (
            <img
              src={verifiedProfile.photoUrl}
              alt={verifiedProfile.fullName}
              className="w-4 h-4 rounded-full object-cover shrink-0"
            />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          )}
          <span className="font-semibold text-slate-900">{verifiedProfile.fullName}</span>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-blue-700">{verifiedProfile.appRole}</span>
          {verifiedProfile.assignedClassName && (
            <>
              <span className="text-slate-300">·</span>
              <span className="font-medium text-slate-700">{verifiedProfile.assignedClassName}</span>
            </>
          )}
        </div>

        {canPrintNametags && (
          <button
            type="button"
            onClick={onOpenPrintAll}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Kartu QR</span>
          </button>
        )}

        {canChangePassword && onOpenChangePassword && (
          <button
            type="button"
            onClick={onOpenChangePassword}
            title="Ubah kata sandi akun"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Ubah Sandi</span>
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-rose-700 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>
    </header>
  );
};
