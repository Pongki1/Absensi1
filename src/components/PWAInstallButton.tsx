import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'primary' | 'sidebar' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'primary' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === 'sidebar'
            ? 'w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 min-h-[40px]'
            : variant === 'compact'
              ? 'flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 min-h-[40px]'
              : 'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 min-h-[44px]'
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  // iOS Safari or browsers where native prompt hasn't fired yet: offer guided install modal
  if (isIOS || variant === 'sidebar') {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={
            variant === 'sidebar'
              ? 'w-full flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 min-h-[40px]'
              : 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 min-h-[40px]'
          }
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>{isIOS ? 'Pasang di iOS' : 'Panduan Instal PWA'}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Pasang SmartAbsen di Layar Utama
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Aplikasi dapat dijalankan seperti aplikasi Android/iOS native.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Tutup panduan"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-700">
                {isIOS ? (
                  <>
                    <p>1. Ketuk tombol <strong>Bagikan (Share)</strong> di bilah Safari.</p>
                    <p>2. Gulir ke bawah dan pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.</p>
                    <p>3. Ketuk <strong>Tambah</strong> di pojok kanan atas.</p>
                  </>
                ) : (
                  <>
                    <p>1. Buka menu browser Chrome Android (ikon tiga titik di kanan atas).</p>
                    <p>2. Pilih <strong>Tambahkan ke layar utama</strong> atau <strong>Instal aplikasi</strong>.</p>
                    <p>3. Konfirmasi pemasangan agar ikon SmartAbsen muncul di layar ponsel.</p>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
