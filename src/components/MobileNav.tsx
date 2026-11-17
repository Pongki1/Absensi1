import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  DoorOpen,
  ClipboardCheck,
  Users,
  Menu,
  X,
  Printer,
  LogOut,
  FileBarChart2,
  KeyRound,
} from 'lucide-react';
import type { PageId } from '../types/attendance';
import type { SchoolUserProfile } from '../services/authService';
import { NAV_GROUPS } from './Sidebar';
import { PAGE_TITLES } from './TopBar';
import { PWAInstallButton } from './PWAInstallButton';

interface MobileNavProps {
  activePage: PageId;
  verifiedProfile: SchoolUserProfile;
  canPrintNametags: boolean;
  allowedPages: PageId[];
  pendingGoogleCount?: number;
  onNavigate: (page: PageId) => void;
  onOpenPrintAll: () => void;
  onOpenChangePassword?: () => void;
  onLogout: () => void;
}

const ALL_BOTTOM_CANDIDATES: {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
  { id: 'absensi-gerbang-masuk', label: 'Masuk', icon: DoorOpen },
  { id: 'absensi-gerbang-pulang', label: 'Pulang', icon: LogOut },
  { id: 'absensi-kelas', label: 'Kelas', icon: ClipboardCheck },
  { id: 'rekap-absensi', label: 'Rekap', icon: FileBarChart2 },
  { id: 'siswa', label: 'Siswa', icon: Users },
];

export const MobileNav: React.FC<MobileNavProps> = ({
  activePage,
  verifiedProfile,
  canPrintNametags,
  allowedPages,
  pendingGoogleCount = 0,
  onNavigate,
  onOpenPrintAll,
  onOpenChangePassword,
  onLogout,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleBottomTabs = useMemo(() => {
    return ALL_BOTTOM_CANDIDATES.filter((tab) => allowedPages.includes(tab.id)).slice(0, 4);
  }, [allowedPages]);

  const handleSelectPage = (page: PageId) => {
    onNavigate(page);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Compact Mobile Top Bar (52px) */}
      <header className="no-print lg:hidden sticky top-0 z-30 h-[52px] flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/assets/aistudio/logo_TKIT_1e974d49.png"
            alt="Logo TKIT AL-I'ANAH"
            className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-contain p-0.5 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {PAGE_TITLES[activePage]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu navigasi"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Fixed Bottom Tab Bar (58px + safe area) */}
      <nav
        aria-label="Navigasi Bawah Smartphone"
        className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe"
      >
        <div
          className="grid h-[58px] items-center"
          style={{ gridTemplateColumns: `repeat(${visibleBottomTabs.length + 1}, minmax(0, 1fr))` }}
        >
          {visibleBottomTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activePage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectPage(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 h-full min-h-[44px] transition-colors ${
                  active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 h-full min-h-[44px] transition-colors ${
              drawerOpen ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
              Menu
            </span>
          </button>
        </div>
      </nav>

      {/* Menu Bottom Sheet Drawer */}
      {drawerOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-xs">
          <div
            className="flex-1"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="max-h-[85vh] flex flex-col rounded-t-3xl bg-white shadow-2xl border-t border-slate-200">
            <div className="pt-3 pb-2 px-5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/assets/aistudio/logo_TKIT_1e974d49.png"
                  alt="Logo TKIT AL-I'ANAH"
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-contain p-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">SMART ABSENSI TKIT AL-I&apos;ANAH</p>
                  <p className="text-xs text-slate-500 truncate">
                    {verifiedProfile.fullName} ·{' '}
                    <span className="font-mono text-blue-700">{verifiedProfile.appRole}</span>
                    {verifiedProfile.assignedClassName ? ` · ${verifiedProfile.assignedClassName}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Verified Profile Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {verifiedProfile.fullName}
                  </p>
                  <p className="text-[11px] font-mono text-blue-700 truncate">
                    {verifiedProfile.appRole}
                    {verifiedProfile.assignedClassName ? ` · ${verifiedProfile.assignedClassName}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {verifiedProfile.authSource === 'school_server' &&
                    verifiedProfile.authProvider !== 'google' &&
                    onOpenChangePassword && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        onOpenChangePassword();
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 min-h-[38px]"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Ubah Sandi</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      onLogout();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 min-h-[38px]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>

              {canPrintNametags && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenPrintAll();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 min-h-[44px]"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Kartu Nametag QR</span>
                </button>
              )}

              {/* Permitted Pages Only */}
              {NAV_GROUPS.map((group) => {
                const visibleItems = group.items.filter((item) =>
                  allowedPages.includes(item.id)
                );
                if (visibleItems.length === 0) return null;

                return (
                  <div key={group.label}>
                    <p className="px-2 mb-1.5 text-[11px] font-semibold text-slate-400">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activePage === item.id;
                        const itemTitle =
                          item.id === 'pengaturan' && verifiedProfile.appRole === 'Kepala Sekolah'
                            ? 'Otorisasi Akun'
                            : item.title;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectPage(item.id)}
                            className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm min-h-[44px] transition-colors ${
                              isActive
                                ? 'bg-blue-50 font-semibold text-blue-700'
                                : 'font-medium text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-3 min-w-0">
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
