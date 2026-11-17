import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import type {
  AttendanceStatus,
  GateType,
  ScanMethod,
  StudentRecord,
} from '../types/attendance';
import { QRCodeImage } from './QRCodeImage';

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
  }
}

interface PendingScanState {
  student: StudentRecord;
  scannedAt: string;
  method: ScanMethod;
  rawCode: string;
}

interface SmartphoneQRScannerProps {
  gateType: GateType;
  students: StudentRecord[];
  batasTerlambat?: string;
  onConfirmAttendance: (
    student: StudentRecord,
    method: ScanMethod,
    status: AttendanceStatus
  ) => void;
  lastConfirmed?: {
    student: StudentRecord;
    time: string;
    method: string;
    status: AttendanceStatus;
  } | null;
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export const SmartphoneQRScanner: React.FC<SmartphoneQRScannerProps> = ({
  gateType,
  students,
  batasTerlambat = '07:15',
  onConfirmAttendance,
  lastConfirmed,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<PendingScanState | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  const [pendingScan, setPendingScan] = useState<PendingScanState | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('Hadir');

  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id ?? '');
  const [manualCode, setManualCode] = useState<string>('');

  useEffect(() => {
    pendingRef.current = pendingScan;
  }, [pendingScan]);

  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudentId('');
    } else if (!students.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleCodeDetected = useCallback(
    (rawCode: string, method: ScanMethod) => {
      const normalized = rawCode.trim().toUpperCase();
      const matched = students.find(
        (s) =>
          s.qrCodeValue.toUpperCase() === normalized || s.nis.toUpperCase() === normalized
      );

      if (!matched) {
        setScanFeedback(
          `Kode QR "${rawCode}" tidak ditemukan pada data siswa aktif.`
        );
        return;
      }

      const nowHHMM = getCurrentTimeHHMM();
      const autoLate = gateType === 'Masuk' && nowHHMM > batasTerlambat;

      setScanFeedback(null);
      setSelectedStatus(autoLate ? 'Terlambat' : 'Hadir');
      setPendingScan({
        student: matched,
        scannedAt: nowHHMM,
        method,
        rawCode: matched.qrCodeValue,
      });
    },
    [students, gateType, batasTerlambat]
  );

  const startCamera = useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
      setCameraError(null);
      setScanFeedback(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Browser tidak mendukung akses kamera langsung. Gunakan input NIS atau kode QR di sebelah kanan.'
        );
        return;
      }

