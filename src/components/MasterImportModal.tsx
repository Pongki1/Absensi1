import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Shield,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { ClassRoomRecord, StudentRecord, TeacherRecord } from '../types/attendance';
import {
  downloadMasterTemplateWorkbook,
  parseMasterWorkbookFile,
  type ParsedStudentRow,
  type ParsedTeacherRow,
} from '../utils/excelImportUtils';
import { StatusText } from './StatusText';

interface MasterImportModalProps {
  existingStudents: StudentRecord[];
  existingTeachers: TeacherRecord[];
  classes: ClassRoomRecord[];
  onImportMaster: (payload: {
    students: StudentRecord[];
    teachers: TeacherRecord[];
  }) => void;
  onClose: () => void;
}

type ActiveTab = 'siswa' | 'guru' | 'kepsek';

export const MasterImportModal: React.FC<MasterImportModalProps> = ({
  existingStudents,
  existingTeachers,
  classes,
  onImportMaster,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceName, setSourceName] = useState<string>('');
  const [detectedSheets, setDetectedSheets] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [studentRows, setStudentRows] = useState<ParsedStudentRow[]>([]);
  const [teacherRows, setTeacherRows] = useState<ParsedTeacherRow[]>([]);
  const [principalRows, setPrincipalRows] = useState<ParsedTeacherRow[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('siswa');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelected = async (file: File) => {
    try {
      setParseError(null);
      const result = await parseMasterWorkbookFile(file, {
        existingStudents,
        existingTeachers,
        classes,
      });

      setSourceName(file.name);
      setDetectedSheets(result.detectedSheets);
      setStudentRows(result.studentRows);
      setTeacherRows(result.teacherRows);
      setPrincipalRows(result.principalRows);

      if (
        result.studentRows.length === 0 &&
        result.teacherRows.length === 0 &&
        result.principalRows.length === 0
      ) {
        setParseError(
          'Tidak ada data Siswa, Guru, atau Kepala Sekolah yang terbaca. Gunakan Template Master 3 Sheet agar nama sheet & header sesuai.'
        );
        return;
      }

      if (result.studentRows.length > 0) setActiveTab('siswa');
      else if (result.teacherRows.length > 0) setActiveTab('guru');
      else setActiveTab('kepsek');
    } catch {
      setParseError(
        'Gagal membaca workbook Excel. Pastikan format file valid (.xlsx atau .xls).'
      );
    }
  };

  const validStudents = useMemo(
    () =>
      studentRows
        .map((r) => r.studentPayload)
        .filter((item): item is StudentRecord => item !== null),
    [studentRows]
  );

  const validTeachers = useMemo(
    () =>
      teacherRows
        .map((r) => r.teacherPayload)
        .filter((item): item is TeacherRecord => item !== null),
    [teacherRows]
  );

  const validPrincipals = useMemo(
    () =>
      principalRows
        .map((r) => r.teacherPayload)
        .filter((item): item is TeacherRecord => item !== null),
    [principalRows]
  );

  const totalValidCount = validStudents.length + validTeachers.length + validPrincipals.length;

  const handleConfirm = () => {
    if (totalValidCount === 0) return;
    onImportMaster({
      students: validStudents,
      teachers: [...validPrincipals, ...validTeachers],
    });
    onClose();
  };

  const activeTeacherPreviewRows = activeTab === 'guru' ? teacherRows : principalRows;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 sm:p-4">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">
                Import Excel Terpadu (Siswa, Guru &amp; Kepala Sekolah)
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Unggah satu file Excel berisi 3 sheet sekaligus untuk mempercepat pengisian data sekolah.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal import terpadu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step 1 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-blue-700">
                LANGKAH 1 · UNDUH TEMPLATE EXCEL MASTER (3 SHEET)
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Berisi sheet <span className="font-mono font-semibold text-slate-800">Siswa</span>,{' '}
                <span className="font-mono font-semibold text-slate-800">Guru</span>,{' '}
                <span className="font-mono font-semibold text-slate-800">Kepala_Sekolah</span>, serta{' '}
                <span className="font-mono font-semibold text-slate-800">Referensi_Kelas</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void downloadMasterTemplateWorkbook(existingStudents, existingTeachers, classes)
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shrink-0 min-h-[42px]"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Template Master (.xlsx)</span>
            </button>
          </div>

          {/* Step 2 */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">
              LANGKAH 2 · UNGGAH WORKBOOK EXCEL (.XLSX / .XLS)
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) void handleFileSelected(droppedFile);
              }}
              className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/70'
                  : 'border-slate-300 bg-white hover:border-blue-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) void handleFileSelected(selected);
                  e.target.value = '';
                }}
              />
              <Upload className="w-6 h-6 text-blue-600 mx-auto" />
              <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-800">
                {sourceName
                  ? `Workbook dimuat: ${sourceName}`
                  : 'Pilih atau seret file Excel Master ke area ini'}
              </p>
              {detectedSheets.length > 0 && (
                <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                  Sheet terbaca: {detectedSheets.join(' · ')}
                </p>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors min-h-[40px]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih Workbook Excel</span>
              </button>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* Step 3: Tabbed Preview */}
          {(studentRows.length > 0 || teacherRows.length > 0 || principalRows.length > 0) && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('siswa')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeTab === 'siswa'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Siswa ({validStudents.length}/{studentRows.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('guru')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeTab === 'guru'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Guru ({validTeachers.length}/{teacherRows.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kepsek')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeTab === 'kepsek'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Kepala Sekolah ({validPrincipals.length}/{principalRows.length})</span>
                  </button>
                </div>

                <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                  Total Siap Diimpor: {totalValidCount} Data
                </span>
              </div>

              {activeTab === 'siswa' ? (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[240px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Baris</th>
                          <th className="py-2.5 px-3">NIS &amp; QR</th>
                          <th className="py-2.5 px-3">Nama Siswa</th>
                          <th className="py-2.5 px-3">Jenjang / Kelas</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {studentRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              Tidak ada data pada sheet Siswa.
                            </td>
                          </tr>
                        ) : (
                          studentRows.map((row) => (
                            <tr
                              key={row.rowNumber}
                              className={row.errors.length > 0 ? 'bg-rose-50/40' : 'bg-white'}
                            >
                              <td className="py-2 px-3 font-mono text-slate-500">#{row.rowNumber}</td>
                              <td className="py-2 px-3 font-mono">
                                <span className="font-semibold text-slate-900">{row.nis || '-'}</span>
                                <span className="block text-[11px] text-slate-400">{row.qrCodeValue || '-'}</span>
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">{row.nama || '-'}</td>
                              <td className="py-2 px-3 text-slate-700">
                                {row.resolvedClass
                                  ? `${row.resolvedClass.jenjang} · ${row.resolvedClass.namaKelas}`
                                  : row.kelasInput}
                              </td>
                              <td className="py-2 px-3">
                                <StatusText status={row.statusHariIni} />
                              </td>
                              <td className="py-2 px-3">
                                {row.errors.length === 0 ? (
                                  <span className="text-emerald-700 font-semibold">Valid</span>
                                ) : (
                                  <span className="text-rose-700">{row.errors.join('; ')}</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[240px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Baris</th>
                          <th className="py-2.5 px-3">Kode / NIP</th>
                          <th className="py-2.5 px-3">Nama Lengkap</th>
                          <th className="py-2.5 px-3">Jabatan</th>
                          <th className="py-2.5 px-3">Jenjang / Kelas</th>
                          <th className="py-2.5 px-3">Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {activeTeacherPreviewRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              Tidak ada data pada tab ini.
                            </td>
                          </tr>
                        ) : (
                          activeTeacherPreviewRows.map((row, i) => (
                            <tr
                              key={`${row.rowNumber}-${row.kodeGuru}-${i}`}
                              className={row.errors.length > 0 ? 'bg-rose-50/40' : 'bg-white'}
                            >
                              <td className="py-2 px-3 font-mono text-slate-500">#{row.rowNumber}</td>
                              <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                                {row.kodeGuru || '-'}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {row.nama || '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{row.jabatan}</td>
                              <td className="py-2 px-3 text-slate-700">
                                {row.jenjang}
                                {row.waliKelasNama ? ` · ${row.waliKelasNama}` : ''}
                              </td>
                              <td className="py-2 px-3">
                                {row.errors.length === 0 ? (
                                  <span className="text-emerald-700 font-semibold">Valid</span>
                                ) : (
                                  <span className="text-rose-700">{row.errors.join('; ')}</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <p className="text-[11px] text-slate-500">
            Seluruh baris valid akan langsung tersimpan ke database Siswa, Guru, dan Kepala Sekolah.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[42px]"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={totalValidCount === 0}
              onClick={handleConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[42px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Impor {validStudents.length} Siswa &amp; {validTeachers.length + validPrincipals.length} Guru/Kepsek
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
