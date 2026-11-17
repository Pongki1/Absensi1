import React from 'react';
import type {
  AttendanceLogRecord,
  AttendanceStatus,
  ScanMethod,
  StudentRecord,
} from '../types/attendance';
import { PageBanner } from '../components/PageBanner';
import { SmartphoneQRScanner } from '../components/SmartphoneQRScanner';
import { StatusText } from '../components/StatusText';

interface GateInPageProps {
  students: StudentRecord[];
  logs: AttendanceLogRecord[];
  batasTerlambat?: string;
  lastConfirmed: {
    student: StudentRecord;
    time: string;
    method: string;
    status: AttendanceStatus;
  } | null;
  onConfirmGateIn: (
    student: StudentRecord,
    method: ScanMethod,
    status: AttendanceStatus
  ) => void;
}

export const GateInPage: React.FC<GateInPageProps> = ({
  students,
  logs,
  batasTerlambat = '07:15',
  lastConfirmed,
  onConfirmGateIn,
}) => {
  const gateInLogs = logs.filter((l) => l.jenis === 'Masuk');

  return (
    <div className="space-y-5">
      <PageBanner
        title="Absensi Gerbang Masuk"
        description={`Pindai kartu QR siswa saat kedatangan gerbang atau input NIS secara manual (batas tepat waktu: ${batasTerlambat}).`}
      />

      <SmartphoneQRScanner
        gateType="Masuk"
        students={students}
        batasTerlambat={batasTerlambat}
        onConfirmAttendance={onConfirmGateIn}
        lastConfirmed={lastConfirmed}
      />

      {/* Gate In Log Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Catatan Gerbang Masuk Hari Ini
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Menampilkan {gateInLogs.length} catatan kedatangan gerbang
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-5">Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Metode &amp; Petugas</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Jam Masuk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {gateInLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                    Belum ada siswa yang dipindai di gerbang masuk.
                  </td>
                </tr>
              ) : (
                gateInLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5">
                      <p className="font-semibold text-slate-900">{log.namaSiswa}</p>
                      <p className="text-xs font-mono text-slate-400">{log.nis}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{log.kelasNama}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <span>{log.metode}</span>
                      {log.petugasNama && (
                        <span className="block text-[11px] text-slate-400">
                          Oleh: {log.petugasNama}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={log.status} />
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-xs text-slate-800 tabular-nums">
                      {log.waktu}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