      stopCamera();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        setCameraActive(true);

        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
        });

        const detector = window.BarcodeDetector
          ? new window.BarcodeDetector({ formats: ['qr_code'] })
          : null;

        let lastAttemptAt = 0;

        const scanLoop = async (timestamp: number) => {
          if (!streamRef.current || !videoRef.current) return;

          if (!pendingRef.current && timestamp - lastAttemptAt > 250) {
            lastAttemptAt = timestamp;
            const video = videoRef.current;

            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
              let decodedText: string | null = null;

              if (detector) {
                try {
                  const results = await detector.detect(video);
                  if (results.length > 0 && results[0].rawValue) {
                    decodedText = results[0].rawValue;
                  }
                } catch {
                  // Fallback to jsQR below
                }
              }

              if (!decodedText) {
                const canvas = canvasRef.current ?? document.createElement('canvas');
                canvasRef.current = canvas;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                  });
                  if (qrResult?.data) {
                    decodedText = qrResult.data;
                  }
                }
              }

              if (decodedText) {
                handleCodeDetected(decodedText, 'QR Kamera');
              }
            }
          }

          rafRef.current = requestAnimationFrame(scanLoop);
        };

        rafRef.current = requestAnimationFrame(scanLoop);
      } catch {
        setCameraError(
          'Izin kamera ditolak atau kamera tidak tersedia. Gunakan pencatatan NIS / Kode QR manual di panel sebelah kanan.'
        );
        stopCamera();
      }
    },
    [facingMode, handleCodeDetected, stopCamera]
  );

  const handleToggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      void startCamera(nextMode);
    }
  };

  const handleConfirmClick = () => {
    if (!pendingScan) return;
    onConfirmAttendance(pendingScan.student, pendingScan.method, selectedStatus);
    setPendingScan(null);
  };

  const handleResetPending = () => {
    setPendingScan(null);
    setScanFeedback(null);
  };

  const selectedQuickStudent =
    students.find((s) => s.id === selectedStudentId) ?? students[0] ?? null;

  const gateActionLabel =
    gateType === 'Masuk'
      ? 'Konfirmasi Absensi Masuk'
      : gateType === 'Pulang'
        ? 'Konfirmasi Absensi Pulang'
        : 'Konfirmasi Absensi Kelas';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left: Smartphone Camera Viewfinder */}
      <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Kamera Pemindai QR {gateType === 'Kelas' ? 'Kelas' : `Gerbang ${gateType}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Arahkan kamera smartphone ke kartu nametag QR siswa untuk memindai
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleCameraFacing}
              title="Ganti kamera depan/belakang"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
            </button>

            <button
              type="button"
              disabled={students.length === 0 && !cameraActive}
              onClick={() => (cameraActive ? stopCamera() : void startCamera())}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap min-h-[44px] disabled:opacity-50 ${
                cameraActive
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {cameraActive ? (
                <>
                  <CameraOff className="w-4 h-4" />
                  <span>Matikan Kamera</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Aktifkan Kamera</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Camera Viewport */}
        <div className="mt-4 relative aspect-[4/3] sm:aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 flex items-center justify-center">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
                <div
                  className={`relative h-44 w-44 sm:h-52 sm:w-52 rounded-2xl border-2 transition-colors shadow-[0_0_0_9999px_rgba(15,23,42,0.48)] ${
                    pendingScan ? 'border-blue-400' : 'border-emerald-400'
                  }`}
                >
                  <ScanLine className="w-6 h-6 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
                </div>
                <p className="mt-4 rounded-lg bg-slate-950/75 px-3 py-1 text-[11px] font-medium text-white">
                  {pendingScan
                    ? 'QR Terdeteksi — Silakan konfirmasi data siswa'
                    : 'Posisikan kode QR di dalam kotak pemindai'}
                </p>
              </div>
            </>
          ) : (
            <div className="p-6 text-center max-w-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
                <QrCode className="w-6 h-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">
                Pemindai QR Kamera Smartphone
              </p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                {students.length === 0
                  ? 'Belum ada data siswa terdaftar. Tambahkan atau impor data siswa terlebih dahulu sebelum memindai kartu QR.'
                  : 'Ketuk "Aktifkan Kamera" untuk memindai kartu QR siswa secara langsung, atau masukkan NIS/Kode QR di sebelah kanan.'}
              </p>
            </div>
          )}
        </div>

        {cameraError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>{cameraError}</span>
          </div>
        )}

        {scanFeedback && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            {scanFeedback}
          </div>
        )}
      </div>

      {/* Right: Detected Student Info + Confirmation Button + Manual Quick Entry */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <div
          className={`rounded-xl border p-4 sm:p-5 transition-colors ${
            pendingScan
              ? 'border-blue-300 bg-blue-50/50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Informasi Siswa Terpindai
            </h3>
            <span className="text-[11px] font-medium text-slate-500">
              {pendingScan ? 'Menunggu Konfirmasi' : 'Siap Memindai'}
            </span>
          </div>

          {pendingScan ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 truncate">
                      {pendingScan.student.nama}
                    </p>
                    <p className="text-xs font-mono text-blue-700 mt-0.5">
                      {pendingScan.student.nis} · {pendingScan.student.qrCodeValue}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 shrink-0">
                    {pendingScan.student.jenjang}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Kelas</p>
                    <p className="font-semibold text-slate-900 truncate">
                      {pendingScan.student.kelasNama}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Waktu Scan</p>
                    <p className="font-mono font-semibold text-slate-900 tabular-nums">
                      {pendingScan.scannedAt}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-slate-600 pt-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Wali Murid:{' '}
                      <strong className="text-slate-900">{pendingScan.student.namaWali}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {gateType === 'Masuk' && (
                <div>
                  <p className="text-xs font-medium text-slate-700 mb-1.5">
                    Status Kedatangan (Batas Terlambat: {batasTerlambat}):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Hadir', 'Terlambat'] as const).map((statusOpt) => (
                      <button
                        key={statusOpt}
                        type="button"
                        onClick={() => setSelectedStatus(statusOpt)}
                        className={`rounded-lg py-2 px-3 text-xs font-semibold border transition-colors min-h-[40px] ${
                          selectedStatus === statusOpt
                            ? statusOpt === 'Hadir'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                              : 'border-amber-600 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {statusOpt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmClick}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors min-h-[46px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{gateActionLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetPending}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[46px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Batal</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Arahkan kamera ke kartu QR siswa atau gunakan pencatatan manual NIS / pilih siswa di bawah ini.
              </p>

              {lastConfirmed && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-950">
                      Tercatat: {lastConfirmed.student.nama}
                    </p>
                    <p className="text-emerald-800 mt-0.5">
                      {lastConfirmed.status} · Pukul{' '}
                      <span className="font-mono tabular-nums">{lastConfirmed.time}</span> ({lastConfirmed.method})
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual / Backup QR Entry Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Input Manual / Cari Siswa Cepat
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Digunakan apabila kartu nametag siswa tertinggal atau kamera tidak tersedia.
          </p>

          {students.length === 0 ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              Daftar siswa masih kosong. Silakan tambahkan atau impor data siswa melalui menu Data Siswa atau Pengaturan.
            </div>
          ) : (
            <>
              {selectedQuickStudent && (
                <div className="mt-3 flex items-center gap-3.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <QRCodeImage
                    value={selectedQuickStudent.qrCodeValue}
                    size={64}
                    className="border border-slate-200 p-1 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-blue-700 truncate">
                      {selectedQuickStudent.qrCodeValue}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                      {selectedQuickStudent.nama}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {selectedQuickStudent.kelasNama}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3.5 space-y-2.5">
                <div>
                  <label
                    htmlFor={`quick-qr-select-${gateType}`}
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Pilih Siswa Terdaftar
                  </label>
                  <select
                    id={`quick-qr-select-${gateType}`}
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none min-h-[44px]"
                  >
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.nama} — {student.kelasNama}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedQuickStudent) {
                      handleCodeDetected(selectedQuickStudent.qrCodeValue, 'Input Kode QR');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors min-h-[44px]"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Pilih &amp; Konfirmasi Siswa</span>
                </button>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualCode.trim()) {
                      handleCodeDetected(manualCode, 'Input Kode QR');
                      setManualCode('');
                    }
                  }}
                  className="pt-2 border-t border-slate-100 flex gap-2"
                >
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ketik atau pindai NIS / Kode QR..."
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none min-h-[40px]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
                  >
                    Cek Kode
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
