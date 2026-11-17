import React, { useState } from 'react';
import { Edit3, Plus, Printer, School, Trash2, Users, X } from 'lucide-react';
import type { ClassRoomRecord, Jenjang, StudentRecord } from '../types/attendance';
import { PageBanner } from '../components/PageBanner';

interface ClassesPageProps {
  classes: ClassRoomRecord[];
  students: StudentRecord[];
  canPrintNametags?: boolean;
  canManageClasses?: boolean;
  onPrintStudents: (targetStudents: StudentRecord[], title: string) => void;
  onAddClass?: (cls: ClassRoomRecord) => void;
  onUpdateClass?: (cls: ClassRoomRecord) => void;
  onDeleteClass?: (classId: string) => void;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({
  classes,
  students,
  canPrintNametags = true,
  canManageClasses = false,
  onPrintStudents,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
}) => {
  const [jenjangFilter, setJenjangFilter] = useState<'Semua' | Jenjang>('Semua');
  const [formOpen, setFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoomRecord | null>(null);
  const [kodeKelas, setKodeKelas] = useState('');
  const [namaKelas, setNamaKelas] = useState('');
  const [jenjang, setJenjang] = useState<Jenjang>('SD');
  const [tingkat, setTingkat] = useState('Kelas 1');
  const [waliKelasNama, setWaliKelasNama] = useState('');
  const [kapasitas, setKapasitas] = useState('28');
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = classes.filter(
    (cls) => jenjangFilter === 'Semua' || cls.jenjang === jenjangFilter
  );

  const openAdd = () => {
    setEditingClass(null);
    setKodeKelas('');
    setNamaKelas('');
    setJenjang('SD');
    setTingkat('Kelas 1');
    setWaliKelasNama('');
    setKapasitas('28');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (cls: ClassRoomRecord) => {
    setEditingClass(cls);
    setKodeKelas(cls.kodeKelas);
    setNamaKelas(cls.namaKelas);
    setJenjang(cls.jenjang);
    setTingkat(cls.tingkat);
    setWaliKelasNama(cls.waliKelasNama);
    setKapasitas(String(cls.kapasitas));
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const kode = kodeKelas.trim().toUpperCase();
    const nama = namaKelas.trim();
    const kap = Number(kapasitas) || 25;

    if (!kode || !nama) {
      setFormError('Kode kelas dan nama kelas wajib diisi.');
      return;
    }

    const dup = classes.some(
      (c) =>
        c.id !== editingClass?.id &&
        (c.kodeKelas.toLowerCase() === kode.toLowerCase() ||
          c.namaKelas.toLowerCase() === nama.toLowerCase())
    );
    if (dup) {
      setFormError('Kode kelas atau nama kelas sudah terdaftar.');
      return;
    }

    if (editingClass) {
      onUpdateClass?.({
        ...editingClass,
        kodeKelas: kode,
        namaKelas: nama,
        jenjang,
        tingkat: tingkat.trim() || '-',
        waliKelasNama: waliKelasNama.trim() || `Wali Kelas ${kode}`,
        kapasitas: kap,
      });
    } else {
      const created: ClassRoomRecord = {
        id: `kls-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        kodeKelas: kode,
        namaKelas: nama,
        jenjang,
        tingkat: tingkat.trim() || '-',
        waliKelasNama: waliKelasNama.trim() || `Wali Kelas ${kode}`,
        kapasitas: kap,
      };
      onAddClass?.(created);
    }

    setFormOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageBanner
        title="Data Kelas & Rombongan Belajar"
        description="Struktur rombongan belajar jenjang TKIT dan SDIT lengkap dengan wali kelas, kapasitas, dan cetak kartu QR per kelas."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
          {(['Semua', 'TK', 'SD'] as const).map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => setJenjangFilter(j)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors min-h-[36px] ${
                jenjangFilter === j
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {j === 'Semua' ? 'Semua Rombel' : `Jenjang ${j}`}
            </button>
          ))}
        </div>

        {canManageClasses && onAddClass && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 transition-colors min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kelas</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cls) => {
          const classStudents = students.filter((s) => s.kelasId === cls.id);
          return (
            <div
              key={cls.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono font-medium text-blue-700">
                      {cls.kodeKelas} · {cls.jenjang}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">
                      {cls.namaKelas}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canManageClasses && onUpdateClass && (
                      <button
                        type="button"
                        onClick={() => openEdit(cls)}
                        aria-label={`Edit kelas ${cls.namaKelas}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-blue-700 hover:bg-slate-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canManageClasses && onDeleteClass && classStudents.length === 0 && (
                      <button
                        type="button"
                        onClick={() => onDeleteClass(cls.id)}
                        aria-label={`Hapus kelas ${cls.namaKelas}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <School className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <p>
                    Tingkat: <strong className="text-slate-900">{cls.tingkat}</strong>
                  </p>
                  <p>
                    Wali Kelas: <strong className="text-slate-900">{cls.waliKelasNama}</strong>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Siswa: <strong className="font-mono text-slate-900 tabular-nums">{classStudents.length}</strong> / kapasitas{' '}
                      <span className="font-mono tabular-nums">{cls.kapasitas}</span>
                    </span>
                  </p>
                </div>
              </div>

              {canPrintNametags && (
                <div className="mt-5 pt-3.5 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={classStudents.length === 0}
                    onClick={() =>
                      onPrintStudents(classStudents, `Kartu Nametag QR — ${cls.namaKelas}`)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors min-h-[40px]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Kartu Kelas Ini</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {formOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {editingClass ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    value={kodeKelas}
                    onChange={(e) => setKodeKelas(e.target.value)}
                    placeholder="Contoh: SD1B"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenjang *
                  </label>
                  <select
                    value={jenjang}
                    onChange={(e) => setJenjang(e.target.value as Jenjang)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[42px]"
                  >
                    <option value="TK">TK</option>
                    <option value="SD">SD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Kelas *
                </label>
                <input
                  type="text"
                  required
                  value={namaKelas}
                  onChange={(e) => setNamaKelas(e.target.value)}
                  placeholder="Contoh: SD 1B - Fathonah"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[42px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tingkat
                  </label>
                  <input
                    type="text"
                    value={tingkat}
                    onChange={(e) => setTingkat(e.target.value)}
                    placeholder="Kelas 1 / Kelompok A"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kapasitas
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={kapasitas}
                    onChange={(e) => setKapasitas(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono min-h-[42px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Wali Kelas
                </label>
                <input
                  type="text"
                  value={waliKelasNama}
                  onChange={(e) => setWaliKelasNama(e.target.value)}
                  placeholder="Nama wali kelas pembina"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[42px]"
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
                  {editingClass ? 'Simpan Perubahan' : 'Simpan Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
