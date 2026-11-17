import React from 'react';
import { Printer, X } from 'lucide-react';
import type { StudentRecord } from '../types/attendance';
import { QRCodeImage } from './QRCodeImage';

interface NametagPrintModalProps {
  students: StudentRecord[];
  title: string;
  onClose: () => void;
}

export const NametagPrintModal: React.FC<NametagPrintModalProps> = ({
  students,
  title,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 print:static print:bg-white">
      <div className="no-print flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
          <p className="text-xs text-slate-500 truncate">
            {students.length} Kartu Nametag QR Siswa · Siap cetak ukuran kartu lanyard A4
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap min-h-[40px]"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kartu</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau cetak"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors min-h-[40px] min-w-[40px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="print-only-area flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0">
        <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-5">
          {students.map((student) => {
            const isTK = student.jenjang === 'TK';
            return (
              <div
                key={student.id}
                className="nametag-card-print mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm print:shadow-none"
              >
                <div className="flex justify-center pt-2.5 pb-1 bg-blue-700">
                  <div className="h-2 w-12 rounded-full bg-blue-900/50 border border-blue-400/30" />
                </div>

                <div className="bg-blue-700 px-4 pb-4 pt-2 text-center text-white">
                  <div className="flex items-center justify-center gap-2">
                    <img
                      src="/assets/aistudio/logo_TKIT_1e974d49.png"
                      alt="Logo TKIT AL-I'ANAH"
                      className="h-9 w-9 rounded-lg bg-white object-contain p-0.5 shrink-0"
                    />
                    <div className="text-left">
                      <p className="text-[10px] font-medium text-blue-100 leading-tight">
                        SMART ABSENSI
                      </p>
                      <h3 className="text-sm font-bold tracking-tight leading-tight">
                        TKIT AL-I&apos;ANAH
                      </h3>
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-100 mt-1.5">
                    Kartu Identitas Absensi QR Siswa
                  </p>
                </div>

                <div className="h-1.5 w-full bg-emerald-500" />

                <div className="px-5 py-5 flex flex-col items-center text-center">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <QRCodeImage value={student.qrCodeValue} size={132} />
                  </div>

                  <p className="mt-3 text-[11px] font-mono font-medium text-slate-500">
                    {student.qrCodeValue}
                  </p>

                  <h4 className="mt-1.5 text-base font-bold text-slate-900">
                    {student.nama}
                  </h4>

                  <p className="mt-1 text-xs font-medium text-blue-700">
                    {student.kelasNama}
                  </p>

                  <div className="mt-3 w-full border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-600">
                    <span>
                      Jenjang: <strong className="text-slate-900">{isTK ? 'TKIT' : 'SDIT'}</strong>
                    </span>
                    <span className="font-mono">{student.nis}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
