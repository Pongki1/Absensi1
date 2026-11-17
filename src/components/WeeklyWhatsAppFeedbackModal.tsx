import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import type { AttendanceLogRecord, StudentRecord } from '../types/attendance';
import { getWeeklySummaryFromLogs } from '../data/schoolData';

interface WeeklyWhatsAppFeedbackModalProps {
  student: StudentRecord;
  logs: AttendanceLogRecord[];
  senderRole: string;
  onClose: () => void;
}

const WEEKLY_PERIODS = [
  'Pekan Ini (7 Hari Terakhir)',
  'Pekan 1 Bulan Berjalan',
  'Pekan 2 Bulan Berjalan',
  'Pekan 3 Bulan Berjalan',
  'Pekan 4 Bulan Berjalan',
];

function buildDefaultMessage(
  student: StudentRecord,
  logs: AttendanceLogRecord[],
  period: string,
  senderRole: string
): string {
  const summary = getWeeklySummaryFromLogs(student, logs);
  return [
    "Assalamu'alaikum Wr. Wb.",
    `Yth. ${student.namaWali} (Wali dari ${student.nama} — ${student.kelasNama}),`,
    '',
    `Berikut kami sampaikan laporan kehadiran ananda untuk ${period}:`,
    `- Hadir Tepat Waktu: ${summary.hadir} hari`,
    `- Terlambat: ${summary.terlambat} hari`,
    `- Izin: ${summary.izin} hari`,
    `- Sakit: ${summary.sakit} hari`,
    `- Alpa: ${summary.alpa} hari`,
    '',
    'Terima kasih atas kerja sama Bapak/Ibu dalam memantau kedisiplinan kehadiran ananda.',
    '',
    'Hormat kami,',
    `${senderRole} · SMART ABSENSI TKIT AL-I'ANAH`,
  ].join('\n');
}

function normalizePhoneForWa(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

export const WeeklyWhatsAppFeedbackModal: React.FC<WeeklyWhatsAppFeedbackModalProps> = ({
  student,
  logs,
  senderRole,
  onClose,
}) => {
  const summary = useMemo(() => getWeeklySummaryFromLogs(student, logs), [student, logs]);
  const [selectedPeriod, setSelectedPeriod] = useState(WEEKLY_PERIODS[0]);
  const [phoneInput, setPhoneInput] = useState(student.noWaWali ?? '');
  const [messageText, setMessageText] = useState(() =>
    buildDefaultMessage(student, logs, WEEKLY_PERIODS[0], senderRole)
  );
  const [copied, setCopied] = useState(false);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    setMessageText(buildDefaultMessage(student, logs, period, senderRole));
  };

  const normalizedPhone = normalizePhoneForWa(phoneInput);
  const encodedMessage = encodeURIComponent(messageText);
  const waHref = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">
                Laporan Kehadiran via WhatsApp
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {student.nama} · {student.kelasNama}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal feedback WhatsApp"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-5 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
            <div>
              <p className="text-[11px] text-slate-500">Hadir</p>
              <p className="text-base font-bold text-emerald-700 tabular-nums">{summary.hadir}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Telat</p>
              <p className="text-base font-bold text-amber-700 tabular-nums">{summary.terlambat}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Izin</p>
              <p className="text-base font-bold text-blue-700 tabular-nums">{summary.izin}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Sakit</p>
              <p className="text-base font-bold text-slate-800 tabular-nums">{summary.sakit}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Alpa</p>
              <p className="text-base font-bold text-rose-700 tabular-nums">{summary.alpa}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wa-period-select" className="block text-xs font-medium text-slate-700 mb-1">
                Periode Laporan
              </label>
              <select
                id="wa-period-select"
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none min-h-[40px]"
              >
                {WEEKLY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="wa-phone-input" className="block text-xs font-medium text-slate-700 mb-1">
                Nomor WhatsApp Wali Murid
              </label>
              <input
                id="wa-phone-input"
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none min-h-[40px]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="wa-message-textarea" className="block text-xs font-medium text-slate-700 mb-1">
              Isi Pesan Laporan Mingguan
            </label>
            <textarea
              id="wa-message-textarea"
              rows={9}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => void handleCopyMessage()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[42px]"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Pesan</span>
              </>
            )}
          </button>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 transition-colors min-h-[42px]"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Kirim via WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
};
