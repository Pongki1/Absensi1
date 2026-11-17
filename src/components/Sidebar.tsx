import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCheck,
  School,
  DoorOpen,
  ClipboardCheck,
  LogOut,
  FileBarChart2,
  Settings,
  KeyRound,
} from 'lucide-react';
import type { PageId } from '../types/attendance';
import type { SchoolUserProfile } from '../services/authService';
import { PWAInstallButton } from './PWAInstallButton';

interface NavGroup {
  label: string;
  items: { id: PageId; title: string; icon: React.ComponentType<{ className?: string }> }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Utama',
    items: [{ id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operasional Absensi',
    items: [
      { id: 'absensi-gerbang-masuk', title: 'Absensi Gerbang Masuk', icon: DoorOpen },
      { id: 'absensi-kelas', title: 'Absensi Kelas', icon: ClipboardCheck },
      { id: 'absensi-gerbang-pulang', title: 'Absensi Gerbang Pulang', icon: LogOut },
      { id: 'rekap-absensi', title: 'Rekap Absensi', icon: FileBarChart2 },
    ],
  },
  {
    label: 'Data Master',
    items: [
      { id: 'siswa', title: 'Data Siswa', icon: Users },
      { id: 'guru', title: 'Data Guru & Kepsek', icon: GraduationCap },
      { id: 'orang-tua', title: 'Data Orang Tua', icon: UserCheck },
      { id: 'kelas', title: 'Data Kelas', icon: School },
    ],
  },
  {
    label: 'Sistem',
    items: [{ id: 'pengaturan', title: 'Pengaturan', icon: Settings }],
  },
];

interface SidebarProps {
  activePage: PageId;
  verifiedProfile: SchoolUserProfile;
  allowedPages: PageId[];
  pendingGoogleCount?: number;
  onNavigate: (page: PageId) => void;
  onOpenChangePassword?: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  verifiedProfile,
  allowedPages,
  pendingGoogleCount = 0,
  onNavigate,
  onOpenChangePassword,
  onLogout,
}) => {
  const canChangePassword =
    verifiedProfile.authSource === 'school_server' &&
    verifiedProfile.authProvider !== 'google';

  return (
    <aside className="no-print hidden lg:flex lg:w-[264px] lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <img
          src="/assets/aistudio/logo_TKIT_1e974d49.png"
          alt="Logo TKIT AL-I'ANAH"
          className="h-10 w-10 rounded-xl border border-slate-200 bg-white object-contain p-0.5 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-slate-900 truncate">
            SMART ABSENSI
          </p>
          <p className="text-xs font-medium text-blue-700 truncate">
            TKIT AL-I&apos;ANAH
          </p>
        </div>
      </div>

      {/* Navigation Links (Filtered to allowedPages for verified role) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Menu Utama">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => allowedPages.includes(item.id));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  const itemTitle =
                    item.id === 'pengaturan' && verifiedProfile.appRole === 'Kepala Sekolah'
                      ? 'Otorisasi Akun'
                      : item.title;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors min-h-[40px] ${
                          isActive
                            ? 'bg-blue-50 font-semibold text-blue-700'
                            : 'font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-blue-600' : 'text-slate-500'
                            }`}
                          />
                          <span className="truncate">{itemTitle}</span>
                        </span>
                        {item.id === 'pengaturan' && pendingGoogleCount > 0 && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 tabular-nums shrink-0">
                            {pendingGoogleCount}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Bottom Authenticated Profile, Password, Logout & PWA Box */}
      <div className="border-t border-slate-100 p-4 space-y-2.5 bg-slate-50/70">
        <div className="text-xs space-y-0.5">
          <p className="text-slate-500">Akun Terverifikasi</p>
          <p className="font-semibold text-slate-900 truncate">{verifiedProfile.fullName}</p>
          <p className="text-[11px] font-mono text-blue-700 truncate">
            {verifiedProfile.appRole}
            {verifiedProfile.assignedClassName ? ` · ${verifiedProfile.assignedClassName}` : ''}
          </p>
        </div>

        <div className="flex gap-2">
          {canChangePassword && onOpenChangePassword && (
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[38px]"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sandi</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-rose-700 transition-colors min-h-[38px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>

        <PWAInstallButton variant="sidebar" />
      </div>
    </aside>
  );
};
