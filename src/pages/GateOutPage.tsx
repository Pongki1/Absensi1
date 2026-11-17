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

interface GateOutPageProps {
  students: StudentRecord[];
  logs: AttendanceLogRecord[];
  lastConfirmed: {
    student: StudentRecord;
    time: string;
    method: string;
    status: AttendanceStatus;
  } | null;
  onConfirmGateOut: (
    student: StudentRecord,
    method: ScanMethod,
    status: AttendanceStatus
  ) => void;
}

export const GateOutPage: React.FC<GateOutPageProps> = ({
  students,
  logs,
  lastConfirmed,
  onConfirmGateOut,
}) => {
  const gateOutLogs = logs.filter((l) => l.jenis === 'Pulang');

  return (
    <div className="space-y-5">
      <PageBanner
        title="Absensi Gerbang Pulang"
        description="Pindai kartu QR siswa saat penjemputan di gerbang sekolah untuk memverifikasi wali penjemput dan mencatat jam pulang."
      />

      <SmartphoneQRScanner
        gateType="Pulang"
        students={students}
        onConfirmAttendance={onConfirmGateOut}
        lastConfirmed={lastConfirmed}
      />

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            Catatan Gerbang Pulang Hari Ini
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Menampilkan {gateOutLogs.length} catatan kepulangan siswa
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-5">Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Keterangan Penjemputan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Jam Pulang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {gateOutLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                    Belum ada catatan kepulangan siswa di gerbang pulang.
                  </td>
                </tr>
              ) : (
                gateOutLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5">
                      <p className="font-semibold text-slate-900">{log.namaSiswa}</p>
                      <p className="text-xs font-mono text-slate-400">{log.nis}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{log.kelasNama}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{log.keterangan}</td>
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
