import React, { useMemo, useState } from 'react';
import { Download, MessageCircle, RotateCcw } from 'lucide-react';
import type {
  AttendanceLogRecord,
  ClassRoomRecord,
  GateType,
  Jenjang,
  StudentRecord,
} from '../types/attendance';
import { PageBanner } from '../components/PageBanner';
import { StatusText } from '../components/StatusText';

interface RecapPageProps {
  students: StudentRecord[];
  classes: ClassRoomRecord[];
  logs: AttendanceLogRecord[];
  scopedClassId?: string | null;
  scopedClassName?: string | null;
  canExportCsv?: boolean;
  canSendWeeklyFeedback?: boolean;
  canResetAttendance?: boolean;
  onOpenWeeklyFeedback?: (student: StudentRecord) => void;
  onResetAttendance?: () => void;
}

type RecapTab = 'log' | 'siswa';

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export const RecapPage: React.FC<RecapPageProps> = ({
  students,
  classes,
  logs,
  scopedClassId = null,
  scopedClassName = null,
  canExportCsv = true,
  canSendWeeklyFeedback = false,
  canResetAttendance = false,
  onOpenWeeklyFeedback,
  onResetAttendance,
}) => {
  const [activeTab, setActiveTab] = useState<RecapTab>('log');
  const [jenjangFilter, setJenjangFilter] = useState<'Semua' | Jenjang>('Semua');
  const [kelasFilter, setKelasFilter] = useState<string>(scopedClassId || 'Semua');
  const [jenisFilter, setJenisFilter] = useState<'Semua' | GateType>('Semua');
  const [confirmReset, setConfirmReset] = useState(false);

  const effectiveClassId = scopedClassId || kelasFilter;

  const availableClasses = useMemo(() => {
    if (scopedClassId) return classes.filter((c) => c.id === scopedClassId);
    if (jenjangFilter === 'Semua') return classes;
    return classes.filter((c) => c.jenjang === jenjangFilter);
  }, [classes, jenjangFilter, scopedClassId]);

  const selectedClassName = useMemo(() => {
    if (scopedClassName) return scopedClassName;
    if (effectiveClassId === 'Semua') return null;
    return classes.find((c) => c.id === effectiveClassId)?.namaKelas ?? null;
  }, [classes, effectiveClassId, scopedClassName]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchJ =
        scopedClassId !== null || jenjangFilter === 'Semua' || s.jenjang === jenjangFilter;
      const matchK = effectiveClassId === 'Semua' || s.kelasId === effectiveClassId;
      return matchJ && matchK;
    });
  }, [students, jenjangFilter, effectiveClassId, scopedClassId]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchJ =
        scopedClassId !== null || jenjangFilter === 'Semua' || log.jenjang === jenjangFilter;
      const matchK = !selectedClassName || log.kelasNama === selectedClassName;
      const matchType = jenisFilter === 'Semua' || log.jenis === jenisFilter;
      return matchJ && matchK && matchType;
    });
  }, [logs, jenjangFilter, selectedClassName, jenisFilter, scopedClassId]);

  const summaryCounts = useMemo(() => {
    return {
      hadir: filteredStudents.filter((s) => s.statusHariIni === 'Hadir').length,
      terlambat: filteredStudents.filter((s) => s.statusHariIni === 'Terlambat').length,
      izinSakit: filteredStudents.filter(
        (s) => s.statusHariIni === 'Izin' || s.statusHariIni === 'Sakit'
      ).length,
      belumOrAlpa: filteredStudents.filter(
        (s) => s.statusHariIni === 'Belum Scan' || s.statusHariIni === 'Alpa'
      ).length,
    };
  }, [filteredStudents]);

  const handleExportCsv = () => {
    let header: string[];
    let rows: (string | number | null | undefined)[][];
    let filename: string;

    if (activeTab === 'log') {
      header = [
        'Tanggal',
        'NIS',
        'Nama_Siswa',
        'Jenjang',
        'Kelas',
        'Titik_Absensi',
        'Status',
        'Waktu',
        'Metode',
        'Petugas',
        'Keterangan',
      ];
      rows = filteredLogs.map((log) => [
        log.tanggal,
        log.nis,
        log.namaSiswa,
        log.jenjang,
        log.kelasNama,
        log.jenis,
        log.status,
        log.waktu,
        log.metode,
        log.petugasNama ?? '-',
        log.keterangan,
      ]);
      filename = 'log-absensi-tkit-al-ianah.csv';
    } else {
      header = [
        'NIS',
        'Nama_Siswa',
        'Jenjang',
        'Kelas',
        'Status_Hari_Ini',
        'Jam_Masuk',
        'Jam_Pulang',
        'Wali_Murid',
        'No_WA_Wali',
      ];
      rows = filteredStudents.map((s) => [
        s.nis,
        s.nama,
        s.jenjang,
        s.kelasNama,
        s.statusHariIni,
        s.jamMasuk ?? '-',
        s.jamPulang ?? '-',
        s.namaWali,
        s.noWaWali ?? '-',
      ]);
      filename = 'rekap-siswa-tkit-al-ianah.csv';
    }

    const csvContent =
      '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentRowCount = activeTab === 'log' ? filteredLogs.length : filteredStudents.length;

  return (
    <div className="space-y-5">
      <PageBanner
        title={scopedClassName ? `Rekap Absensi ${scopedClassName}` : 'Rekapitulasi Absensi Sekolah'}
        description="Pantau ringkasan kehadiran siswa, riwayat scan masuk/kelas/pulang, dan ekspor laporan dalam format CSV."
      />

      {/* Filter & Export Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start">
            <button
              type="button"
              onClick={() => setActiveTab('log')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors min-h-[36px] whitespace-nowrap ${
                activeTab === 'log'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Data Log Absensi ({filteredLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('siswa')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors min-h-[36px] whitespace-nowrap ${
                activeTab === 'siswa'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ringkasan Per Siswa ({filteredStudents.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canResetAttendance && onResetAttendance && (
              confirmReset ? (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs">
                  <span className="font-semibold text-rose-800">Reset kehadiran hari ini?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onResetAttendance();
                      setConfirmReset(false);
                    }}
                    className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Ya, Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors whitespace-nowrap min-h-[42px]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Kehadiran</span>
                </button>
              )
            )}

            {canExportCsv && (
              <button
                type="button"
                disabled={currentRowCount === 0}
                onClick={handleExportCsv}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap min-h-[42px]"
              >
                <Download className="w-4 h-4" />
                <span>Ekspor CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          {!scopedClassId && (
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['Semua', 'TK', 'SD'] as const).map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => {
                    setJenjangFilter(j);
                    setKelasFilter('Semua');
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors min-h-[34px] ${
                    jenjangFilter === j
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {j === 'Semua' ? 'Semua Jenjang' : j}
                </button>
              ))}
            </div>
          )}

          <select
            aria-label="Filter Kelas Rekap"
            disabled={!!scopedClassId}
            value={effectiveClassId}
            onChange={(e) => setKelasFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 disabled:bg-slate-50 min-h-[40px]"
          >
            {!scopedClassId && <option value="Semua">Semua Kelas</option>}
            {availableClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.namaKelas}
              </option>
            ))}
          </select>

          {activeTab === 'log' && (
            <select
              aria-label="Filter Titik Absensi"
              value={jenisFilter}
              onChange={(e) => setJenisFilter(e.target.value as 'Semua' | GateType)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 min-h-[40px]"
            >
              <option value="Semua">Semua Titik Scan</option>
              <option value="Masuk">Gerbang Masuk</option>
              <option value="Kelas">Absensi Kelas</option>
              <option value="Pulang">Gerbang Pulang</option>
            </select>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Hadir Tepat Waktu</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
            {summaryCounts.hadir}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Terlambat</p>
          <p className="mt-1 text-2xl font-bold text-amber-700 tabular-nums">
            {summaryCounts.terlambat}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Izin / Sakit</p>
          <p className="mt-1 text-2xl font-bold text-blue-700 tabular-nums">
            {summaryCounts.izinSakit}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Belum Scan / Alpa</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">
            {summaryCounts.belumOrAlpa}
          </p>
        </div>
      </div>

      {/* Active Data Table */}
      {activeTab === 'log' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Log Aktivitas Absensi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Menampilkan {filteredLogs.length} baris log sesuai filter
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">NIS</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Titik Scan</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
                      Belum ada log absensi yang tercatat pada filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5 font-mono text-xs text-slate-600">{log.nis}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{log.namaSiswa}</p>
                        <p className="text-xs text-slate-500">{log.keterangan}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{log.kelasNama}</td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-800">
                        {log.jenis}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{log.metode}</td>
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
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Tabel Rekap Kehadiran Siswa
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Menampilkan {filteredStudents.length} siswa sesuai filter
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">NIS</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Masuk</th>
                  <th className="py-3 px-4 text-right">Pulang</th>
                  {canSendWeeklyFeedback && onOpenWeeklyFeedback && (
                    <th className="py-3 px-5 text-right">Laporan WA</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canSendWeeklyFeedback && onOpenWeeklyFeedback ? 7 : 6}
                      className="py-10 text-center text-xs text-slate-500"
                    >
                      Belum ada data siswa yang cocok dengan filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5 font-mono text-xs text-slate-600">{s.nis}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{s.nama}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{s.kelasNama}</td>
                      <td className="py-3 px-4">
                        <StatusText status={s.statusHariIni} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {s.jamMasuk ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {s.jamPulang ?? '—'}
                      </td>
                      {canSendWeeklyFeedback && onOpenWeeklyFeedback && (
                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenWeeklyFeedback(s)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Laporan WA</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
