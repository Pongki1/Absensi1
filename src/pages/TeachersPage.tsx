import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  GraduationCap,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ClassRoomRecord,
  StaffAttendanceStatus,
  StaffCategory,
  StaffJenjang,
  TeacherRecord,
} from '../types/attendance';
import { PageBanner } from '../components/PageBanner';
import { TeacherImportModal } from '../components/TeacherImportModal';

interface TeachersPageProps {
  teachers: TeacherRecord[];
  classes: ClassRoomRecord[];
  canImportStaff?: boolean;
  onImportTeachers?: (newTeachers: TeacherRecord[]) => void;
  onAddTeacher?: (teacher: TeacherRecord) => void;
  onUpdateTeacher?: (teacher: TeacherRecord) => void;
  onDeleteTeacher?: (teacherId: string) => void;
  onUpdateTeacherAttendance?: (teacherId: string, status: StaffAttendanceStatus) => void;
  onResetTeacherAttendance?: () => void;
}

const STAFF_ATTENDANCE_OPTIONS: StaffAttendanceStatus[] = [
  'Hadir',
  'Izin',
  'Sakit',
  'Belum Absen',
];

function staffStatusColor(status: StaffAttendanceStatus): string {
  switch (status) {
    case 'Hadir':
      return 'text-emerald-700';
    case 'Izin':
      return 'text-blue-700';
    case 'Sakit':
      return 'text-amber-700';
    default:
      return 'text-slate-500';
  }
}

