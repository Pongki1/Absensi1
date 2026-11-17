import type {
  AttendanceStatus,
  ClassRoomRecord,
  Jenjang,
  StaffCategory,
  StaffJenjang,
  StudentRecord,
  TeacherRecord,
} from '../types/attendance';

export interface ParsedStudentRow {
  rowNumber: number;
  nis: string;
  qrCodeValue: string;
  nama: string;
  jenjangInput: string;
  kelasInput: string;
  namaWali: string;
  noWaWali: string | null;
  statusHariIni: AttendanceStatus;
  resolvedClass: ClassRoomRecord | null;
  errors: string[];
  studentPayload: StudentRecord | null;
}

export interface ParsedTeacherRow {
  rowNumber: number;
  kodeGuru: string;
  nama: string;
  jenjang: StaffJenjang;
  kategoriPeran: StaffCategory;
  jabatan: string;
  waliKelasInput: string;
  waliKelasNama: string | null;
  emailOpsional: string | null;
  noHpOpsional: string | null;
  statusAktif: 'Aktif' | 'Cuti';
  errors: string[];
  teacherPayload: TeacherRecord | null;
}

const VALID_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'Hadir',
  'Terlambat',
  'Izin',
  'Sakit',
  'Alpa',
  'Belum Scan',
];

