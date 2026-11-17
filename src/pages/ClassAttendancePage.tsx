import React, { useEffect, useMemo, useState } from 'react';
import type {
  AttendanceStatus,
  ClassRoomRecord,
  ScanMethod,
  StudentRecord,
} from '../types/attendance';
import { PageBanner } from '../components/PageBanner';
import { SmartphoneQRScanner } from '../components/SmartphoneQRScanner';
import { StatusText } from '../components/StatusText';

interface ClassAttendancePageProps {
  classes: ClassRoomRecord[];
  students: StudentRecord[];
  lockedClassId?: string | null;
  lastConfirmed: {
    student: StudentRecord;
    time: string;
    method: string;
    status: AttendanceStatus;
  } | null;
  onConfirmClass: (
    student: StudentRecord,
    method: ScanMethod,
    status: AttendanceStatus
  ) => void;
  onUpdateStudentStatus: (studentId: string, status: AttendanceStatus) => void;
}

const CLASS_STATUS_OPTIONS: AttendanceStatus[] = ['Hadir', 'Izin', 'Sakit', 'Alpa'];

export const ClassAttendancePage: React.FC<ClassAttendancePageProps> = ({
  classes,
  students,
  lockedClassId,
  lastConfirmed,
  onConfirmClass,
  onUpdateStudentStatus,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    lockedClassId || classes[0]?.id || 'all'
  );

  useEffect(() => {
    if (lockedClassId) {
      setSelectedClassId(lockedClassId);
    }
  }, [lockedClassId]);

  const effectiveClassId = lockedClassId || selectedClassId;

  const filteredStudents = useMemo(() => {
    if (effectiveClassId === 'all') return students;
    return students.filter((s) => s.kelasId === effectiveClassId);
  }, [students, effectiveClassId]);

  const activeClass = classes.find((c) => c.id === effectiveClassId);

  return (
    <div className="space-y-5">
      <PageBanner
        title={
          lockedClassId && activeClass
            ? `Absensi Kelas ${activeClass.namaKelas}`
            : 'Absensi Harian Per Kelas'
        }
        description="Pindai QR siswa di kelas atau ketuk tombol status kehadiran (Hadir, Izin, Sakit, Alpa) pada daftar siswa kelas."
      />

      {/* Class Selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <label
            htmlFor="class-attendance-select"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            {lockedClassId
              ? 'Kelas Binaan Terkunci (Tugas Wali Kelas)'
              : 'Pilih Rombongan Belajar'}
          </label>
          <select
            id="class-attendance-select"
            value={effectiveClassId}
            disabled={!!lockedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full sm:w-80 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-700 min-h-[44px]"
          >
            {!lockedClassId && (
              <option value="all">Semua Kelas ({students.length} Siswa)</option>
            )}
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.namaKelas} — {cls.waliKelasNama}
              </option>
            ))}
          </select>
        </div>

        {activeClass && (
          <div className="text-xs text-slate-600">
            <p>
              Wali Kelas: <strong className="text-slate-900">{activeClass.waliKelasNama}</strong>
            </p>
            <p className="mt-0.5 tabular-nums">
              Jumlah Siswa:{' '}
              <strong className="font-mono text-slate-900">{filteredStudents.length}</strong>
            </p>
          </div>
        )}
      </div>

      {/* QR Scanner scoped to selected class */}
      <SmartphoneQRScanner
        gateType="Kelas"
        students={filteredStudents}
        onConfirmAttendance={onConfirmClass}
        lastConfirmed={lastConfirmed}
      />

      {/* Class Checklist */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            Daftar Kehadiran Siswa Kelas
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ketuk tombol status untuk mencatat kehadiran siswa secara langsung dan menyimpannya ke rekap
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Belum ada siswa yang terdaftar pada kelas ini. Tambahkan data siswa terlebih dahulu di menu Data Siswa.
            </div>
          ) : (
            filteredStudents.map((student) => (
              <div
                key={student.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{student.nama}</p>
                    <StatusText status={student.statusHariIni} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-mono">{student.nis}</span> · {student.kelasNama}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {CLASS_STATUS_OPTIONS.map((statusOption) => {
                    const isActive = student.statusHariIni === statusOption;
                    return (
                      <button
                        key={statusOption}
                        type="button"
                        onClick={() => onUpdateStudentStatus(student.id, statusOption)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors min-h-[38px] ${
                          isActive
                            ? statusOption === 'Hadir'
                              ? 'bg-emerald-600 text-white'
                              : statusOption === 'Alpa'
                                ? 'bg-rose-600 text-white'
                                : 'bg-blue-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {statusOption}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
