import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import type { ClassRoomRecord, TeacherRecord } from '../types/attendance';
import {
  downloadCurrentTeachersWorkbook,
  downloadTeacherTemplateWorkbook,
  parseTeacherRecords,
  type ParsedTeacherRow,
} from '../utils/excelImportUtils';

interface TeacherImportModalProps {
  existingTeachers: TeacherRecord[];
  classes: ClassRoomRecord[];
  onImportTeachers: (newTeachers: TeacherRecord[]) => void;
  onClose: () => void;
}

export const TeacherImportModal: React.FC<TeacherImportModalProps> = ({
  existingTeachers,
  classes,
  onImportTeachers,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceName, setSourceName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTeacherRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelected = async (file: File) => {
    try {
      setParseError(null);
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      const relevantSheets = workbook.SheetNames.filter((name) => {
        const lower = name.toLowerCase();
        return !lower.includes('referensi') && !lower.includes('panduan') && !lower.includes('siswa');
      });

      const targetSheets =
        relevantSheets.length > 0 ? relevantSheets : workbook.SheetNames.slice(0, 1);

      if (targetSheets.length === 0) {
        setParseError('Workbook Excel tidak memiliki sheet yang dapat dibaca.');
        return;
      }

      const combinedRows: ParsedTeacherRow[] = [];
      let runningExisting = [...existingTeachers];

      for (const sheetName of targetSheets) {
        const ws = workbook.Sheets[sheetName];
        const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        const lower = sheetName.toLowerCase();
        const defaultCategory =
          lower.includes('kepala') || lower.includes('kepsek') || lower.includes('principal')
            ? 'Kepala Sekolah'
            : 'Guru';

        const parsed = parseTeacherRecords(records, {
          existingTeachers: runningExisting,
          classes,
          defaultCategory,
        });
        combinedRows.push(...parsed);

        const validBatch = parsed
          .map((r) => r.teacherPayload)
          .filter((item): item is TeacherRecord => item !== null);
        runningExisting = [...runningExisting, ...validBatch];
      }

      if (combinedRows.length === 0) {
        setParsedRows([]);
        setParseError('Sheet Excel tidak memiliki baris data guru atau kepala sekolah.');
        return;
      }

      setSourceName(file.name);
      setParsedRows(combinedRows);
    } catch {
      setParseError(
        'Gagal membaca file Excel. Pastikan format file valid (.xlsx, .xls, atau .csv).'
      );
      setParsedRows([]);
    }
  };

  const validTeachers = useMemo(
    () =>
      parsedRows
        .map((r) => r.teacherPayload)
        .filter((item): item is TeacherRecord => item !== null),
    [parsedRows]
  );

  const validPrincipalCount = useMemo(
    () => validTeachers.filter((t) => t.kategoriPeran === 'Kepala Sekolah').length,
    [validTeachers]
  );
  const validTeacherCount = validTeachers.length - validPrincipalCount;
  const invalidCount = parsedRows.length - validTeachers.length;

  const handleConfirmImport = () => {
    if (validTeachers.length === 0) return;
    onImportTeachers(validTeachers);
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 sm:p-4">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">
                Import Excel Data Guru &amp; Kepala Sekolah
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Impor daftar Kepala Sekolah, Wali Kelas, Guru Kelas, dan Guru Piket secara massal dari Excel.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal import guru dan kepala sekolah"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step 1: Template & Column Guide */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-blue-700">
                  LANGKAH 1 · FORMAT KOLOM EXCEL GURU &amp; KEPALA SEKOLAH
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Isi kolom <span className="font-mono font-semibold text-slate-800">JABATAN</span>{' '}
                  dengan <span className="font-semibold text-slate-800">Kepala Sekolah</span> untuk
                  kepala sekolah, atau <span className="font-semibold text-slate-800">Wali Kelas / Guru Piket</span> untuk guru.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void downloadTeacherTemplateWorkbook(existingTeachers, classes)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors min-h-[40px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel (.xlsx)</span>
                </button>
                {existingTeachers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void downloadCurrentTeachersWorkbook(existingTeachers)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[40px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor Data Saat Ini (.xlsx)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[11px]">
              {[
                { col: 'KODE_GURU', desc: 'Opsional · Unik' },
                { col: 'NAMA_LENGKAP', desc: 'Wajib' },
                { col: 'JABATAN', desc: 'Kepsek / Guru' },
                { col: 'JENJANG', desc: 'TK / SD / TK & SD' },
                { col: 'WALI_KELAS', desc: 'Opsional' },
                { col: 'EMAIL', desc: 'Opsional' },
                { col: 'NO_HP', desc: 'Opsional' },
                { col: 'STATUS', desc: 'Aktif / Cuti' },
              ].map((item) => (
                <div
                  key={item.col}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                >
                  <p className="font-mono font-semibold text-slate-900 truncate" title={item.col}>
                    {item.col}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Upload Dropzone */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">
              LANGKAH 2 · UNGGAH FILE EXCEL (.XLSX / .XLS / .CSV)
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
                accept=".xlsx,.xls,.csv"
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
                  ? `File dipilih: ${sourceName}`
                  : 'Pilih atau seret file Excel Guru & Kepala Sekolah ke area ini'}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Mendukung file single-sheet maupun workbook multi-sheet (<span className="font-mono">Guru</span> &amp;{' '}
                <span className="font-mono">Kepala_Sekolah</span>).
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors min-h-[40px]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih File Excel</span>
              </button>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* Step 3: Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-700">
                  LANGKAH 3 · PRATINJAU &amp; VALIDASI DATA ({parsedRows.length} BARIS)
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 tabular-nums">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {validTeachers.length} Siap Diimpor ({validPrincipalCount} Kepsek · {validTeacherCount} Guru)
                  </span>
                  {invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 tabular-nums">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {invalidCount} Perlu Diperbaiki
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[260px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Baris</th>
                        <th className="py-2.5 px-3">Kode / NIP</th>
                        <th className="py-2.5 px-3">Nama Lengkap</th>
                        <th className="py-2.5 px-3">Peran &amp; Jabatan</th>
                        <th className="py-2.5 px-3">Jenjang / Wali Kelas</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {parsedRows.map((row, i) => (
                        <tr
                          key={`${row.rowNumber}-${row.kodeGuru}-${i}`}
                          className={row.errors.length > 0 ? 'bg-rose-50/40' : 'bg-white'}
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">
                            #{row.rowNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                            {row.kodeGuru || '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-900">{row.nama || '-'}</p>
                            {row.emailOpsional && (
                              <p className="text-[11px] text-slate-400">{row.emailOpsional}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {row.kategoriPeran === 'Kepala Sekolah' && (
                                <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              )}
                              <span
                                className={
                                  row.kategoriPeran === 'Kepala Sekolah'
                                    ? 'font-semibold text-amber-800'
                                    : 'font-medium text-slate-800'
                                }
                              >
                                {row.jabatan}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">{row.kategoriPeran}</p>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            <span className="font-semibold text-slate-900">{row.jenjang}</span>
                            {row.waliKelasNama ? ` · ${row.waliKelasNama}` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-700 font-medium">
                            {row.statusAktif}
                          </td>
                          <td className="py-2.5 px-3">
                            {row.errors.length === 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Valid
                              </span>
                            ) : (
                              <span className="text-rose-700 font-medium">
                                {row.errors.join('; ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <p className="text-[11px] text-slate-500">
            Catatan: Jika <span className="font-mono">KODE_GURU</span> dikosongkan, sistem membuat kode otomatis.
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
              disabled={validTeachers.length === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[42px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Impor {validTeachers.length} Guru &amp; Kepsek</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
