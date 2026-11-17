import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import type { ClassRoomRecord, StudentRecord } from '../types/attendance';
import {
  downloadCurrentStudentsWorkbook,
  downloadStudentTemplateWorkbook,
  parseStudentRecords,
  type ParsedStudentRow,
} from '../utils/excelImportUtils';
import { StatusText } from './StatusText';

interface StudentImportModalProps {
  existingStudents: StudentRecord[];
  classes: ClassRoomRecord[];
  scopedClassName?: string | null;
  onImportStudents: (newStudents: StudentRecord[]) => void;
  onClose: () => void;
}

export const StudentImportModal: React.FC<StudentImportModalProps> = ({
  existingStudents,
  classes,
  scopedClassName,
  onImportStudents,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceName, setSourceName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const processRawRecords = (records: Record<string, unknown>[], fileLabel: string) => {
    setParseError(null);
    setSourceName(fileLabel);

    const evaluated = parseStudentRecords(records, {
      existingStudents,
      classes,
      scopedClassName,
    });

    if (evaluated.length === 0) {
      setParsedRows([]);
      setParseError(
        'File tidak memiliki baris data siswa. Pastikan baris header sesuai dengan template.'
      );
      return;
    }

    setParsedRows(evaluated);
  };

  const handleFileSelected = async (file: File) => {
    try {
      setParseError(null);
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const preferredSheet =
        workbook.SheetNames.find((n) => n.toLowerCase().includes('siswa')) ??
        workbook.SheetNames[0];
      if (!preferredSheet) {
        setParseError('Workbook Excel tidak memiliki sheet.');
        return;
      }
      const worksheet = workbook.Sheets[preferredSheet];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
      });
      processRawRecords(records, file.name);
    } catch {
      setParseError(
        'Gagal membaca file Excel. Pastikan format file valid (.xlsx, .xls, atau .csv).'
      );
      setParsedRows([]);
    }
  };

  const handleDownloadTemplate = async () => {
    await downloadStudentTemplateWorkbook(existingStudents, classes);
  };

  const handleDownloadCurrentList = async () => {
    await downloadCurrentStudentsWorkbook(existingStudents);
  };

  const validStudents = useMemo(
    () =>
      parsedRows
        .map((r) => r.studentPayload)
        .filter((item): item is StudentRecord => item !== null),
    [parsedRows]
  );

  const invalidCount = parsedRows.length - validStudents.length;

  const handleConfirmImport = () => {
    if (validStudents.length === 0) return;
    onImportStudents(validStudents);
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 sm:p-4">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">
                Import Excel Data Siswa
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Struktur kolom disesuaikan dengan daftar siswa sekolah ({scopedClassName || 'Semua Kelas TK & SD'}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal import Excel"
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
                  LANGKAH 1 · FORMAT KOLOM EXCEL
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Gunakan nama kelas persis seperti di aplikasi atau kode kelas (lihat sheet{' '}
                  <span className="font-mono font-semibold text-slate-800">Referensi_Kelas</span> pada file template).
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleDownloadTemplate()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors min-h-[40px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel (.xlsx)</span>
                </button>
                {existingStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadCurrentList()}
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
                { col: 'NIS', desc: 'Wajib · Unik' },
                { col: 'KODE_QR', desc: 'Opsional · Unik' },
                { col: 'NAMA_SISWA', desc: 'Wajib' },
                { col: 'JENJANG', desc: 'TK / SD' },
                { col: 'KELAS', desc: 'Nama / Kode Kelas' },
                { col: 'WALI_MURID', desc: 'Opsional' },
                { col: 'NO_WA_WALI', desc: 'Opsional' },
                { col: 'STATUS_HARI_INI', desc: 'Default: Belum Scan' },
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
                {sourceName ? `File dipilih: ${sourceName}` : 'Pilih atau seret file Excel ke area ini'}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Mendukung format <span className="font-mono">.xlsx</span>,{' '}
                <span className="font-mono">.xls</span>, dan <span className="font-mono">.csv</span>.
                Data langsung tersimpan ke database sekolah.
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
                <div className="flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 tabular-nums">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {validStudents.length} Siap Diimpor
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
                        <th className="py-2.5 px-3">NIS &amp; Kode QR</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">Jenjang / Kelas</th>
                        <th className="py-2.5 px-3">Wali Murid</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {parsedRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={row.errors.length > 0 ? 'bg-rose-50/40' : 'bg-white'}
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">
                            #{row.rowNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-mono font-semibold text-slate-900">
                              {row.nis || '-'}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400">
                              {row.qrCodeValue || '-'}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {row.nama || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {row.resolvedClass ? (
                              <span>
                                <strong className="text-slate-900">
                                  {row.resolvedClass.jenjang}
                                </strong>{' '}
                                · {row.resolvedClass.namaKelas}
                              </span>
                            ) : (
                              <span className="text-rose-700">{row.kelasInput}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {row.namaWali || '-'}
                            {row.noWaWali && (
                              <span className="block text-[10px] font-mono text-slate-400">
                                {row.noWaWali}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusText status={row.statusHariIni} />
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
            Data valid akan langsung tersimpan dan siap cetak nametag QR maupun absensi gerbang/kelas.
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
              disabled={validStudents.length === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[42px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Impor {validStudents.length} Siswa ke Daftar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
