export type UserRole =
  | 'Guru Piket'
  | 'Guru Kelas'
  | 'Kepala Sekolah'
  | 'Admin Sekolah'
  | 'Super Admin'
  | 'Orang Tua';

export interface RolePolicy {
  role: UserRole;
  kategori: 'Utama' | 'Tambahan';
  deskripsi: string;
  tugasUtama: string;
  batasanAkses: string;
  ringkasanAkses: string;
  defaultPage: PageId;
  canPrintNametags: boolean;
  canExportCsv: boolean;
  canSendWeeklyFeedback: boolean;
  canImportStudents: boolean;
  canImportStaff: boolean;
  scopedToClass: boolean;
}

export interface WeeklyAttendanceSummary {
  periodeLabel: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
}

export type PageId =
  | 'login'
  | 'dashboard'
  | 'siswa'
  | 'guru'
  | 'orang-tua'
  | 'kelas'
  | 'absensi-gerbang-masuk'
  | 'absensi-kelas'
  | 'absensi-gerbang-pulang'
  | 'rekap-absensi'
  | 'pengaturan';

export type Jenjang = 'TK' | 'SD';

export type StaffJenjang = Jenjang | 'TK & SD';

export type StaffCategory = 'Kepala Sekolah' | 'Guru';

export type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa' | 'Belum Scan';

export type StaffAttendanceStatus = 'Belum Absen' | 'Hadir' | 'Izin' | 'Sakit';

export type GateType = 'Masuk' | 'Kelas' | 'Pulang';

export type ScanMethod = 'QR Kamera' | 'Input Kode QR' | 'Manual Kelas';

export interface StudentRecord {
  id: string;
  nis: string;
  qrCodeValue: string;
  nama: string;
  jenjang: Jenjang;
  kelasId: string;
  kelasNama: string;
  namaWali: string;
  noWaWali?: string | null;
  statusHariIni: AttendanceStatus;
  jamMasuk: string | null;
  jamPulang: string | null;
}

export interface TeacherRecord {
  id: string;
  kodeGuru: string;
  nama: string;
  jenjang: StaffJenjang;
  kategoriPeran?: StaffCategory;
  jabatan: string;
  waliKelasNama: string | null;
  emailOpsional?: string | null;
  noHpOpsional?: string | null;
  statusAktif: 'Aktif' | 'Cuti';
  kehadiranHariIni?: StaffAttendanceStatus;
  jamHadirGuru?: string | null;
}

export interface ParentRecord {
  id: string;
  kodeWali: string;
  namaWali: string;
  hubungan: 'Ayah' | 'Ibu' | 'Wali';
  siswaTerhubungNama: string;
  kelasNama: string;
  noWa?: string | null;
  izinPenjemputan: 'Terverifikasi' | 'Menunggu Verifikasi';
}

export interface ClassRoomRecord {
  id: string;
  kodeKelas: string;
  namaKelas: string;
  jenjang: Jenjang;
  tingkat: string;
  waliKelasNama: string;
  kapasitas: number;
}

export interface AttendanceLogRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  siswaId: string;
  nis: string;
  namaSiswa: string;
  kelasNama: string;
  jenjang: Jenjang;
  jenis: GateType;
  status: AttendanceStatus;
  waktu: string; // HH:mm
  metode: ScanMethod;
  petugasNama?: string;
  keterangan: string;
}

export interface SchoolSettings {
  namaSekolah: string;
  alamatSekolah: string;
  tahunAjaran: string;
  semester: 'Ganjil' | 'Genap';
  jamMasukTK: string;
  jamMasukSD: string;
  batasTerlambat: string;
  jamPulangTK: string;
  jamPulangSD: string;
}

export interface SchoolDatabaseSnapshot {
  settings: SchoolSettings;
  classes: ClassRoomRecord[];
  students: StudentRecord[];
  teachers: TeacherRecord[];
  parents: ParentRecord[];
  logs: AttendanceLogRecord[];
  updatedAt?: string;
}

export type AuthProviderKind = 'password' | 'google' | 'both';

export interface SchoolAccountSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  assignedClassId: string | null;
  assignedClassName: string | null;
  isActive: boolean;
  authProvider?: AuthProviderKind;
  photoUrl?: string | null;
  approvedBy?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface GoogleAccessRequest {
  id: string;
  email: string;
  fullName: string;
  photoUrl?: string | null;
  googleUid: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedRole?: UserRole | null;
  requestedClassId?: string | null;
  note?: string | null;
  requestedAt: string;
  lastAttemptAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export interface SchoolSyncEvent {
  type: 'snapshot_updated' | 'attendance_recorded' | 'accounts_updated';
  updatedAt: string;
  actorName?: string;
  actorRole?: UserRole | string;
  summary?: string;
}