export const TeachersPage: React.FC<TeachersPageProps> = ({
  teachers,
  classes,
  canImportStaff = false,
  onImportTeachers,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onUpdateTeacherAttendance,
  onResetTeacherAttendance,
}) => {
  const [search, setSearch] = useState('');
  const [jenjangFilter, setJenjangFilter] = useState<'Semua' | StaffJenjang>('Semua');
  const [categoryFilter, setCategoryFilter] = useState<'Semua' | StaffCategory>('Semua');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [lastImportedBatch, setLastImportedBatch] = useState<TeacherRecord[] | null>(null);

  // Manual add/edit state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);
  const [formKode, setFormKode] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKategori, setFormKategori] = useState<StaffCategory>('Guru');
  const [formJabatan, setFormJabatan] = useState('Wali Kelas');
  const [formJenjang, setFormJenjang] = useState<StaffJenjang>('SD');
  const [formWaliKelas, setFormWaliKelas] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNoHp, setFormNoHp] = useState('');
  const [formStatus, setFormStatus] = useState<'Aktif' | 'Cuti'>('Aktif');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getCategory = (t: TeacherRecord): StaffCategory => {
    if (t.kategoriPeran) return t.kategoriPeran;
    return t.jabatan.toLowerCase().includes('kepala sekolah') ? 'Kepala Sekolah' : 'Guru';
  };

  const principalCount = useMemo(
    () => teachers.filter((t) => getCategory(t) === 'Kepala Sekolah').length,
    [teachers]
  );
  const teacherCount = teachers.length - principalCount;
  const presentCount = useMemo(
    () => teachers.filter((t) => (t.kehadiranHariIni ?? 'Belum Absen') === 'Hadir').length,
    [teachers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      const cat = getCategory(t);
      const matchJenjang = jenjangFilter === 'Semua' || t.jenjang === jenjangFilter;
      const matchCategory = categoryFilter === 'Semua' || cat === categoryFilter;
      const matchSearch =
        !q ||
        t.nama.toLowerCase().includes(q) ||
        t.kodeGuru.toLowerCase().includes(q) ||
        t.jabatan.toLowerCase().includes(q) ||
        (t.waliKelasNama ?? '').toLowerCase().includes(q);
      return matchJenjang && matchCategory && matchSearch;
    });
  }, [teachers, jenjangFilter, categoryFilter, search]);

  const openAddForm = () => {
    setEditingTeacher(null);
    setFormKode('');
    setFormNama('');
    setFormKategori('Guru');
    setFormJabatan('Wali Kelas');
    setFormJenjang('TK');
    setFormWaliKelas('');
    setFormEmail('');
    setFormNoHp('');
    setFormStatus('Aktif');
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (t: TeacherRecord) => {
    setEditingTeacher(t);
    setFormKode(t.kodeGuru);
    setFormNama(t.nama);
    setFormKategori(getCategory(t));
    setFormJabatan(t.jabatan);
    setFormJenjang(t.jenjang);
    setFormWaliKelas(t.waliKelasNama ?? '');
    setFormEmail(t.emailOpsional ?? '');
    setFormNoHp(t.noHpOpsional ?? '');
    setFormStatus(t.statusAktif);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const namaClean = formNama.trim();
    if (!namaClean) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }

    const kodeClean =
      formKode.trim() ||
      `${formKategori === 'Kepala Sekolah' ? 'KEPSEK' : 'GURU'}-${String(teachers.length + 1).padStart(3, '0')}`;

    const duplicate = teachers.some(
      (t) =>
        t.id !== editingTeacher?.id &&
        t.kodeGuru.trim().toLowerCase() === kodeClean.toLowerCase()
    );
    if (duplicate) {
      setFormError('Kode Guru / NIP tersebut sudah terdaftar.');
      return;
    }

    if (editingTeacher) {
      onUpdateTeacher?.({
        ...editingTeacher,
        kodeGuru: kodeClean,
        nama: namaClean,
        kategoriPeran: formKategori,
        jabatan: formJabatan.trim() || (formKategori === 'Kepala Sekolah' ? 'Kepala Sekolah' : 'Guru'),
        jenjang: formJenjang,
        waliKelasNama: formWaliKelas || null,
        emailOpsional: formEmail.trim() || null,
        noHpOpsional: formNoHp.trim() || null,
        statusAktif: formStatus,
      });
    } else {
      const created: TeacherRecord = {
        id: `tch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kodeGuru: kodeClean,
        nama: namaClean,
        kategoriPeran: formKategori,
        jabatan: formJabatan.trim() || (formKategori === 'Kepala Sekolah' ? 'Kepala Sekolah' : 'Guru'),
        jenjang: formJenjang,
        waliKelasNama: formWaliKelas || null,
        emailOpsional: formEmail.trim() || null,
        noHpOpsional: formNoHp.trim() || null,
        statusAktif: formStatus,
        kehadiranHariIni: 'Belum Absen',
        jamHadirGuru: null,
      };
      onAddTeacher?.(created);
    }

    setFormOpen(false);
  };

  const handleConfirmImport = (imported: TeacherRecord[]) => {
    onImportTeachers?.(imported);
    setLastImportedBatch(imported);
  };

  return (
    <div className="space-y-5">
      <PageBanner
        title="Data Guru & Kepala Sekolah"
        description="Kelola daftar serta kehadiran Kepala Sekolah, Wali Kelas, Guru Kelas, dan Guru Piket jenjang TKIT & SDIT."
      />

      {lastImportedBatch && lastImportedBatch.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          <div className="flex items-start sm:items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              Berhasil mengimpor <strong>{lastImportedBatch.length} data Guru &amp; Kepala Sekolah</strong>{' '}
              ke database sekolah.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastImportedBatch(null)}
            className="self-start sm:self-auto rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setCategoryFilter('Semua')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors min-h-[36px] ${
                  categoryFilter === 'Semua'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({teachers.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('Kepala Sekolah')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors min-h-[36px] ${
                  categoryFilter === 'Kepala Sekolah'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kepala Sekolah ({principalCount})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('Guru')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors min-h-[36px] ${
                  categoryFilter === 'Guru'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Guru ({teacherCount})
              </button>
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['Semua', 'TK', 'SD', 'TK & SD'] as const).map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJenjangFilter(j)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors min-h-[36px] ${
                    jenjangFilter === j
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {j === 'Semua' ? 'Semua Jenjang' : j}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canImportStaff && onResetTeacherAttendance && teachers.length > 0 && (
              <button
                type="button"
                onClick={onResetTeacherAttendance}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap min-h-[44px]"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span>Reset Kehadiran</span>
              </button>
            )}

            {canImportStaff && onAddTeacher && (
              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Guru / Kepsek</span>
              </button>
            )}

            {canImportStaff && onImportTeachers && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs sm:text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap min-h-[44px]"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Import Excel</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama guru, kepala sekolah, kode/NIP, jabatan, atau wali kelas..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none min-h-[44px]"
            />
          </div>
          <p className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
            Hadir hari ini: <strong className="font-mono text-slate-900">{presentCount}/{teachers.length}</strong>
          </p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-5">Kode / NIP</th>
                <th className="py-3 px-4">Nama Guru / Kepala Sekolah</th>
                <th className="py-3 px-4">Jenjang</th>
                <th className="py-3 px-4">Jabatan / Wali Kelas</th>
                <th className="py-3 px-4">Kehadiran Hari Ini</th>
                {canImportStaff && (
                  <th className="py-3 px-5 text-right">Kehadiran &amp; Kelola</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={canImportStaff ? 6 : 5}
                    className="py-12 px-4 text-center"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {teachers.length === 0
                        ? 'Belum ada data guru atau kepala sekolah'
                        : 'Tidak ada data yang cocok dengan filter'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Tambahkan guru/kepala sekolah secara manual atau melalui Import Excel.
                    </p>
                    {teachers.length === 0 && canImportStaff && onAddTeacher && (
                      <div className="mt-4 flex items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={openAddForm}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Guru / Kepsek</span>
                        </button>
                        {onImportTeachers && (
                          <button
                            type="button"
                            onClick={() => setIsImportModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Import dari Excel</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((teacher) => {
                  const isPrincipal = getCategory(teacher) === 'Kepala Sekolah';
                  const attendanceStatus: StaffAttendanceStatus =
                    teacher.kehadiranHariIni ?? 'Belum Absen';
                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-600">
                        {teacher.kodeGuru}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {isPrincipal ? (
                            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : (
                            <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <div>
                            <span className="font-semibold text-slate-900">
                              {teacher.nama}
                            </span>
                            {teacher.emailOpsional && (
                              <p className="text-[11px] text-slate-400">
                                {teacher.emailOpsional}
                                {teacher.noHpOpsional ? ` · ${teacher.noHpOpsional}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {teacher.jenjang}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <span
                          className={
                            isPrincipal ? 'font-semibold text-amber-800' : 'text-slate-700'
                          }
                        >
                          {teacher.jabatan}
                        </span>
                        {teacher.waliKelasNama ? ` · ${teacher.waliKelasNama}` : ''}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className={`font-semibold ${staffStatusColor(attendanceStatus)}`}>
                          {attendanceStatus}
                        </span>
                        {teacher.jamHadirGuru && (
                          <span className="ml-1.5 font-mono text-[11px] text-slate-400 tabular-nums">
                            ({teacher.jamHadirGuru})
                          </span>
                        )}
                      </td>
                      {canImportStaff && (
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {onUpdateTeacherAttendance &&
                              STAFF_ATTENDANCE_OPTIONS.map((opt) => {
                                const isActive = attendanceStatus === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => onUpdateTeacherAttendance(teacher.id, opt)}
                                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                                      isActive
                                        ? opt === 'Hadir'
                                          ? 'bg-emerald-600 text-white'
                                          : opt === 'Belum Absen'
                                            ? 'bg-slate-700 text-white'
                                            : 'bg-blue-600 text-white'
                                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    {opt === 'Belum Absen' ? 'Reset' : opt}
                                  </button>
                                );
                              })}
                            {onUpdateTeacher && (
                              <button
                                type="button"
                                onClick={() => openEditForm(teacher)}
                                aria-label={`Edit ${teacher.nama}`}
                                className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-blue-700"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteTeacher && (
                              confirmDeleteId === teacher.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteTeacher(teacher.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white"
                                >
                                  Hapus?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(teacher.id)}
                                  aria-label={`Hapus ${teacher.nama}`}
                                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-rose-700"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            Belum ada data guru atau kepala sekolah.
          </div>
        ) : (
          filtered.map((teacher) => {
            const isPrincipal = getCategory(teacher) === 'Kepala Sekolah';
            const attendanceStatus: StaffAttendanceStatus =
              teacher.kehadiranHariIni ?? 'Belum Absen';
            return (
              <div
                key={teacher.id}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isPrincipal ? (
                      <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {teacher.nama}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold shrink-0 ${staffStatusColor(attendanceStatus)}`}>
                    {attendanceStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {teacher.jabatan}
                  {teacher.waliKelasNama ? ` · ${teacher.waliKelasNama}` : ''}
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                  {teacher.kodeGuru} · Jenjang {teacher.jenjang}
                </p>
                {canImportStaff && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {onUpdateTeacherAttendance &&
                      STAFF_ATTENDANCE_OPTIONS.map((opt) => {
                        const isActive = attendanceStatus === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => onUpdateTeacherAttendance(teacher.id, opt)}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              isActive
                                ? opt === 'Hadir'
                                  ? 'bg-emerald-600 text-white'
                                  : opt === 'Belum Absen'
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-blue-600 text-white'
                                : 'border border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {opt === 'Belum Absen' ? 'Reset' : opt}
                          </button>
                        );
                      })}
                    {onDeleteTeacher && (
                      confirmDeleteId === teacher.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteTeacher(teacher.id);
                            setConfirmDeleteId(null);
                          }}
                          className="ml-auto rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                        >
                          Hapus?
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(teacher.id)}
                          className="ml-auto rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          Hapus
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Teacher Modal */}
      {formOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {editingTeacher ? 'Edit Data Guru / Kepala Sekolah' : 'Tambah Guru / Kepala Sekolah'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Peran
                  </label>
                  <select
                    value={formKategori}
                    onChange={(e) => {
                      const next = e.target.value as StaffCategory;
                      setFormKategori(next);
                      if (next === 'Kepala Sekolah') {
                        setFormJabatan('Kepala Sekolah');
                        setFormWaliKelas('');
                      } else if (formJabatan === 'Kepala Sekolah') {
                        setFormJabatan('Wali Kelas');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[42px]"
                  >
                    <option value="Guru">Guru</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode / NIP (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formKode}
                    onChange={(e) => setFormKode(e.target.value)}
                    placeholder="Otomatis jika dikosongkan"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 min-h-[42px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap &amp; Gelar *
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Ustadzah Siti Aminah, S.Pd"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 min-h-[42px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jabatan
                  </label>
                  <input
                    type="text"
                    value={formJabatan}
                    onChange={(e) => setFormJabatan(e.target.value)}
                    placeholder="Wali Kelas / Guru Piket / Kepala Sekolah"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenjang Tugas
                  </label>
                  <select
                    value={formJenjang}
                    onChange={(e) => setFormJenjang(e.target.value as StaffJenjang)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[42px]"
                  >
                    <option value="TK">TK</option>
                    <option value="SD">SD</option>
                    <option value="TK & SD">TK &amp; SD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Wali Kelas (Jika Ada)
                  </label>
                  <select
                    value={formWaliKelas}
                    onChange={(e) => setFormWaliKelas(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[42px]"
                  >
                    <option value="">Tidak Terikat Kelas</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.namaKelas}>
                        {cls.namaKelas}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Kepegawaian
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'Aktif' | 'Cuti')}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[42px]"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Cuti">Cuti</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Sekolah (Opsional)
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="guru@tkit-alianah.sch.id"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor HP / WA (Opsional)
                  </label>
                  <input
                    type="tel"
                    value={formNoHp}
                    onChange={(e) => setFormNoHp(e.target.value)}
                    placeholder="0812..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 min-h-[42px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[42px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 min-h-[42px]"
                >
                  {editingTeacher ? 'Simpan Perubahan' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && canImportStaff && onImportTeachers && (
        <TeacherImportModal
          existingTeachers={teachers}
          classes={classes}
          onImportTeachers={handleConfirmImport}
          onClose={() => setIsImportModalOpen(false)}
        />
      )}
    </div>
  );
};
