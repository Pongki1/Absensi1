import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  MessageCircle,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ClassRoomRecord, Jenjang, StudentRecord } from '../types/attendance';
import { PageBanner } from '../components/PageBanner';
import { StatusText } from '../components/StatusText';
import { StudentImportModal } from '../components/StudentImportModal';
import { StudentQRCard } from '../components/StudentQRCard';
import { sanitizeQrValue } from '../utils/excelImportUtils';

interface StudentsPageProps {
  students: StudentRecord[];
  allStudents?: StudentRecord[];
  classes: ClassRoomRecord[];
  scopedClassId?: string | null;
  scopedClassName?: string | null;
  canPrintNametags?: boolean;
  canSendWeeklyFeedback?: boolean;
  canImportStudents?: boolean;
  onPrintStudents: (targetStudents: StudentRecord[], title: string) => void;
  onOpenWeeklyFeedback?: (student: StudentRecord) => void;
  onImportStudents?: (newStudents: StudentRecord[]) => void;
  onAddStudent?: (student: StudentRecord) => void;
  onUpdateStudent?: (student: StudentRecord) => void;
  onDeleteStudent?: (studentId: string) => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({
  students,
  allStudents,
  classes,
  scopedClassId = null,
  scopedClassName = null,
  canPrintNametags = true,
  canSendWeeklyFeedback = false,
  canImportStudents = false,
  onPrintStudents,
  onOpenWeeklyFeedback,
  onImportStudents,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
}) => {
  const [search, setSearch] = useState('');
  const [jenjangFilter, setJenjangFilter] = useState<'Semua' | Jenjang>('Semua');
  const [kelasFilter, setKelasFilter] = useState<string>(scopedClassId || 'Semua');
  const [selectedQrStudentId, setSelectedQrStudentId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [lastImportedBatch, setLastImportedBatch] = useState<StudentRecord[] | null>(null);

  // Manual Add / Edit Student modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [formNis, setFormNis] = useState('');
  const [formQr, setFormQr] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKelasId, setFormKelasId] = useState<string>(scopedClassId || classes[0]?.id || '');
  const [formWali, setFormWali] = useState('');
  const [formNoWa, setFormNoWa] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visibleClasses = useMemo(() => {
    if (scopedClassId) {
      return classes.filter((c) => c.id === scopedClassId);
    }
    if (jenjangFilter === 'Semua') return classes;
    return classes.filter((c) => c.jenjang === jenjangFilter);
  }, [classes, jenjangFilter, scopedClassId]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchJenjang =
        scopedClassId !== null || jenjangFilter === 'Semua' || student.jenjang === jenjangFilter;
      const effectiveKelas = scopedClassId || kelasFilter;
      const matchKelas = effectiveKelas === 'Semua' || student.kelasId === effectiveKelas;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        student.nama.toLowerCase().includes(q) ||
        student.nis.toLowerCase().includes(q) ||
        student.qrCodeValue.toLowerCase().includes(q);
      return matchJenjang && matchKelas && matchSearch;
    });
  }, [students, jenjangFilter, kelasFilter, search, scopedClassId]);

  const openAddForm = () => {
    setEditingStudent(null);
    setFormNis('');
    setFormQr('');
    setFormNama('');
    setFormKelasId(scopedClassId || classes[0]?.id || '');
    setFormWali('');
    setFormNoWa('');
    setFormError(null);
    setFormModalOpen(true);
  };

  const openEditForm = (student: StudentRecord) => {
    setEditingStudent(student);
    setFormNis(student.nis);
    setFormQr(student.qrCodeValue);
    setFormNama(student.nama);
    setFormKelasId(student.kelasId);
    setFormWali(student.namaWali);
    setFormNoWa(student.noWaWali ?? '');
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleSaveStudentForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nisClean = formNis.trim();
    const namaClean = formNama.trim();
    const targetClass = classes.find((c) => c.id === formKelasId);

    if (!nisClean) {
      setFormError('NIS siswa wajib diisi.');
      return;
    }
    if (!namaClean) {
      setFormError('Nama lengkap siswa wajib diisi.');
      return;
    }
    if (!targetClass) {
      setFormError('Silakan pilih kelas siswa.');
      return;
    }

    const pool = allStudents ?? students;
    const duplicateNis = pool.some(
      (s) =>
        s.id !== editingStudent?.id &&
        s.nis.trim().toLowerCase() === nisClean.toLowerCase()
    );
    if (duplicateNis) {
      setFormError('NIS tersebut sudah digunakan oleh siswa lain.');
      return;
    }

    const qrClean = sanitizeQrValue(formQr, nisClean);
    const duplicateQr = pool.some(
      (s) =>
        s.id !== editingStudent?.id &&
        s.qrCodeValue.trim().toLowerCase() === qrClean.toLowerCase()
    );
    if (duplicateQr) {
      setFormError('Kode QR tersebut sudah digunakan oleh siswa lain.');
      return;
    }

    if (editingStudent) {
      onUpdateStudent?.({
        ...editingStudent,
        nis: nisClean,
        qrCodeValue: qrClean,
        nama: namaClean,
        jenjang: targetClass.jenjang,
        kelasId: targetClass.id,
        kelasNama: targetClass.namaKelas,
        namaWali: formWali.trim() || `Wali ${namaClean}`,
        noWaWali: formNoWa.trim() || null,
      });
    } else {
      const created: StudentRecord = {
        id: `std-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nis: nisClean,
        qrCodeValue: qrClean,
        nama: namaClean,
        jenjang: targetClass.jenjang,
        kelasId: targetClass.id,
        kelasNama: targetClass.namaKelas,
        namaWali: formWali.trim() || `Wali ${namaClean}`,
        noWaWali: formNoWa.trim() || null,
        statusHariIni: 'Belum Scan',
        jamMasuk: null,
        jamPulang: null,
      };
      onAddStudent?.(created);
    }

    setFormModalOpen(false);
  };

  const handleConfirmImport = (imported: StudentRecord[]) => {
    onImportStudents?.(imported);
    setLastImportedBatch(imported);
  };

  return (
    <div className="space-y-5">
      <PageBanner
        title={scopedClassName ? `Data Siswa ${scopedClassName}` : 'Data Siswa TKIT & SDIT'}
        description="Kelola daftar siswa, tambah siswa manual atau via Import Excel, tampilkan kartu QR individu, dan cetak nametag QR."
      />

      {lastImportedBatch && lastImportedBatch.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          <div className="flex items-start sm:items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              Berhasil mengimpor <strong>{lastImportedBatch.length} siswa</strong> ke database sekolah.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canPrintNametags && (
              <button
                type="button"
                onClick={() =>
                  onPrintStudents(
                    lastImportedBatch,
                    `Kartu Nametag QR Siswa Impor (${lastImportedBatch.length} Siswa)`
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Kartu Hasil Impor</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setLastImportedBatch(null)}
              className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {!scopedClassId ? (
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start">
              {(['Semua', 'TK', 'SD'] as const).map((jenjang) => (
                <button
                  key={jenjang}
                  type="button"
                  onClick={() => {
                    setJenjangFilter(jenjang);
                    setKelasFilter('Semua');
                  }}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap min-h-[36px] ${
                    jenjangFilter === jenjang
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {jenjang === 'Semua' ? 'Semua Jenjang' : `Jenjang ${jenjang}`}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs font-semibold text-blue-700">
              Rombel Binaan: {scopedClassName} ({students.length} Siswa)
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {canImportStudents && onAddStudent && (
              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Siswa</span>
              </button>
            )}

            {canImportStudents && onImportStudents && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs sm:text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap min-h-[44px]"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Import Excel</span>
              </button>
            )}

            {canPrintNametags && (
              <button
                type="button"
                disabled={filteredStudents.length === 0}
                onClick={() =>
                  onPrintStudents(
                    filteredStudents,
                    `Cetak Kartu Nametag QR (${filteredStudents.length} Siswa)`
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap min-h-[44px]"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak {filteredStudents.length} Kartu QR</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Class Select */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama siswa, NIS, atau kode QR..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none min-h-[44px]"
            />
          </div>

          <select
            aria-label="Filter Kelas"
            disabled={!!scopedClassId}
            value={scopedClassId || kelasFilter}
            onChange={(e) => setKelasFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 min-h-[44px]"
          >
            {!scopedClassId && <option value="Semua">Semua Kelas</option>}
            {visibleClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.namaKelas}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-5">NIS &amp; QR</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Jenjang / Kelas</th>
                <th className="py-3 px-4">Wali Murid</th>
                <th className="py-3 px-4">Status Hari Ini</th>
                <th className="py-3 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      {students.length === 0
                        ? 'Belum ada data siswa terdaftar'
                        : 'Tidak ada siswa yang cocok dengan filter'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {students.length === 0
                        ? 'Tambahkan siswa secara manual atau unggah daftar siswa menggunakan file Excel.'
                        : 'Ubah kata kunci pencarian atau filter kelas di atas.'}
                    </p>
                    {students.length === 0 && canImportStudents && onAddStudent && (
                      <div className="mt-4 flex items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={openAddForm}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Siswa Pertama</span>
                        </button>
                        {onImportStudents && (
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
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5">
                      <button
                        type="button"
                        onClick={() => setSelectedQrStudentId(student.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5 text-blue-600" />
                        <span>{student.nis}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{student.nama}</p>
                      <p className="text-xs font-mono text-slate-400">{student.qrCodeValue}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">{student.jenjang}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span>{student.kelasNama}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <span>{student.namaWali}</span>
                      {student.noWaWali && (
                        <span className="block font-mono text-[11px] text-slate-400">
                          {student.noWaWali}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={student.statusHariIni} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedQrStudentId(student.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                        >
                          <QrCode className="w-3.5 h-3.5 text-blue-600" />
                          <span>Kartu QR</span>
                        </button>
                        {canSendWeeklyFeedback && onOpenWeeklyFeedback && (
                          <button
                            type="button"
                            onClick={() => onOpenWeeklyFeedback(student)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </button>
                        )}
                        {canPrintNametags && (
                          <button
                            type="button"
                            onClick={() =>
                              onPrintStudents([student], `Kartu Nametag QR — ${student.nama}`)
                            }
                            title="Cetak kartu nametag"
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak</span>
                          </button>
                        )}
                        {canImportStudents && onUpdateStudent && (
                          <button
                            type="button"
                            onClick={() => openEditForm(student)}
                            aria-label={`Ubah data ${student.nama}`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canImportStudents && onDeleteStudent && (
                          confirmDeleteId === student.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteStudent(student.id);
                                setConfirmDeleteId(null);
                              }}
                              className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700"
                            >
                              Hapus?
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(student.id)}
                              aria-label={`Hapus ${student.nama}`}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {filteredStudents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center space-y-3">
            <p className="text-xs text-slate-500">
              {students.length === 0
                ? 'Belum ada data siswa terdaftar.'
                : 'Tidak ada siswa yang cocok dengan filter saat ini.'}
            </p>
            {students.length === 0 && canImportStudents && onAddStudent && (
              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa</span>
              </button>
            )}
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div
              key={student.id}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {student.nama}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {student.jenjang} · {student.kelasNama}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    {student.nis}
                  </p>
                </div>
                <StatusText status={student.statusHariIni} />
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedQrStudentId(student.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 min-h-[44px]"
                >
                  <QrCode className="w-4 h-4 text-blue-600" />
                  <span>Kartu QR</span>
                </button>
                {canSendWeeklyFeedback && onOpenWeeklyFeedback && (
                  <button
                    type="button"
                    onClick={() => onOpenWeeklyFeedback(student)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 min-h-[44px]"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WA</span>
                  </button>
                )}
                {canPrintNametags && (
                  <button
                    type="button"
                    onClick={() =>
                      onPrintStudents([student], `Kartu Nametag QR — ${student.nama}`)
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white min-h-[44px]"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak</span>
                  </button>
                )}
                {canImportStudents && onUpdateStudent && (
                  <button
                    type="button"
                    onClick={() => openEditForm(student)}
                    aria-label={`Edit ${student.nama}`}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 min-h-[44px]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                {canImportStudents && onDeleteStudent && (
                  confirmDeleteId === student.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteStudent(student.id);
                        setConfirmDeleteId(null);
                      }}
                      className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 min-h-[44px]"
                    >
                      Hapus?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(student.id)}
                      aria-label={`Hapus ${student.nama}`}
                      className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 min-h-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {formModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentForm} className="p-5 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIS / Kode Siswa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNis}
                    onChange={(e) => setFormNis(e.target.value)}
                    placeholder="Contoh: 2026SD001"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode QR (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formQr}
                    onChange={(e) => setFormQr(e.target.value)}
                    placeholder="Otomatis jika dikosongkan"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none min-h-[42px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Masukkan nama lengkap siswa"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none min-h-[42px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kelas *
                </label>
                <select
                  value={formKelasId}
                  disabled={!!scopedClassId}
                  onChange={(e) => setFormKelasId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 min-h-[42px]"
                >
                  {(scopedClassId ? visibleClasses : classes).map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.jenjang} · {cls.namaKelas}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Orang Tua / Wali
                  </label>
                  <input
                    type="text"
                    value={formWali}
                    onChange={(e) => setFormWali(e.target.value)}
                    placeholder="Nama ayah / ibu / wali"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp Wali
                  </label>
                  <input
                    type="tel"
                    value={formNoWa}
                    onChange={(e) => setFormNoWa(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none min-h-[42px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[42px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 min-h-[42px]"
                >
                  {editingStudent ? 'Simpan Perubahan' : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Single Student QR Card (by student.id) */}
      {selectedQrStudentId && (
        <StudentQRCard
          studentId={selectedQrStudentId}
          students={allStudents ?? students}
          canPrintNametags={canPrintNametags}
          onSelectStudentId={setSelectedQrStudentId}
          onPrintStudent={(target) => {
            setSelectedQrStudentId(null);
            onPrintStudents([target], `Kartu Nametag QR — ${target.nama}`);
          }}
          onClose={() => setSelectedQrStudentId(null)}
        />
      )}

      {/* Excel Import Modal */}
      {isImportModalOpen && canImportStudents && onImportStudents && (
        <StudentImportModal
          existingStudents={allStudents ?? students}
          classes={scopedClassId ? visibleClasses : classes}
          scopedClassName={scopedClassName}
          onImportStudents={handleConfirmImport}
          onClose={() => setIsImportModalOpen(false)}
        />
      )}
    </div>
  );
};
