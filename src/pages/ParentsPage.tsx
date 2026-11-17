import React, { useMemo, useState } from 'react';
import { MessageCircle, Plus, Search, Trash2, UserCheck, X } from 'lucide-react';
import type { ParentRecord, StudentRecord } from '../types/attendance';
import { PageBanner } from '../components/PageBanner';

interface ParentsPageProps {
  parents: ParentRecord[];
  students: StudentRecord[];
  canSendWeeklyFeedback?: boolean;
  canManageParents?: boolean;
  onOpenWeeklyFeedback?: (student: StudentRecord) => void;
  onAddParent?: (parent: ParentRecord) => void;
  onToggleParentStatus?: (parentId: string) => void;
  onDeleteParent?: (parentId: string) => void;
}

export const ParentsPage: React.FC<ParentsPageProps> = ({
  parents,
  students,
  canSendWeeklyFeedback = false,
  canManageParents = false,
  onOpenWeeklyFeedback,
  onAddParent,
  onToggleParentStatus,
  onDeleteParent,
}) => {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [namaWali, setNamaWali] = useState('');
  const [hubungan, setHubungan] = useState<'Ayah' | 'Ibu' | 'Wali'>('Ibu');
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const [noWa, setNoWa] = useState('');
  const [izinPenjemputan, setIzinPenjemputan] = useState<'Terverifikasi' | 'Menunggu Verifikasi'>(
    'Terverifikasi'
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const effectiveStudentId = studentId || students[0]?.id || '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parents.filter(
      (p) =>
        !q ||
        p.namaWali.toLowerCase().includes(q) ||
        p.siswaTerhubungNama.toLowerCase().includes(q) ||
        p.kodeWali.toLowerCase().includes(q)
    );
  }, [parents, search]);

  const handleOpenAdd = () => {
    setNamaWali('');
    setHubungan('Ibu');
    setStudentId(students[0]?.id ?? '');
    setNoWa('');
    setIzinPenjemputan('Terverifikasi');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveParent = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!namaWali.trim()) {
      setFormError('Nama orang tua / wali wajib diisi.');
      return;
    }
    const targetStudent = students.find((s) => s.id === effectiveStudentId);
    if (!targetStudent) {
      setFormError('Pilih siswa yang terhubung dengan wali murid ini.');
      return;
    }

    const created: ParentRecord = {
      id: `prt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kodeWali: `WALI-${String(parents.length + 1).padStart(3, '0')}`,
      namaWali: namaWali.trim(),
      hubungan,
      siswaTerhubungNama: targetStudent.nama,
      kelasNama: targetStudent.kelasNama,
      noWa: noWa.trim() || targetStudent.noWaWali || null,
      izinPenjemputan,
    };

    onAddParent?.(created);
    setFormOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageBanner
        title="Data Orang Tua / Wali Murid"
        description="Relasi wali murid untuk verifikasi penjemputan gerbang pulang dan pengiriman laporan kehadiran mingguan via WhatsApp."
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Menampilkan <strong className="text-slate-900 tabular-nums">{filtered.length}</strong> data wali murid
        </p>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama wali atau siswa..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none min-h-[40px]"
            />
          </div>

          {canManageParents && onAddParent && (
            <button
              type="button"
              disabled={students.length === 0}
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 min-h-[40px] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Wali</span>
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-5">Kode Wali</th>
                <th className="py-3 px-4">Nama Wali</th>
                <th className="py-3 px-4">Hubungan</th>
                <th className="py-3 px-4">Siswa Terhubung</th>
                <th className="py-3 px-4">Izin Penjemputan</th>
                <th className="py-3 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-xs text-slate-500">
                    {students.length === 0
                      ? 'Tambahkan data siswa terlebih dahulu untuk menghubungkan wali murid.'
                      : 'Belum ada data wali murid tambahan yang terdaftar.'}
                  </td>
                </tr>
              ) : (
                filtered.map((parent) => {
                  const linkedStudent = students.find(
                    (s) => s.nama.toLowerCase() === parent.siswaTerhubungNama.toLowerCase()
                  );
                  return (
                    <tr key={parent.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-600">
                        {parent.kodeWali}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-900">{parent.namaWali}</span>
                            {parent.noWa && (
                              <p className="text-[11px] font-mono text-slate-400">{parent.noWa}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">{parent.hubungan}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <span className="font-medium text-slate-900">{parent.siswaTerhubungNama}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-slate-500">{parent.kelasNama}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        {canManageParents && onToggleParentStatus ? (
                          <button
                            type="button"
                            onClick={() => onToggleParentStatus(parent.id)}
                            className={`hover:underline ${
                              parent.izinPenjemputan === 'Terverifikasi'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {parent.izinPenjemputan}
                          </button>
                        ) : (
                          <span
                            className={
                              parent.izinPenjemputan === 'Terverifikasi'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }
                          >
                            {parent.izinPenjemputan}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canSendWeeklyFeedback && onOpenWeeklyFeedback && linkedStudent && (
                            <button
                              type="button"
                              onClick={() => onOpenWeeklyFeedback(linkedStudent)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Laporan WA</span>
                            </button>
                          )}
                          {canManageParents && onDeleteParent && (
                            confirmDeleteId === parent.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteParent(parent.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700"
                              >
                                Hapus?
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(parent.id)}
                                aria-label={`Hapus ${parent.namaWali}`}
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">Tambah Data Orang Tua / Wali</h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveParent} className="p-5 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Orang Tua / Wali *
                </label>
                <input
                  type="text"
                  required
                  value={namaWali}
                  onChange={(e) => setNamaWali(e.target.value)}
                  placeholder="Masukkan nama wali murid"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[42px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hubungan
                  </label>
                  <select
                    value={hubungan}
                    onChange={(e) => setHubungan(e.target.value as 'Ayah' | 'Ibu' | 'Wali')}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[42px]"
                  >
                    <option value="Ibu">Ibu</option>
                    <option value="Ayah">Ayah</option>
                    <option value="Wali">Wali</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Penjemputan
                  </label>
                  <select
                    value={izinPenjemputan}
                    onChange={(e) =>
                      setIzinPenjemputan(
                        e.target.value as 'Terverifikasi' | 'Menunggu Verifikasi'
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[42px]"
                  >
                    <option value="Terverifikasi">Terverifikasi</option>
                    <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Siswa Terhubung *
                </label>
                <select
                  value={effectiveStudentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[42px]"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} — {s.kelasNama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  type="tel"
                  value={noWa}
                  onChange={(e) => setNoWa(e.target.value)}
                  placeholder="0812..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
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
                  Simpan Wali Murid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
