import React from 'react';
import {
  CheckCircle2,
  Clock,
  DoorOpen,
  ClipboardCheck,
  Printer,
  Users,
  AlertCircle,
  ArrowRight,
  BarChart3,
  ShieldCheck,
  UserCheck,
  Wifi,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AttendanceLogRecord,
  ClassRoomRecord,
  PageId,
  RolePolicy,
  StudentRecord,
  UserRole,
} from '../types/attendance';
import type { SchoolUserProfile } from '../services/authService';
import { PageBanner } from '../components/PageBanner';
import { StatusText } from '../components/StatusText';

interface DashboardPageProps {
  activeRole: UserRole;
  verifiedProfile?: SchoolUserProfile | null;
  rolePolicy: RolePolicy;
  allowedPages: PageId[];
  assignedClassName?: string | null;
  liveSyncConnected?: boolean;
  lastSyncedAt?: string | null;
  lastLiveSummary?: string | null;
  pendingGoogleCount?: number;
  canAuthorizeUsers?: boolean;
  students: StudentRecord[];
  classes: ClassRoomRecord[];
  logs: AttendanceLogRecord[];
  onNavigate: (page: PageId) => void;
  onOpenPrintAll: () => void;
}

function getLocalTodayYYYYMMDD(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  activeRole,
  verifiedProfile,
  rolePolicy,
  allowedPages,
  assignedClassName,
  liveSyncConnected = false,
  lastSyncedAt = null,
  lastLiveSummary = null,
  pendingGoogleCount = 0,
  canAuthorizeUsers = false,
  students,
  classes,
  logs,
  onNavigate,
  onOpenPrintAll,
}) => {
  const totalSiswa = students.length;
  const todayStr = getLocalTodayYYYYMMDD();
  const todayLogs = logs.filter((log) => log.tanggal === todayStr);
  const hadirDariLogIds = new Set<string>();
  const tepatWaktuDariLogIds = new Set<string>();
  const terlambatDariLogIds = new Set<string>();

  for (const log of todayLogs) {
    if (log.status === 'Hadir') {
      hadirDariLogIds.add(log.siswaId);
      tepatWaktuDariLogIds.add(log.siswaId);
    } else if (log.status === 'Terlambat') {
      hadirDariLogIds.add(log.siswaId);
      terlambatDariLogIds.add(log.siswaId);
    }
  }

  const hadirDariLogsCount = hadirDariLogIds.size;
  const tepatWaktuLogsCount = tepatWaktuDariLogIds.size;
  const terlambatLogsCount = Array.from(terlambatDariLogIds).filter(
    (id) => !tepatWaktuDariLogIds.has(id)
  ).length;
  const persentaseHadirLogs =
    totalSiswa > 0 ? Math.min(100, Math.round((hadirDariLogsCount / totalSiswa) * 100)) : 0;
  const countHadirTepat = students.filter((s) => s.statusHariIni === 'Hadir').length;
  const countTerlambat = students.filter((s) => s.statusHariIni === 'Terlambat').length;
  const totalHadir = countHadirTepat + countTerlambat;
  const totalIzinSakit = students.filter(
    (s) => s.statusHariIni === 'Izin' || s.statusHariIni === 'Sakit'
  ).length;
  const totalBelumScan = students.filter(
    (s) => s.statusHariIni === 'Belum Scan' || s.statusHariIni === 'Alpa'
  ).length;

  const tkStudents = students.filter((s) => s.jenjang === 'TK');
  const sdStudents = students.filter((s) => s.jenjang === 'SD');
  const tkHadir = tkStudents.filter(
    (s) => s.statusHariIni === 'Hadir' || s.statusHariIni === 'Terlambat'
  ).length;
  const sdHadir = sdStudents.filter(
    (s) => s.statusHariIni === 'Hadir' || s.statusHariIni === 'Terlambat'
  ).length;

  const persentaseHadir = totalSiswa > 0 ? Math.round((totalHadir / totalSiswa) * 100) : 0;

  const ratioChartData =
    totalSiswa > 0
      ? [
          { name: 'Hadir (Masuk)', value: totalHadir, color: '#16A34A' },
          {
            name: 'Belum Hadir / Izin',
            value: Math.max(0, totalSiswa - totalHadir),
            color: '#E2E8F0',
          },
        ]
      : [{ name: 'Belum Ada Data', value: 1, color: '#E2E8F0' }];

  const statusBarData = [
    { label: 'Hadir', jumlah: countHadirTepat, color: '#16A34A' },
    { label: 'Terlambat', jumlah: countTerlambat, color: '#D97706' },
    { label: 'Izin / Sakit', jumlah: totalIzinSakit, color: '#2563EB' },
    { label: 'Belum / Alpa', jumlah: totalBelumScan, color: '#64748B' },
  ];

  const canGateIn = allowedPages.includes('absensi-gerbang-masuk');
  const canGateOut = allowedPages.includes('absensi-gerbang-pulang');
  const canClassAttendance = allowedPages.includes('absensi-kelas');
  const canRecap = allowedPages.includes('rekap-absensi');
  const canViewStudents = allowedPages.includes('siswa');

  return (
    <div className="space-y-6">
      {verifiedProfile && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-700">
                Dashboard {activeRole}
                {assignedClassName ? ` · ${assignedClassName}` : ''}
              </p>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                {verifiedProfile.fullName}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-6 text-xs border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <div>
              <p className="text-slate-500">Email Login</p>
              <p className="font-mono font-semibold text-slate-900 mt-0.5 truncate max-w-[160px]">
                {verifiedProfile.email}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Peran</p>
              <p className="font-semibold text-blue-700 mt-0.5">{verifiedProfile.appRole}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <p className="font-semibold text-emerald-700 mt-0.5">
                {verifiedProfile.isActive ? 'Aktif' : 'Nonaktif'}
              </p>
            </div>
          </div>
        </div>
      )}

      <PageBanner
        title={`Ringkasan Operasional ${activeRole}${assignedClassName ? ` (${assignedClassName})` : ''}`}
        description={rolePolicy.tugasUtama}
      />

      {/* Real-time 1 Server Storage Sync Status + Pending Google Authorization Notification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`${
            canAuthorizeUsers && pendingGoogleCount > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
          } rounded-xl border border-slate-200 bg-white px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Wifi
              className={`w-4 h-4 shrink-0 ${
                liveSyncConnected ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                Terintegrasi 1 Server Storage Pusat{' '}
                <span className={liveSyncConnected ? 'text-emerald-700' : 'text-slate-500'}>
                  ({liveSyncConnected ? 'Sinkron Real-Time Aktif' : 'Terhubung'})
                </span>
              </p>
              <p className="text-slate-500 truncate">
                {lastLiveSummary
                  ? `Pembaruan langsung: ${lastLiveSummary}`
                  : 'Absensi dari Guru Piket (Gerbang) & Guru Kelas langsung tersimpan dan tampil otomatis.'}
              </p>
            </div>
          </div>
          {lastSyncedAt && (
            <span className="font-mono text-[11px] text-slate-500 shrink-0">
              Sinkron: {lastSyncedAt}
            </span>
          )}
        </div>

        {canAuthorizeUsers && pendingGoogleCount > 0 && (
          <div className="lg:col-span-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <div className="min-w-0 text-xs">
                <p className="font-bold text-amber-950 truncate">
                  {pendingGoogleCount} Akun Google Guru Menunggu Izin
                </p>
                <p className="text-amber-800 truncate">
                  Beri otorisasi peran Guru Piket / Guru Kelas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('pengaturan')}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
            >
              Tinjau Izin
            </button>
          </div>
        )}
      </div>

      {/* Dedicated Summary Card: Siswa Hadir Hari Ini (dari Logs) vs Total Siswa */}
      <div className="rounded-xl border border-emerald-200 bg-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-700">
                Ringkasan Kehadiran Hari Ini (Data Log · {todayStr})
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {hadirDariLogsCount}
                </span>
                <span className="text-sm sm:text-base font-medium text-slate-500 tabular-nums">
                  / {totalSiswa} Total Siswa
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Tepat waktu:{' '}
                <strong className="font-semibold text-slate-900 tabular-nums">
                  {tepatWaktuLogsCount}
                </strong>{' '}
                · Terlambat:{' '}
                <strong className="font-semibold text-slate-900 tabular-nums">
                  {terlambatLogsCount}
                </strong>{' '}
                · Catatan log hari ini:{' '}
                <strong className="font-semibold text-slate-900 tabular-nums">
                  {todayLogs.length}
                </strong>
              </p>
            </div>
          </div>

          <div className="w-full sm:w-56 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">Rasio Kehadiran</span>
              <span className="font-mono text-emerald-700 tabular-nums">
                {persentaseHadirLogs}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${persentaseHadirLogs}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 text-right tabular-nums">
              {Math.max(0, totalSiswa - hadirDariLogsCount)} siswa belum tercatat hadir di log
            </p>
          </div>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
            <span>{assignedClassName ? 'Siswa Kelas Binaan' : 'Total Siswa'}</span>
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {totalSiswa}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            TK: <span className="tabular-nums font-medium">{tkStudents.length}</span> · SD:{' '}
            <span className="tabular-nums font-medium">{sdStudents.length}</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
            <span>Hadir Hari Ini</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">
            {totalHadir}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tingkat hadir:{' '}
            <span className="tabular-nums font-semibold text-emerald-700">{persentaseHadir}%</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
            <span>Izin / Sakit</span>
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {totalIzinSakit}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tercatat hari ini</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
            <span>Belum Scan / Alpa</span>
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {totalBelumScan}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dari <span className="tabular-nums font-medium">{classes.length}</span> rombongan belajar
          </p>
        </div>
      </div>

      {/* Statistical Summary Chart Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Statistik Kehadiran Hari Ini
              </h2>
              <p className="text-xs text-slate-500">
                Perbandingan siswa hadir terhadap total siswa dan distribusi status
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold text-blue-700 tabular-nums">
            {totalHadir}/{totalSiswa} Siswa Hadir ({persentaseHadir}%)
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
            <div className="relative h-[190px] w-[190px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ratioChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={80}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                  >
                    {ratioChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} siswa`, 'Jumlah']}
                    contentStyle={{
                      borderRadius: '8px',
                      borderColor: '#E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {persentaseHadir}%
                </span>
                <span className="text-[11px] font-medium text-slate-500">Kehadiran</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs w-full max-w-[220px]">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600 shrink-0" />
                  <span>Siswa Hadir</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {totalHadir}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-xs bg-slate-200 shrink-0" />
                  <span>Lainnya / Belum</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {Math.max(0, totalSiswa - totalHadir)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="font-medium text-slate-500">Total Siswa</span>
                <span className="font-mono font-bold text-blue-700 tabular-nums">{totalSiswa}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusBarData}
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F8FAFC' }}
                  formatter={(value) => [`${value} siswa`, 'Jumlah']}
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="jumlah" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {statusBarData.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Actions + Jenjang Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Aksi Cepat {activeRole}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Modul operasional sesuai wewenang akun yang sedang masuk
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {canGateIn && (
              <button
                type="button"
                onClick={() => onNavigate('absensi-gerbang-masuk')}
                className="flex flex-col justify-between rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-left hover:bg-blue-100/70 transition-colors min-h-[112px]"
              >
                <DoorOpen className="w-5 h-5 text-blue-700" />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">Scan Gerbang Masuk</p>
                  <p className="text-xs text-blue-700 mt-0.5 flex items-center gap-1">
                    <span>Buka Pemindai</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </button>
            )}

            {canGateOut && (
              <button
                type="button"
                onClick={() => onNavigate('absensi-gerbang-pulang')}
                className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-left hover:bg-emerald-100/70 transition-colors min-h-[112px]"
              >
                <DoorOpen className="w-5 h-5 text-emerald-700" />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">Scan Gerbang Pulang</p>
                  <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
                    <span>Buka Pemindai</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </button>
            )}

            {canClassAttendance && (
              <button
                type="button"
                onClick={() => onNavigate('absensi-kelas')}
                className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-left hover:bg-emerald-100/70 transition-colors min-h-[112px]"
              >
                <ClipboardCheck className="w-5 h-5 text-emerald-700" />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">Absensi Kelas</p>
                  <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
                    <span>Catat Kehadiran</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </button>
            )}

            {rolePolicy.canPrintNametags && (
              <button
                type="button"
                disabled={students.length === 0}
                onClick={onOpenPrintAll}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100 disabled:opacity-50 transition-colors min-h-[112px]"
              >
                <Printer className="w-5 h-5 text-slate-700" />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">Cetak Kartu QR</p>
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                    <span>Nametag Siswa</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </button>
            )}

            {canRecap && (
              <button
                type="button"
                onClick={() => onNavigate('rekap-absensi')}
                className="flex flex-col justify-between rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-left hover:bg-blue-100/70 transition-colors min-h-[112px]"
              >
                <BarChart3 className="w-5 h-5 text-blue-700" />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">Rekap &amp; Ekspor CSV</p>
                  <p className="text-xs text-blue-700 mt-0.5 flex items-center gap-1">
                    <span>Lihat Laporan</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </button>
            )}

            {canViewStudents && (
              <button
                type="button"
                onClick={() => onNavigate('siswa')}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100 transition-colors min-h-[112px]"
              >
                <Users className="w-5 h-5 text-slate-700" />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">Kelola Data Siswa</p>
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                    <span>Buka Daftar</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Jenjang Progress Summary */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Ringkasan Per Jenjang
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribusi kehadiran siswa TKIT dan SDIT hari ini
          </p>

          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="text-slate-700">TKIT AL-I&apos;ANAH (TK A &amp; TK B)</span>
                <span className="font-mono text-slate-900 tabular-nums">
                  {tkHadir}/{tkStudents.length} Hadir
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${tkStudents.length > 0 ? (tkHadir / tkStudents.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="text-slate-700">SDIT AL-I&apos;ANAH (Kelas 1–6)</span>
                <span className="font-mono text-slate-900 tabular-nums">
                  {sdHadir}/{sdStudents.length} Hadir
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{
                    width: `${sdStudents.length > 0 ? (sdHadir / sdStudents.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {canRecap && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Lihat ringkasan lengkap</span>
              <button
                type="button"
                onClick={() => onNavigate('rekap-absensi')}
                className="font-semibold text-blue-700 hover:underline"
              >
                Buka Rekap Absensi
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Attendance Activity Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Aktivitas Absensi Terbaru
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Catatan scan QR dan absensi kelas terbaru
            </p>
          </div>
          {canRecap && (
            <button
              type="button"
              onClick={() => onNavigate('rekap-absensi')}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
            >
              Semua Rekap
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-5">Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Titik Scan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                    Belum ada aktivitas absensi yang tercatat hari ini.
                  </td>
                </tr>
              ) : (
                logs.slice(0, 8).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5">
                      <p className="font-medium text-slate-900">{log.namaSiswa}</p>
                      <p className="text-xs font-mono text-slate-500">{log.nis}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{log.kelasNama}</td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      <p>
                        {log.jenis} · <span className="text-slate-500">{log.metode}</span>
                      </p>
                      {log.petugasNama && (
                        <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                          Oleh: {log.petugasNama}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={log.status} />
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-xs text-slate-700 tabular-nums">
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
