import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  MessageCircle,
  Printer,
  Share2,
  X,
} from 'lucide-react';
import type { StudentRecord } from '../types/attendance';
import { QRCodeImage } from './QRCodeImage';
import { StatusText } from './StatusText';

interface StudentQRCardProps {
  studentId: string;
  students: StudentRecord[];
  canPrintNametags?: boolean;
  onSelectStudentId: (id: string) => void;
  onPrintStudent?: (student: StudentRecord) => void;
  onClose: () => void;
}

async function generateShareableQRCardBlob(student: StudentRecord): Promise<Blob | null> {
  const width = 640;
  const height = 820;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1D4ED8';
  ctx.fillRect(0, 0, width, 136);

  ctx.fillStyle = '#10B981';
  ctx.fillRect(0, 136, width, 10);

  try {
    await new Promise<void>((resolve, reject) => {
      const logoImg = new Image();
      logoImg.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(40, 24, 88, 88, 16);
        ctx.fill();
        ctx.drawImage(logoImg, 46, 30, 76, 76);
        resolve();
      };
      logoImg.onerror = () => reject(new Error('Logo skip'));
      logoImg.src = '/assets/aistudio/logo_TKIT_1e974d49.png';
    });

    ctx.fillStyle = '#DBEAFE';
    ctx.font = '600 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SMART ABSENSI · KARTU QR SISWA', 148, 56);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 30px sans-serif';
    ctx.fillText("TKIT AL-I'ANAH", 148, 98);
  } catch {
    ctx.fillStyle = '#DBEAFE';
    ctx.font = '600 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SMART ABSENSI · KARTU QR SISWA', width / 2, 52);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 30px sans-serif';
    ctx.fillText("TKIT AL-I'ANAH", width / 2, 96);
  }

  const qrDataUrl = await QRCode.toDataURL(student.qrCodeValue, {
    width: 380,
    margin: 2,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.strokeRect(120, 184, 400, 400);
      ctx.drawImage(img, 130, 194, 380, 380);
      resolve();
    };
    img.onerror = () => reject(new Error('Gagal memuat gambar QR'));
    img.src = qrDataUrl;
  });

  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(student.qrCodeValue, width / 2, 622);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 28px sans-serif';
  ctx.fillText(student.nama, width / 2, 672);

  ctx.fillStyle = '#1D4ED8';
  ctx.font = '600 20px sans-serif';
  ctx.fillText(`${student.jenjang === 'TK' ? 'TKIT' : 'SDIT'} · ${student.kelasNama}`, width / 2, 710);

  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(64, 742);
  ctx.lineTo(width - 64, 742);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '500 18px sans-serif';
  ctx.fillText(`NIS: ${student.nis}  ·  Wali: ${student.namaWali}`, width / 2, 778);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export const StudentQRCard: React.FC<StudentQRCardProps> = ({
  studentId,
  students,
  canPrintNametags = true,
  onSelectStudentId,
  onPrintStudent,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [exportingPng, setExportingPng] = useState(false);

  const currentIndex = useMemo(
    () => students.findIndex((s) => s.id === studentId),
    [students, studentId]
  );

  const student = useMemo(
    () => (currentIndex >= 0 ? students[currentIndex] : null),
    [students, currentIndex]
  );

  useEffect(() => {
    setCopied(false);
    setShareFeedback(null);
  }, [studentId]);

  if (!student) {
    return (
      <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-4 shadow-2xl">
          <p className="text-sm font-semibold text-slate-900">
            Data siswa dengan ID tersebut tidak ditemukan.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < students.length - 1;

  const shareText = [
    `*KARTU QR ABSENSI — SMART ABSENSI TKIT AL-I'ANAH*`,
    `Nama Siswa: ${student.nama}`,
    `NIS: ${student.nis}`,
    `Jenjang / Kelas: ${student.jenjang === 'TK' ? 'TKIT' : 'SDIT'} · ${student.kelasNama}`,
    `Kode QR: ${student.qrCodeValue}`,
    `Wali Murid: ${student.namaWali}`,
  ].join('\n');

  const cleanWaDigits = (student.noWaWali ?? '').replace(/\D/g, '');
  const waTarget = cleanWaDigits.startsWith('0')
    ? `62${cleanWaDigits.slice(1)}`
    : cleanWaDigits;
  const whatsappShareUrl = waTarget
    ? `https://wa.me/${waTarget}?text=${encodeURIComponent(shareText)}`
    : `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(student.qrCodeValue);
      setCopied(true);
      setShareFeedback('Kode QR berhasil disalin ke clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareFeedback('Gagal menyalin otomatis. Silakan salin kode QR secara manual.');
    }
  };

  const handleDownloadPng = async () => {
    setExportingPng(true);
    setShareFeedback(null);
    try {
      const blob = await generateShareableQRCardBlob(student);
      if (!blob) {
        setShareFeedback('Gagal membuat gambar PNG kartu QR.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeFile = student.nis.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      link.href = url;
      link.download = `kartu-qr-${safeFile}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setShareFeedback('Kartu QR (.png) berhasil diunduh dan siap dibagikan.');
    } catch {
      setShareFeedback('Terjadi kesalahan saat membuat gambar QR.');
    } finally {
      setExportingPng(false);
    }
  };

  const handleNativeShare = async () => {
    setShareFeedback(null);
    if (typeof navigator.share !== 'function') {
      setShareFeedback('Gunakan tombol WhatsApp atau Unduh PNG untuk membagikan kartu QR.');
      return;
    }

    try {
      const blob = await generateShareableQRCardBlob(student);
      if (blob && typeof File !== 'undefined') {
        const safeFile = student.nis.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
        const qrFile = new File([blob], `kartu-qr-${safeFile}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [qrFile] })) {
          await navigator.share({
            title: `Kartu QR — ${student.nama}`,
            text: shareText,
            files: [qrFile],
          });
          return;
        }
      }

      await navigator.share({
        title: `Kartu QR — ${student.nama}`,
        text: shareText,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setShareFeedback('Peramban tidak mendukung berbagi langsung. Silakan gunakan tombol WhatsApp atau Unduh PNG.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-qr-card-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 sm:p-4"
    >
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Top Modal Header + Quick Student Switcher */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/logo_TKIT_1e974d49.png"
              alt="Logo TKIT AL-I'ANAH"
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-contain p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <h2 id="student-qr-card-title" className="text-sm font-bold text-slate-900 truncate">
                Kartu QR Individual Siswa
              </h2>
              <p className="text-[11px] font-mono text-slate-500 truncate">
                {currentIndex + 1} dari {students.length} siswa · NIS {student.nis}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => hasPrev && onSelectStudentId(students[currentIndex - 1].id)}
              aria-label="Siswa sebelumnya"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => hasNext && onSelectStudentId(students[currentIndex + 1].id)}
              aria-label="Siswa berikutnya"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup kartu QR siswa"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label
              htmlFor="qr-student-selector"
              className="block text-[11px] font-semibold text-slate-500 mb-1"
            >
              Pilih Siswa Berdasarkan ID / Nama
            </label>
            <select
              id="qr-student-selector"
              value={student.id}
              onChange={(e) => onSelectStudentId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none min-h-[38px]"
            >
              {students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama} — {item.nis} ({item.kelasNama})
                </option>
              ))}
            </select>
          </div>

          <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="bg-blue-700 px-4 py-3 text-white flex items-center justify-center gap-2.5">
              <img
                src="/assets/aistudio/logo_TKIT_1e974d49.png"
                alt="Logo TKIT AL-I'ANAH"
                className="h-9 w-9 rounded-lg bg-white object-contain p-0.5 shrink-0"
              />
              <div className="text-left">
                <p className="text-[10px] font-semibold tracking-wider text-blue-100 leading-tight">
                  SMART ABSENSI · TKIT AL-I&apos;ANAH
                </p>
                <p className="text-xs font-bold mt-0.5 leading-tight">KARTU IDENTITAS QR SISWA</p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-emerald-500" />

            <div className="p-5 flex flex-col items-center text-center">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <QRCodeImage
                  value={student.qrCodeValue}
                  size={188}
                  alt={`QR Code ${student.nama}`}
                />
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <span className="font-mono text-xs font-semibold text-slate-700">
                  {student.qrCodeValue}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  title="Salin kode QR"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-700"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <h3 className="mt-2 text-base font-bold text-slate-900">{student.nama}</h3>
              <p className="text-xs font-medium text-blue-700 mt-0.5">
                {student.jenjang === 'TK' ? 'TKIT' : 'SDIT'} · {student.kelasNama}
              </p>

              <div className="mt-3 pt-3 border-t border-slate-100 w-full flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-mono">{student.nis}</span>
                <StatusText status={student.statusHariIni} />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Wali Murid: <strong className="text-slate-700">{student.namaWali}</strong>
              </p>
            </div>
          </div>

          {shareFeedback && (
            <p className="text-center text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {shareFeedback}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {canPrintNametags && onPrintStudent && (
              <button
                type="button"
                onClick={() => onPrintStudent(student)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors min-h-[40px]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Kartu</span>
              </button>
            )}

            <button
              type="button"
              disabled={exportingPng}
              onClick={() => void handleDownloadPng()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition-colors min-h-[40px]"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>{exportingPng ? 'Menyiapkan...' : 'Unduh PNG'}</span>
            </button>

            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors min-h-[40px]"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => void handleNativeShare()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors min-h-[40px]"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Bagikan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