export function normalizeHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\(demo\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeClassMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(demo\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function pickCellValue(
  normalizedRow: Record<string, string>,
  aliases: string[]
): string {
  for (const alias of aliases) {
    if (normalizedRow[alias] !== undefined && normalizedRow[alias] !== '') {
      return normalizedRow[alias];
    }
  }
  return '';
}

export function isBlankRecord(raw: Record<string, unknown>): boolean {
  return Object.values(raw).every((v) => String(v ?? '').trim() === '');
}

export function resolveStudentStatus(raw: string): {
  status: AttendanceStatus;
  valid: boolean;
} {
  if (!raw.trim()) return { status: 'Belum Scan', valid: true };
  const lower = raw.trim().toLowerCase();
  const matched = VALID_ATTENDANCE_STATUSES.find((s) => s.toLowerCase() === lower);
  if (matched) return { status: matched, valid: true };
  return { status: 'Belum Scan', valid: false };
}

export function resolveClass(
  kelasInput: string,
  jenjangInput: string,
  classes: ClassRoomRecord[]
): ClassRoomRecord | null {
  const trimmed = kelasInput.trim();
  if (!trimmed) {
    if (classes.length === 1) return classes[0];
    return null;
  }

  const lower = trimmed.toLowerCase();
  const exactMatch = classes.find(
    (c) =>
      c.id.toLowerCase() === lower ||
      c.kodeKelas.toLowerCase() === lower ||
      c.namaKelas.toLowerCase() === lower
  );
  if (exactMatch) return exactMatch;

  const cleanInput = normalizeClassMatch(trimmed);
  const softMatch = classes.find((c) => {
    const cleanName = normalizeClassMatch(c.namaKelas);
    const cleanKode = normalizeClassMatch(c.kodeKelas);
    return (
      cleanName === cleanInput ||
      cleanKode === cleanInput ||
      cleanName.startsWith(cleanInput) ||
      cleanInput.startsWith(cleanName)
    );
  });
  if (softMatch) return softMatch;

  if (trimmed.includes('/')) {
    const parts = trimmed
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const partMatch = resolveClass(part, jenjangInput, classes);
      if (partMatch) return partMatch;
    }
  }

  return null;
}

export function sanitizeQrValue(rawQr: string, nis: string): string {
  const cleaned = rawQr.trim();
  if (cleaned) return cleaned;
  const nisPart = nis
    .trim()
    .toUpperCase()
    .replace(/^NIS-?/, '')
    .replace(/[^A-Z0-9-]+/g, '-');
  return `AL-IANAH-${nisPart || 'SISWA'}`;
}

export function parseStudentRecords(
  records: Record<string, unknown>[],
  options: {
    existingStudents: StudentRecord[];
    classes: ClassRoomRecord[];
    scopedClassName?: string | null;
  }
): ParsedStudentRow[] {
  const { existingStudents, classes, scopedClassName } = options;

  const existingNisSet = new Set(
    existingStudents.map((s) => s.nis.trim().toLowerCase())
  );
  const existingQrSet = new Set(
    existingStudents.map((s) => s.qrCodeValue.trim().toLowerCase())
  );

  const seenNisInFile = new Set<string>();
  const seenQrInFile = new Set<string>();

  const evaluated: ParsedStudentRow[] = [];

  records.forEach((raw, idx) => {
    if (isBlankRecord(raw)) return;

    const normalizedRow: Record<string, string> = {};
    Object.entries(raw).forEach(([k, v]) => {
      const normKey = normalizeHeaderKey(k);
      if (normKey) {
        normalizedRow[normKey] = String(v ?? '').trim();
      }
    });

    const nis = pickCellValue(normalizedRow, [
      'nis',
      'nisn',
      'kode siswa',
      'nis kode siswa',
      'id siswa',
      'nis demo',
    ]);
    const qrRaw = pickCellValue(normalizedRow, ['kode qr', 'qr code', 'qr', 'qrcode']);
    const nama = pickCellValue(normalizedRow, [
      'nama siswa',
      'nama',
      'siswa',
      'nama lengkap',
    ]);
    const jenjangInput = pickCellValue(normalizedRow, ['jenjang', 'unit']);
    const kelasInput = pickCellValue(normalizedRow, [
      'kelas',
      'nama kelas',
      'kode kelas',
      'rombel',
      'jenjang kelas',
    ]);
    const waliInput = pickCellValue(normalizedRow, [
      'wali murid',
      'nama wali',
      'orang tua',
      'wali',
    ]);
    const noWaInput = pickCellValue(normalizedRow, [
      'no wa',
      'no wa wali',
      'no hp',
      'whatsapp',
      'telepon',
    ]);
    const statusInput = pickCellValue(normalizedRow, [
      'status hari ini',
      'status',
      'status absensi',
    ]);

    const errors: string[] = [];

    if (!nis) errors.push('NIS wajib diisi');
    if (!nama) errors.push('Nama siswa wajib diisi');

    const resolvedClass = resolveClass(kelasInput, jenjangInput, classes);
    if (!resolvedClass) {
      errors.push(
        scopedClassName
          ? `Kelas tidak cocok dengan rombel binaan (${scopedClassName})`
          : 'Kelas tidak ditemukan di daftar kelas aplikasi'
      );
    }

    const jenjangUpper = jenjangInput.trim().toUpperCase();
    if (jenjangUpper && jenjangUpper !== 'TK' && jenjangUpper !== 'SD') {
      errors.push('Jenjang harus TK atau SD');
    } else if (resolvedClass && jenjangUpper && jenjangUpper !== resolvedClass.jenjang) {
      errors.push(`Jenjang (${jenjangUpper}) tidak sesuai kelas (${resolvedClass.jenjang})`);
    }

    const qrCodeValue = nis ? sanitizeQrValue(qrRaw, nis) : qrRaw.trim();

    if (nis) {
      const lowerNis = nis.toLowerCase();
      if (existingNisSet.has(lowerNis)) {
        errors.push('NIS sudah terdaftar di daftar siswa');
      } else if (seenNisInFile.has(lowerNis)) {
        errors.push('NIS duplikat di dalam file Excel');
      }
      seenNisInFile.add(lowerNis);
    }

    if (qrCodeValue) {
      const lowerQr = qrCodeValue.toLowerCase();
      if (existingQrSet.has(lowerQr)) {
        errors.push('Kode QR sudah digunakan siswa lain');
      } else if (seenQrInFile.has(lowerQr)) {
        errors.push('Kode QR duplikat di dalam file Excel');
      }
      seenQrInFile.add(lowerQr);
    }

    const { status, valid: statusValid } = resolveStudentStatus(statusInput);
    if (!statusValid) {
      errors.push(`Status "${statusInput}" tidak valid`);
    }

    const namaWali = waliInput || (nama ? `Wali ${nama}` : '');
    const finalJenjang: Jenjang = resolvedClass
      ? resolvedClass.jenjang
      : jenjangUpper === 'TK'
      ? 'TK'
      : 'SD';

    const studentPayload: StudentRecord | null =
      errors.length === 0 && resolvedClass
        ? {
            id: `std-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            nis,
            qrCodeValue,
            nama,
            jenjang: finalJenjang,
            kelasId: resolvedClass.id,
            kelasNama: resolvedClass.namaKelas,
            namaWali,
            noWaWali: noWaInput || null,
            statusHariIni: status,
            jamMasuk: status === 'Hadir' || status === 'Terlambat' ? '07:15' : null,
            jamPulang: null,
          }
        : null;

    evaluated.push({
      rowNumber: idx + 2,
      nis,
      qrCodeValue,
      nama,
      jenjangInput: jenjangUpper || resolvedClass?.jenjang || '-',
      kelasInput: kelasInput || resolvedClass?.namaKelas || '-',
      namaWali,
      noWaWali: noWaInput || null,
      statusHariIni: status,
      resolvedClass,
      errors,
      studentPayload,
    });
  });

  return evaluated;
}

function resolveStaffCategory(
  jabatanRaw: string,
  kategoriRaw: string,
  defaultCategory: StaffCategory
): StaffCategory {
  const combined = `${kategoriRaw} ${jabatanRaw}`.toLowerCase();
  if (
    combined.includes('kepala sekolah') ||
    combined.includes('kepsek') ||
    combined.includes('principal') ||
    combined.includes('headmaster') ||
    combined.includes('mudir')
  ) {
    return 'Kepala Sekolah';
  }
  if (combined.includes('guru') || combined.includes('wali') || combined.includes('piket')) {
    return 'Guru';
  }
  return defaultCategory;
}

function resolveStaffJenjang(
  raw: string,
  resolvedClass: ClassRoomRecord | null,
  kategoriPeran: StaffCategory
): { jenjang: StaffJenjang; valid: boolean } {
  if (!raw.trim()) {
    if (resolvedClass) return { jenjang: resolvedClass.jenjang, valid: true };
    if (kategoriPeran === 'Kepala Sekolah') return { jenjang: 'TK & SD', valid: true };
    return { jenjang: 'SD', valid: true };
  }

  const normalized = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

  if (normalized === 'TK' || normalized === 'TKIT') {
    return { jenjang: 'TK', valid: true };
  }
  if (normalized === 'SD' || normalized === 'SDIT') {
    return { jenjang: 'SD', valid: true };
  }
  if (
    normalized === 'TK & SD' ||
    normalized === 'TK/SD' ||
    normalized === 'TK-SD' ||
    normalized === 'TK DAN SD' ||
    normalized === 'TKIT & SDIT' ||
    normalized === 'SEMUA' ||
    normalized === 'YAYASAN'
  ) {
    return { jenjang: 'TK & SD', valid: true };
  }

  return { jenjang: 'TK & SD', valid: false };
}

function resolveTeacherStatus(raw: string): {
  status: 'Aktif' | 'Cuti';
  valid: boolean;
} {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'aktif' || trimmed === 'aktif (demo)' || trimmed === 'active') {
    return { status: 'Aktif', valid: true };
  }
  if (
    trimmed === 'cuti' ||
    trimmed === 'cuti (demo)' ||
    trimmed === 'izin' ||
    trimmed === 'nonaktif'
  ) {
    return { status: 'Cuti', valid: true };
  }
  return { status: 'Aktif', valid: false };
}

export function parseTeacherRecords(
  records: Record<string, unknown>[],
  options: {
    existingTeachers: TeacherRecord[];
    classes: ClassRoomRecord[];
    defaultCategory?: StaffCategory;
  }
): ParsedTeacherRow[] {
  const { existingTeachers, classes, defaultCategory = 'Guru' } = options;

  const existingCodeSet = new Set(
    existingTeachers.map((t) => t.kodeGuru.trim().toLowerCase())
  );
  const seenCodeInFile = new Set<string>();
  let autoSeq = existingTeachers.length + 1;

  const evaluated: ParsedTeacherRow[] = [];

  records.forEach((raw, idx) => {
    if (isBlankRecord(raw)) return;

    const normalizedRow: Record<string, string> = {};
    Object.entries(raw).forEach(([k, v]) => {
      const normKey = normalizeHeaderKey(k);
      if (normKey) {
        normalizedRow[normKey] = String(v ?? '').trim();
      }
    });

    const rawKode = pickCellValue(normalizedRow, [
      'kode guru',
      'kode',
      'nip',
      'niy',
      'nik',
      'kode pegawai',
      'kode kepsek',
      'id guru',
      'kode guru demo',
    ]);
    const nama = pickCellValue(normalizedRow, [
      'nama lengkap',
      'nama',
      'nama guru',
      'nama kepala sekolah',
      'nama kepsek',
      'nama pegawai',
    ]);
    const kategoriInput = pickCellValue(normalizedRow, ['kategori', 'kategori peran', 'jenis']);
    const jabatanInput = pickCellValue(normalizedRow, [
      'jabatan',
      'peran',
      'role',
      'posisi',
      'tugas',
      'jabatan peran',
    ]);
    const jenjangInput = pickCellValue(normalizedRow, ['jenjang', 'unit', 'satuan']);
    const waliKelasInput = pickCellValue(normalizedRow, [
      'wali kelas',
      'kelas binaan',
      'kelas',
      'nama kelas',
      'kode kelas',
      'rombel',
    ]);
    const emailInput = pickCellValue(normalizedRow, ['email', 'email akun', 'surel']);
    const noHpInput = pickCellValue(normalizedRow, [
      'no hp',
      'no wa',
      'whatsapp',
      'telepon',
      'hp',
      'kontak',
    ]);
    const statusInput = pickCellValue(normalizedRow, [
      'status',
      'status aktif',
      'status kepegawaian',
    ]);

    const kategoriPeran = resolveStaffCategory(jabatanInput, kategoriInput, defaultCategory);
    const jabatan =
      jabatanInput ||
      (kategoriPeran === 'Kepala Sekolah'
        ? 'Kepala Sekolah'
        : waliKelasInput
        ? 'Wali Kelas'
        : 'Guru Kelas');

    let kodeGuru = rawKode;
    if (!kodeGuru) {
      const prefix = kategoriPeran === 'Kepala Sekolah' ? 'KEPSEK' : 'GURU';
      do {
        kodeGuru = `${prefix}-${String(autoSeq).padStart(3, '0')}`;
        autoSeq += 1;
      } while (
        existingCodeSet.has(kodeGuru.toLowerCase()) ||
        seenCodeInFile.has(kodeGuru.toLowerCase())
      );
    }

    const errors: string[] = [];

    if (!nama) {
      errors.push(
        kategoriPeran === 'Kepala Sekolah'
          ? 'Nama kepala sekolah wajib diisi'
          : 'Nama guru wajib diisi'
      );
    }

    const lowerCode = kodeGuru.toLowerCase();
    if (existingCodeSet.has(lowerCode)) {
      errors.push('Kode/NIP sudah terdaftar di aplikasi');
    } else if (seenCodeInFile.has(lowerCode)) {
      errors.push('Kode/NIP duplikat di dalam file Excel');
    }
    seenCodeInFile.add(lowerCode);

    let resolvedClass: ClassRoomRecord | null = null;
    if (waliKelasInput) {
      resolvedClass = resolveClass(waliKelasInput, jenjangInput, classes);
      if (!resolvedClass) {
        errors.push(`Kelas "${waliKelasInput}" tidak ditemukan di daftar kelas`);
      }
    }

    const { jenjang, valid: jenjangValid } = resolveStaffJenjang(
      jenjangInput,
      resolvedClass,
      kategoriPeran
    );
    if (!jenjangValid) {
      errors.push('Jenjang harus TK, SD, atau TK & SD');
    } else if (
      resolvedClass &&
      jenjang !== 'TK & SD' &&
      jenjang !== resolvedClass.jenjang
    ) {
      errors.push(`Jenjang (${jenjang}) tidak sesuai kelas (${resolvedClass.jenjang})`);
    }

    const { status: statusAktif, valid: statusValid } = resolveTeacherStatus(statusInput);
    if (!statusValid) {
      errors.push(`Status "${statusInput}" harus Aktif atau Cuti`);
    }

    const teacherPayload: TeacherRecord | null =
      errors.length === 0
        ? {
            id: `tch-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            kodeGuru,
            nama,
            jenjang,
            kategoriPeran,
            jabatan,
            waliKelasNama: resolvedClass ? resolvedClass.namaKelas : null,
            emailOpsional: emailInput || null,
            noHpOpsional: noHpInput || null,
            statusAktif,
            kehadiranHariIni: 'Belum Absen',
            jamHadirGuru: null,
          }
        : null;

    evaluated.push({
      rowNumber: idx + 2,
      kodeGuru,
      nama,
      jenjang,
      kategoriPeran,
      jabatan,
      waliKelasInput: waliKelasInput || '-',
      waliKelasNama: resolvedClass ? resolvedClass.namaKelas : null,
      emailOpsional: emailInput || null,
      noHpOpsional: noHpInput || null,
      statusAktif,
      errors,
      teacherPayload,
    });
  });

  return evaluated;
}

export function buildStudentSampleRows(
  existingStudents: StudentRecord[],
  classes: ClassRoomRecord[]
): Record<string, string>[] {
  const nextNumBase = existingStudents.length + 1;
  const sampleClasses =
    classes.length >= 3
      ? [classes[0], classes[1], classes[2]]
      : [classes[0], classes[0], classes[0]];

  return sampleClasses.map((cls, index) => {
    const seq = String(nextNumBase + index).padStart(3, '0');
    const prefix = cls?.jenjang ?? 'SD';
    return {
      NIS: `2026${prefix}${seq}`,
      KODE_QR: `AL-IANAH-${prefix}-${seq}`,
      NAMA_SISWA: `Nama Siswa ${seq}`,
      JENJANG: cls?.jenjang ?? 'SD',
      KELAS: cls?.namaKelas ?? '',
      WALI_MURID: `Nama Orang Tua ${seq}`,
      NO_WA_WALI: '081200000000',
      STATUS_HARI_INI: 'Belum Scan',
    };
  });
}

export function buildTeacherSampleRows(
  existingTeachers: TeacherRecord[],
  classes: ClassRoomRecord[]
): Record<string, string>[] {
  const nextBase = existingTeachers.length + 1;
  const tkClass = classes.find((c) => c.jenjang === 'TK') ?? classes[0];
  const sdClass = classes.find((c) => c.jenjang === 'SD') ?? classes[0];

  return [
    {
      KODE_GURU: `KEPSEK-${String(nextBase).padStart(2, '0')}`,
      NAMA_LENGKAP: 'Nama Kepala Sekolah, S.Pd.I',
      JABATAN: 'Kepala Sekolah',
      JENJANG: 'TK & SD',
      WALI_KELAS: '',
      EMAIL: 'kepsek@tkit-alianah.sch.id',
      NO_HP: '081234567890',
      STATUS: 'Aktif',
    },
    {
      KODE_GURU: `GURU-${String(nextBase + 1).padStart(2, '0')}`,
      NAMA_LENGKAP: 'Nama Wali Kelas TK, S.Pd',
      JABATAN: 'Wali Kelas TK A',
      JENJANG: tkClass?.jenjang ?? 'TK',
      WALI_KELAS: tkClass?.namaKelas ?? '',
      EMAIL: 'walikelas.tka@tkit-alianah.sch.id',
      NO_HP: '081234567891',
      STATUS: 'Aktif',
    },
    {
      KODE_GURU: `GURU-${String(nextBase + 2).padStart(2, '0')}`,
      NAMA_LENGKAP: 'Nama Wali Kelas SD, S.Pd',
      JABATAN: 'Wali Kelas SD 1A',
      JENJANG: sdClass?.jenjang ?? 'SD',
      WALI_KELAS: sdClass?.namaKelas ?? '',
      EMAIL: 'walikelas.sd1a@tkit-alianah.sch.id',
      NO_HP: '081234567892',
      STATUS: 'Aktif',
    },
    {
      KODE_GURU: `GURU-${String(nextBase + 3).padStart(2, '0')}`,
      NAMA_LENGKAP: 'Nama Guru Piket Gerbang',
      JABATAN: 'Guru Piket Gerbang',
      JENJANG: 'TK & SD',
      WALI_KELAS: '',
      EMAIL: 'piket1@tkit-alianah.sch.id',
      NO_HP: '081234567893',
      STATUS: 'Aktif',
    },
  ];
}

export function buildPrincipalOnlySampleRows(
  existingTeachers: TeacherRecord[]
): Record<string, string>[] {
  const nextBase = existingTeachers.length + 1;
  return [
    {
      KODE_GURU: `KEPSEK-TK-${String(nextBase).padStart(2, '0')}`,
      NAMA_LENGKAP: 'Nama Kepala Sekolah TKIT',
      JABATAN: 'Kepala Sekolah TKIT',
      JENJANG: 'TK',
      WALI_KELAS: '',
      EMAIL: 'kepsek.tk@tkit-alianah.sch.id',
      NO_HP: '081290001001',
      STATUS: 'Aktif',
    },
    {
      KODE_GURU: `KEPSEK-SD-${String(nextBase + 1).padStart(2, '0')}`,
      NAMA_LENGKAP: 'Nama Kepala Sekolah SDIT',
      JABATAN: 'Kepala Sekolah SDIT',
      JENJANG: 'SD',
      WALI_KELAS: '',
      EMAIL: 'kepsek.sd@tkit-alianah.sch.id',
      NO_HP: '081290001002',
      STATUS: 'Aktif',
    },
  ];
}

export async function downloadStudentTemplateWorkbook(
  existingStudents: StudentRecord[],
  classes: ClassRoomRecord[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const sampleRows = buildStudentSampleRows(existingStudents, classes);
  const sheetTemplate = XLSX.utils.json_to_sheet(sampleRows, {
    header: [
      'NIS',
      'KODE_QR',
      'NAMA_SISWA',
      'JENJANG',
      'KELAS',
      'WALI_MURID',
      'NO_WA_WALI',
      'STATUS_HARI_INI',
    ],
  });
  sheetTemplate['!cols'] = [
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 10 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
  ];

  const classRefRows = classes.map((c) => ({
    KODE_KELAS: c.kodeKelas,
    NAMA_KELAS: c.namaKelas,
    JENJANG: c.jenjang,
    TINGKAT: c.tingkat,
    WALI_KELAS: c.waliKelasNama,
  }));
  const sheetClasses = XLSX.utils.json_to_sheet(classRefRows);
  sheetClasses['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 10 },
    { wch: 14 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheetTemplate, 'Template_Siswa');
  XLSX.utils.book_append_sheet(workbook, sheetClasses, 'Referensi_Kelas');
  XLSX.writeFile(workbook, 'template-import-siswa-smart-absensi.xlsx');
}

export async function downloadCurrentStudentsWorkbook(
  existingStudents: StudentRecord[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const rows = existingStudents.map((s) => ({
    NIS: s.nis,
    KODE_QR: s.qrCodeValue,
    NAMA_SISWA: s.nama,
    JENJANG: s.jenjang,
    KELAS: s.kelasNama,
    WALI_MURID: s.namaWali,
    NO_WA_WALI: s.noWaWali ?? '',
    STATUS_HARI_INI: s.statusHariIni,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 10 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data_Siswa');
  XLSX.writeFile(workbook, 'data-siswa-smart-absensi.xlsx');
}

export async function downloadTeacherTemplateWorkbook(
  existingTeachers: TeacherRecord[],
  classes: ClassRoomRecord[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const sampleRows = buildTeacherSampleRows(existingTeachers, classes);
  const sheetMain = XLSX.utils.json_to_sheet(sampleRows, {
    header: [
      'KODE_GURU',
      'NAMA_LENGKAP',
      'JABATAN',
      'JENJANG',
      'WALI_KELAS',
      'EMAIL',
      'NO_HP',
      'STATUS',
    ],
  });
  sheetMain['!cols'] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 22 },
    { wch: 12 },
    { wch: 24 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
  ];

  const refRows = [
    { JABATAN_CONTOH: 'Kepala Sekolah', JENJANG_VALID: 'TK / SD / TK & SD', CATATAN: 'Kosongkan WALI_KELAS' },
    { JABATAN_CONTOH: 'Wali Kelas', JENJANG_VALID: 'TK / SD', CATATAN: 'Isi WALI_KELAS sesuai Referensi_Kelas' },
    { JABATAN_CONTOH: 'Guru Kelas', JENJANG_VALID: 'TK / SD', CATATAN: 'Wali kelas atau pendamping kelas' },
    { JABATAN_CONTOH: 'Guru Piket', JENJANG_VALID: 'TK / SD / TK & SD', CATATAN: 'Petugas scan gerbang masuk/pulang' },
    { JABATAN_CONTOH: 'Guru Mata Pelajaran', JENJANG_VALID: 'TK / SD / TK & SD', CATATAN: 'Kosongkan WALI_KELAS jika lintas kelas' },
  ];
  const sheetRef = XLSX.utils.json_to_sheet(refRows);
  sheetRef['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 36 }];

  const classRefRows = classes.map((c) => ({
    KODE_KELAS: c.kodeKelas,
    NAMA_KELAS: c.namaKelas,
    JENJANG: c.jenjang,
    TINGKAT: c.tingkat,
  }));
  const sheetClasses = XLSX.utils.json_to_sheet(classRefRows);
  sheetClasses['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheetMain, 'Guru_dan_Kepsek');
  XLSX.utils.book_append_sheet(workbook, sheetRef, 'Panduan_Jabatan');
  XLSX.utils.book_append_sheet(workbook, sheetClasses, 'Referensi_Kelas');
  XLSX.writeFile(workbook, 'template-import-guru-kepsek-smart-absensi.xlsx');
}

export async function downloadCurrentTeachersWorkbook(
  existingTeachers: TeacherRecord[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const rows = existingTeachers.map((t) => ({
    KODE_GURU: t.kodeGuru,
    NAMA_LENGKAP: t.nama,
    KATEGORI: t.kategoriPeran ?? 'Guru',
    JABATAN: t.jabatan,
    JENJANG: t.jenjang,
    WALI_KELAS: t.waliKelasNama ?? '',
    EMAIL: t.emailOpsional ?? '',
    NO_HP: t.noHpOpsional ?? '',
    STATUS: t.statusAktif,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 16 },
    { wch: 22 },
    { wch: 12 },
    { wch: 24 },
    { wch: 26 },
    { wch: 16 },
    { wch: 12 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data_Guru_Kepsek');
  XLSX.writeFile(workbook, 'data-guru-kepsek-smart-absensi.xlsx');
}

export async function downloadMasterTemplateWorkbook(
  existingStudents: StudentRecord[],
  existingTeachers: TeacherRecord[],
  classes: ClassRoomRecord[]
): Promise<void> {
  const XLSX = await import('xlsx');

  const studentRows = buildStudentSampleRows(existingStudents, classes);
  const sheetStudents = XLSX.utils.json_to_sheet(studentRows, {
    header: [
      'NIS',
      'KODE_QR',
      'NAMA_SISWA',
      'JENJANG',
      'KELAS',
      'WALI_MURID',
      'NO_WA_WALI',
      'STATUS_HARI_INI',
    ],
  });
  sheetStudents['!cols'] = [
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 10 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
  ];

  const teacherOnlyRows = buildTeacherSampleRows(existingTeachers, classes).filter(
    (r) => !r.JABATAN.toLowerCase().includes('kepala sekolah')
  );
  const sheetTeachers = XLSX.utils.json_to_sheet(teacherOnlyRows, {
    header: [
      'KODE_GURU',
      'NAMA_LENGKAP',
      'JABATAN',
      'JENJANG',
      'WALI_KELAS',
      'EMAIL',
      'NO_HP',
      'STATUS',
    ],
  });
  sheetTeachers['!cols'] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 22 },
    { wch: 12 },
    { wch: 24 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
  ];

  const principalRows = buildPrincipalOnlySampleRows(existingTeachers);
  const sheetPrincipals = XLSX.utils.json_to_sheet(principalRows, {
    header: [
      'KODE_GURU',
      'NAMA_LENGKAP',
      'JABATAN',
      'JENJANG',
      'WALI_KELAS',
      'EMAIL',
      'NO_HP',
      'STATUS',
    ],
  });
  sheetPrincipals['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    { wch: 12 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
  ];

  const classRefRows = classes.map((c) => ({
    KODE_KELAS: c.kodeKelas,
    NAMA_KELAS: c.namaKelas,
    JENJANG: c.jenjang,
    TINGKAT: c.tingkat,
  }));
  const sheetClasses = XLSX.utils.json_to_sheet(classRefRows);
  sheetClasses['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheetStudents, 'Siswa');
  XLSX.utils.book_append_sheet(workbook, sheetTeachers, 'Guru');
  XLSX.utils.book_append_sheet(workbook, sheetPrincipals, 'Kepala_Sekolah');
  XLSX.utils.book_append_sheet(workbook, sheetClasses, 'Referensi_Kelas');
  XLSX.writeFile(workbook, 'template-master-siswa-guru-kepsek-smart-absensi.xlsx');
}

export interface MasterWorkbookParseResult {
  studentRows: ParsedStudentRow[];
  teacherRows: ParsedTeacherRow[];
  principalRows: ParsedTeacherRow[];
  detectedSheets: string[];
}

export async function parseMasterWorkbookFile(
  file: File,
  options: {
    existingStudents: StudentRecord[];
    existingTeachers: TeacherRecord[];
    classes: ClassRoomRecord[];
  }
): Promise<MasterWorkbookParseResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const studentRecords: Record<string, unknown>[] = [];
  const teacherRecords: Record<string, unknown>[] = [];
  const principalRecords: Record<string, unknown>[] = [];
  const detectedSheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const lowerName = sheetName.toLowerCase();
    if (lowerName.includes('referensi') || lowerName.includes('panduan')) {
      continue;
    }

    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (rows.length === 0) continue;

    if (
      lowerName.includes('kepala') ||
      lowerName.includes('kepsek') ||
      lowerName.includes('principal')
    ) {
      principalRecords.push(...rows);
      detectedSheets.push(`${sheetName} (Kepala Sekolah)`);
      continue;
    }

    if (
      lowerName.includes('guru') ||
      lowerName.includes('teacher') ||
      lowerName.includes('tendik') ||
      lowerName.includes('staff')
    ) {
      teacherRecords.push(...rows);
      detectedSheets.push(`${sheetName} (Guru/Kepsek)`);
      continue;
    }

    if (
      lowerName.includes('siswa') ||
      lowerName.includes('murid') ||
      lowerName.includes('student')
    ) {
      studentRecords.push(...rows);
      detectedSheets.push(`${sheetName} (Siswa)`);
      continue;
    }

    // Fallback: detect by column headers on first row
    const headerKeys = Object.keys(rows[0]).map((k) => normalizeHeaderKey(k));
    if (headerKeys.some((k) => k.includes('nis') || k.includes('wali murid') || k.includes('nama siswa'))) {
      studentRecords.push(...rows);
      detectedSheets.push(`${sheetName} (Siswa)`);
    } else if (
      headerKeys.some((k) => k.includes('jabatan') || k.includes('kode guru') || k.includes('nip'))
    ) {
      teacherRecords.push(...rows);
      detectedSheets.push(`${sheetName} (Guru/Kepsek)`);
    }
  }

  const studentRows = parseStudentRecords(studentRecords, {
    existingStudents: options.existingStudents,
    classes: options.classes,
  });

  const teacherRows = parseTeacherRecords(teacherRecords, {
    existingTeachers: options.existingTeachers,
    classes: options.classes,
    defaultCategory: 'Guru',
  });

  const validTeachersSoFar = teacherRows
    .map((r) => r.teacherPayload)
    .filter((t): t is TeacherRecord => t !== null);

  const principalRows = parseTeacherRecords(principalRecords, {
    existingTeachers: [...options.existingTeachers, ...validTeachersSoFar],
    classes: options.classes,
    defaultCategory: 'Kepala Sekolah',
  });

  return {
    studentRows,
    teacherRows,
    principalRows,
    detectedSheets,
  };
}
