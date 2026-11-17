import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AttendanceLogRecord,
  AttendanceStatus,
  AuthProviderKind,
  ClassRoomRecord,
  GateType,
  GoogleAccessRequest,
  ParentRecord,
  ScanMethod,
  SchoolAccountSummary,
  SchoolDatabaseSnapshot,
  SchoolSettings,
  StaffAttendanceStatus,
  StudentRecord,
  TeacherRecord,
  UserRole,
} from '../src/types/attendance.ts';

interface StoredSchoolAccount extends SchoolAccountSummary {
  passwordSalt: string;
  passwordHash: string;
  googleUid?: string | null;
}

interface PersistedSchoolDatabase extends SchoolDatabaseSnapshot {
  version: number;
  accounts: StoredSchoolAccount[];
  accessRequests: GoogleAccessRequest[];
  updatedAt: string;
}

export const INITIAL_DEFAULT_CLASSES: ClassRoomRecord[] = [
  {
    id: 'kls-tk-a',
    kodeKelas: 'TKA',
    namaKelas: 'TK A - Ceria',
    jenjang: 'TK',
    tingkat: 'Kelompok A',
    waliKelasNama: 'Wali Kelas TK A',
    kapasitas: 20,
  },
  {
    id: 'kls-tk-b',
    kodeKelas: 'TKB',
    namaKelas: 'TK B - Mandiri',
    jenjang: 'TK',
    tingkat: 'Kelompok B',
    waliKelasNama: 'Wali Kelas TK B',
    kapasitas: 20,
  },
  {
    id: 'kls-sd-1a',
    kodeKelas: 'SD1A',
    namaKelas: 'SD 1A - Amanah',
    jenjang: 'SD',
    tingkat: 'Kelas 1',
    waliKelasNama: 'Wali Kelas SD 1A',
    kapasitas: 28,
  },
  {
    id: 'kls-sd-2a',
    kodeKelas: 'SD2A',
    namaKelas: 'SD 2A - Shiddiq',
    jenjang: 'SD',
    tingkat: 'Kelas 2',
    waliKelasNama: 'Wali Kelas SD 2A',
    kapasitas: 28,
  },
  {
    id: 'kls-sd-3a',
    kodeKelas: 'SD3A',
    namaKelas: 'SD 3A - Fathonah',
    jenjang: 'SD',
    tingkat: 'Kelas 3',
    waliKelasNama: 'Wali Kelas SD 3A',
    kapasitas: 28,
  },
  {
    id: 'kls-sd-4a',
    kodeKelas: 'SD4A',
    namaKelas: 'SD 4A - Tabligh',
    jenjang: 'SD',
    tingkat: 'Kelas 4',
    waliKelasNama: 'Wali Kelas SD 4A',
    kapasitas: 28,
  },
  {
    id: 'kls-sd-5a',
    kodeKelas: 'SD5A',
    namaKelas: 'SD 5A - Al-Fatih',
    jenjang: 'SD',
    tingkat: 'Kelas 5',
    waliKelasNama: 'Wali Kelas SD 5A',
    kapasitas: 28,
  },
  {
    id: 'kls-sd-6a',
    kodeKelas: 'SD6A',
    namaKelas: 'SD 6A - Shalahuddin',
    jenjang: 'SD',
    tingkat: 'Kelas 6',
    waliKelasNama: 'Wali Kelas SD 6A',
    kapasitas: 28,
  },
];

export const INITIAL_DEFAULT_SETTINGS: SchoolSettings = {
  namaSekolah: "TKIT & SDIT AL-I'ANAH",
  alamatSekolah: "Komplek Pendidikan Islam AL-I'ANAH",
  tahunAjaran: '2026/2027',
  semester: 'Ganjil',
  jamMasukTK: '07:30',
  jamMasukSD: '07:00',
  batasTerlambat: '07:15',
  jamPulangTK: '11:30',
  jamPulangSD: '14:00',
};

function getLocalYYYYMMDD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!salt || !expectedHash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function buildSeedAccount(input: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  assignedClassId: string | null;
  assignedClassName: string | null;
  defaultPassword?: string;
  authProvider?: AuthProviderKind;
  approvedBy?: string | null;
}): StoredSchoolAccount {
  const hasPassword = Boolean(input.defaultPassword && input.defaultPassword.trim().length > 0);
  const { salt, hash } = hasPassword
    ? hashPassword(input.defaultPassword!)
    : { salt: '', hash: '' };

  return {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName,
    role: input.role,
    assignedClassId: input.assignedClassId,
    assignedClassName: input.assignedClassName,
    isActive: true,
    authProvider: input.authProvider ?? (hasPassword ? 'password' : 'google'),
    photoUrl: null,
    approvedBy: input.approvedBy ?? 'Sistem Sekolah',
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    passwordSalt: salt,
    passwordHash: hash,
    googleUid: null,
  };
}

function buildOwnerSuperAdminAccount(): StoredSchoolAccount {
  const ownerEmail =
    process.env.DEFAULT_SUPERADMIN_EMAIL?.trim().toLowerCase() || 'pongki.suhendar@gmail.com';
  return buildSeedAccount({
    id: 'acc-superadmin-owner',
    email: ownerEmail,
    fullName: 'Pongki Suhendar (Super Admin)',
    role: 'Super Admin',
    assignedClassId: null,
    assignedClassName: null,
    authProvider: 'google',
    approvedBy: 'Bootstrap Pemilik Aplikasi',
  });
}

function createInitialDatabase(): PersistedSchoolDatabase {
  const accounts: StoredSchoolAccount[] = [
    buildOwnerSuperAdminAccount(),
    buildSeedAccount({
      id: 'acc-admin-01',
      email: 'admin@tkit-alianah.sch.id',
      fullName: 'Administrator Sekolah',
      role: 'Admin Sekolah',
      assignedClassId: null,
      assignedClassName: null,
      defaultPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'Alianah2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kepsek-01',
      email: 'kepsek@tkit-alianah.sch.id',
      fullName: "Kepala Sekolah TKIT & SDIT AL-I'ANAH",
      role: 'Kepala Sekolah',
      assignedClassId: null,
      assignedClassName: null,
      defaultPassword: process.env.DEFAULT_KEPSEK_PASSWORD || 'Kepsek2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-piket-01',
      email: 'piket1@tkit-alianah.sch.id',
      fullName: 'Guru Piket 1 (Gerbang Utama)',
      role: 'Guru Piket',
      assignedClassId: null,
      assignedClassName: null,
      defaultPassword: process.env.DEFAULT_PIKET_PASSWORD || 'Piket2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-piket-02',
      email: 'piket2@tkit-alianah.sch.id',
      fullName: 'Guru Piket 2 (Gerbang Utama)',
      role: 'Guru Piket',
      assignedClassId: null,
      assignedClassName: null,
      defaultPassword: process.env.DEFAULT_PIKET_PASSWORD || 'Piket2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kelas-tka',
      email: 'walikelas.tka@tkit-alianah.sch.id',
      fullName: 'Wali Kelas TK A - Ceria',
      role: 'Guru Kelas',
      assignedClassId: 'kls-tk-a',
      assignedClassName: 'TK A - Ceria',
      defaultPassword: process.env.DEFAULT_GURU_PASSWORD || 'Guru2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kelas-tkb',
      email: 'walikelas.tkb@tkit-alianah.sch.id',
      fullName: 'Wali Kelas TK B - Mandiri',
      role: 'Guru Kelas',
      assignedClassId: 'kls-tk-b',
      assignedClassName: 'TK B - Mandiri',
      defaultPassword: process.env.DEFAULT_GURU_PASSWORD || 'Guru2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kelas-sd1a',
      email: 'walikelas.sd1a@tkit-alianah.sch.id',
      fullName: 'Wali Kelas SD 1A - Amanah',
      role: 'Guru Kelas',
      assignedClassId: 'kls-sd-1a',
      assignedClassName: 'SD 1A - Amanah',
      defaultPassword: process.env.DEFAULT_GURU_PASSWORD || 'Guru2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kelas-sd2a',
      email: 'walikelas.sd2a@tkit-alianah.sch.id',
      fullName: 'Wali Kelas SD 2A - Shiddiq',
      role: 'Guru Kelas',
      assignedClassId: 'kls-sd-2a',
      assignedClassName: 'SD 2A - Shiddiq',
      defaultPassword: process.env.DEFAULT_GURU_PASSWORD || 'Guru2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kelas-sd3a',
      email: 'walikelas.sd3a@tkit-alianah.sch.id',
      fullName: 'Wali Kelas SD 3A - Fathonah',
      role: 'Guru Kelas',
      assignedClassId: 'kls-sd-3a',
      assignedClassName: 'SD 3A - Fathonah',
      defaultPassword: process.env.DEFAULT_GURU_PASSWORD || 'Guru2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kelas-sd4a',
      email: 'walikelas.sd4a@tkit-alianah.sch.id',
      fullName: 'Wali Kelas SD 4A - Tabligh',
      role: 'Guru Kelas',
      assignedClassId: 'kls-sd-4a',
      assignedClassName: 'SD 4A - Tabligh',
      defaultPassword: process.env.DEFAULT_GURU_PASSWORD || 'Guru2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kelas-sd5a',
      email: 'walikelas.sd5a@tkit-alianah.sch.id',
      fullName: 'Wali Kelas SD 5A - Al-Fatih',
      role: 'Guru Kelas',
      assignedClassId: 'kls-sd-5a',
      assignedClassName: 'SD 5A - Al-Fatih',
      defaultPassword: process.env.DEFAULT_GURU_PASSWORD || 'Guru2026!',
      authProvider: 'both',
    }),
    buildSeedAccount({
      id: 'acc-kelas-sd6a',
      email: 'walikelas.sd6a@tkit-alianah.sch.id',
      fullName: 'Wali Kelas SD 6A - Shalahuddin',
      role: 'Guru Kelas',
      assignedClassId: 'kls-sd-6a',
      assignedClassName: 'SD 6A - Shalahuddin',
      defaultPassword: process.env.DEFAULT_GURU_PASSWORD || 'Guru2026!',
      authProvider: 'both',
    }),
  ];

  return {
    version: 2,
    settings: { ...INITIAL_DEFAULT_SETTINGS },
    classes: INITIAL_DEFAULT_CLASSES.map((c) => ({ ...c })),
    students: [],
    teachers: [],
    parents: [],
    logs: [],
    accounts,
    accessRequests: [],
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeAccount(acc: StoredSchoolAccount): SchoolAccountSummary {
  return {
    id: acc.id,
    email: acc.email,
    fullName: acc.fullName,
    role: acc.role,
    assignedClassId: acc.assignedClassId,
    assignedClassName: acc.assignedClassName,
    isActive: acc.isActive,
    authProvider: acc.authProvider ?? (acc.passwordHash ? 'both' : 'google'),
    photoUrl: acc.photoUrl ?? null,
    approvedBy: acc.approvedBy ?? null,
    lastLoginAt: acc.lastLoginAt ?? null,
    createdAt: acc.createdAt,
  };
}

export class SchoolStore {
  private readonly dataDir: string;
  private readonly dbPath: string;
  private readonly secretPath: string;
  private cachedSecret: string | null = null;

  constructor(rootDir: string) {
    this.dataDir = path.resolve(rootDir, 'data');
    this.dbPath = path.join(this.dataDir, 'school-db.json');
    this.secretPath = path.join(this.dataDir, '.session-secret');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getSessionSecret(): string {
    const envSecret = process.env.AUTH_SESSION_SECRET?.trim();
    if (envSecret && envSecret.length >= 16) {
      return envSecret;
    }
    if (this.cachedSecret) return this.cachedSecret;

    this.ensureDir();
    if (fs.existsSync(this.secretPath)) {
      const existing = fs.readFileSync(this.secretPath, 'utf8').trim();
      if (existing.length >= 32) {
        this.cachedSecret = existing;
        return existing;
      }
    }

    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(this.secretPath, generated, { mode: 0o600 });
    this.cachedSecret = generated;
    return generated;
  }

  private readDb(): PersistedSchoolDatabase {
    this.ensureDir();
    if (!fs.existsSync(this.dbPath)) {
      const fresh = createInitialDatabase();
      this.writeDb(fresh);
      return fresh;
    }

    try {
      const raw = fs.readFileSync(this.dbPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedSchoolDatabase>;
      if (!parsed || !Array.isArray(parsed.accounts) || parsed.accounts.length === 0) {
        const fresh = createInitialDatabase();
        this.writeDb(fresh);
        return fresh;
      }

      const db: PersistedSchoolDatabase = {
        version: parsed.version ?? 1,
        settings: parsed.settings ?? { ...INITIAL_DEFAULT_SETTINGS },
        classes: Array.isArray(parsed.classes) ? parsed.classes : INITIAL_DEFAULT_CLASSES,
        students: Array.isArray(parsed.students) ? parsed.students : [],
        teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
        parents: Array.isArray(parsed.parents) ? parsed.parents : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        accounts: parsed.accounts,
        accessRequests: Array.isArray(parsed.accessRequests) ? parsed.accessRequests : [],
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      };

      // Migrate v1 -> v2 once to ensure Super Admin Google account & accessRequests exist
      if (db.version < 2) {
        db.version = 2;
        const ownerAcc = buildOwnerSuperAdminAccount();
        const hasSuperAdmin = db.accounts.some(
          (a) =>
            a.email.toLowerCase() === ownerAcc.email.toLowerCase() || a.role === 'Super Admin'
        );
        if (!hasSuperAdmin) {
          db.accounts.unshift(ownerAcc);
        }
        this.writeDb(db);
      }

      return db;
    } catch {
      const fresh = createInitialDatabase();
      this.writeDb(fresh);
      return fresh;
    }
  }

  private writeDb(db: PersistedSchoolDatabase): void {
    this.ensureDir();
    db.updatedAt = new Date().toISOString();
    const tmpPath = `${this.dbPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.dbPath);
  }

  signSessionToken(account: SchoolAccountSummary): string {
    const exp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    const payload = {
      sub: account.id,
      email: account.email,
      role: account.role,
      exp,
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.getSessionSecret())
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${sig}`;
  }

  verifySessionToken(token: string): SchoolAccountSummary | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.getSessionSecret())
      .update(encoded)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
        sub?: string;
        exp?: number;
      };
      if (!parsed.sub || !parsed.exp || Date.now() > parsed.exp) {
        return null;
      }

      const db = this.readDb();
      const acc = db.accounts.find((a) => a.id === parsed.sub);
      if (!acc || !acc.isActive) return null;
      return sanitizeAccount(acc);
    } catch {
      return null;
    }
  }

  authenticateEmailPassword(
    email: string,
    password: string
  ):
    | { ok: true; token: string; account: SchoolAccountSummary }
    | {
        ok: false;
        code: 'not_found' | 'invalid_password' | 'inactive' | 'google_only';
        message: string;
      } {
    const normalizedEmail = email.trim().toLowerCase();
    const db = this.readDb();
    const idx = db.accounts.findIndex((a) => a.email.toLowerCase() === normalizedEmail);
    if (idx < 0) {
      return {
        ok: false,
        code: 'not_found',
        message: 'Email tidak terdaftar pada sistem sekolah.',
      };
    }

    const acc = db.accounts[idx];
    if (!acc.passwordHash) {
      return {
        ok: false,
        code: 'google_only',
        message:
          'Akun ini terdaftar khusus untuk Login Google. Silakan klik tombol "Masuk dengan Akun Google".',
      };
    }

    if (!verifyPassword(password, acc.passwordSalt, acc.passwordHash)) {
      return {
        ok: false,
        code: 'invalid_password',
        message: 'Email atau kata sandi tidak sesuai.',
      };
    }
    if (!acc.isActive) {
      return {
        ok: false,
        code: 'inactive',
        message: 'Akun email ini sedang dinonaktifkan oleh Super Admin / Kepala Sekolah.',
      };
    }

    acc.lastLoginAt = new Date().toISOString();
    db.accounts[idx] = acc;
    this.writeDb(db);

    const safeAcc = sanitizeAccount(acc);
    return {
      ok: true,
      token: this.signSessionToken(safeAcc),
      account: safeAcc,
    };
  }

  authenticateGoogleIdentity(identity: {
    uid: string;
    email: string;
    fullName: string;
    photoUrl: string | null;
  }):
    | { status: 'approved'; token: string; account: SchoolAccountSummary }
    | { status: 'inactive'; message: string }
    | { status: 'pending_approval'; request: GoogleAccessRequest; isNewRequest: boolean } {
    const normalizedEmail = identity.email.trim().toLowerCase();
    const db = this.readDb();
    const nowIso = new Date().toISOString();

    const accIdx = db.accounts.findIndex((a) => a.email.toLowerCase() === normalizedEmail);
    if (accIdx >= 0) {
      const existingAcc = db.accounts[accIdx];
      if (!existingAcc.isActive) {
        return {
          status: 'inactive',
          message:
            'Akun Google Anda sedang dinonaktifkan oleh Super Admin / Kepala Sekolah.',
        };
      }

      const updatedAcc: StoredSchoolAccount = {
        ...existingAcc,
        googleUid: identity.uid,
        photoUrl: identity.photoUrl ?? existingAcc.photoUrl ?? null,
        authProvider: existingAcc.passwordHash ? 'both' : 'google',
        lastLoginAt: nowIso,
      };
      db.accounts[accIdx] = updatedAcc;

      // Mark any lingering request for this email as approved
      db.accessRequests = db.accessRequests.map((req) =>
        req.email.toLowerCase() === normalizedEmail && req.status !== 'approved'
          ? {
              ...req,
              status: 'approved',
              reviewedAt: nowIso,
              reviewedBy: existingAcc.approvedBy ?? 'Sistem Sekolah',
            }
          : req
      );

      this.writeDb(db);
      const safeAcc = sanitizeAccount(updatedAcc);
      return {
        status: 'approved',
        token: this.signSessionToken(safeAcc),
        account: safeAcc,
      };
    }

    // Not yet authorized -> create or update pending access request for Super Admin / Kepala Sekolah review
    const reqIdx = db.accessRequests.findIndex(
      (r) => r.email.toLowerCase() === normalizedEmail
    );

    if (reqIdx >= 0) {
      const prev = db.accessRequests[reqIdx];
      const nextReq: GoogleAccessRequest = {
        ...prev,
        fullName: identity.fullName || prev.fullName,
        photoUrl: identity.photoUrl ?? prev.photoUrl ?? null,
        googleUid: identity.uid,
        status: 'pending',
        lastAttemptAt: nowIso,
      };
      db.accessRequests[reqIdx] = nextReq;
      this.writeDb(db);
      return {
        status: 'pending_approval',
        request: nextReq,
        isNewRequest: prev.status !== 'pending',
      };
    }

    const createdRequest: GoogleAccessRequest = {
      id: `req-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      email: normalizedEmail,
      fullName: identity.fullName,
      photoUrl: identity.photoUrl,
      googleUid: identity.uid,
      status: 'pending',
      requestedRole: null,
      requestedClassId: null,
      note: null,
      requestedAt: nowIso,
      lastAttemptAt: nowIso,
      reviewedAt: null,
      reviewedBy: null,
    };

    db.accessRequests.unshift(createdRequest);
    this.writeDb(db);
    return {
      status: 'pending_approval',
      request: createdRequest,
      isNewRequest: true,
    };
  }

  updatePendingGoogleRequestPreference(
    email: string,
    input: {
      requestedRole?: UserRole | null;
      requestedClassId?: string | null;
      note?: string | null;
    }
  ): GoogleAccessRequest | null {
    const normalizedEmail = email.trim().toLowerCase();
    const db = this.readDb();
    const idx = db.accessRequests.findIndex((r) => r.email.toLowerCase() === normalizedEmail);
    if (idx < 0) return null;

    const current = db.accessRequests[idx];
    const allowedReqRole: UserRole | null =
      input.requestedRole === 'Guru Piket' ||
      input.requestedRole === 'Guru Kelas' ||
      input.requestedRole === 'Kepala Sekolah'
        ? input.requestedRole
        : current.requestedRole ?? null;

    const updated: GoogleAccessRequest = {
      ...current,
      status: 'pending',
      requestedRole: allowedReqRole,
      requestedClassId:
        allowedReqRole === 'Guru Kelas'
          ? input.requestedClassId ?? current.requestedClassId ?? null
          : null,
      note: typeof input.note === 'string' ? input.note.trim().slice(0, 160) : current.note ?? null,
      lastAttemptAt: new Date().toISOString(),
    };

    db.accessRequests[idx] = updated;
    this.writeDb(db);
    return updated;
  }

  listAccessRequests(): GoogleAccessRequest[] {
    const db = this.readDb();
    return [...db.accessRequests].sort((a, b) =>
      b.lastAttemptAt.localeCompare(a.lastAttemptAt)
    );
  }

  approveAccessRequest(
    requestId: string,
    input: {
      role: UserRole;
      assignedClassId: string | null;
      fullName?: string;
      actorRole: UserRole;
      actorName: string;
    }
  ):
    | { ok: true; account: SchoolAccountSummary; request: GoogleAccessRequest }
    | { ok: false; message: string } {
    if (input.role === 'Super Admin' && input.actorRole !== 'Super Admin') {
      return {
        ok: false,
        message: 'Hanya Super Admin yang dapat memberikan peran Super Admin.',
      };
    }

    const db = this.readDb();
    const reqIdx = db.accessRequests.findIndex((r) => r.id === requestId);
    if (reqIdx < 0) {
      return { ok: false, message: 'Permintaan izin Google tidak ditemukan.' };
    }

    const reqItem = db.accessRequests[reqIdx];
    let resolvedClassId: string | null = null;
    let resolvedClassName: string | null = null;

    if (input.role === 'Guru Kelas') {
      if (!input.assignedClassId) {
        return { ok: false, message: 'Akun Guru Kelas wajib memilih kelas binaan.' };
      }
      const cls = db.classes.find((c) => c.id === input.assignedClassId);
      if (!cls) {
        return { ok: false, message: 'Kelas binaan tidak ditemukan.' };
      }
      resolvedClassId = cls.id;
      resolvedClassName = cls.namaKelas;
    }

    const nowIso = new Date().toISOString();
    const finalName = input.fullName?.trim() || reqItem.fullName;
    const accIdx = db.accounts.findIndex(
      (a) => a.email.toLowerCase() === reqItem.email.toLowerCase()
    );

    let savedAccount: StoredSchoolAccount;
    if (accIdx >= 0) {
      const current = db.accounts[accIdx];
      savedAccount = {
        ...current,
        fullName: finalName,
        role: input.role,
        assignedClassId: resolvedClassId,
        assignedClassName: resolvedClassName,
        isActive: true,
        authProvider: current.passwordHash ? 'both' : 'google',
        photoUrl: reqItem.photoUrl ?? current.photoUrl ?? null,
        googleUid: reqItem.googleUid,
        approvedBy: input.actorName,
      };
      db.accounts[accIdx] = savedAccount;
    } else {
      savedAccount = {
        ...buildSeedAccount({
          id: `acc-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          email: reqItem.email,
          fullName: finalName,
          role: input.role,
          assignedClassId: resolvedClassId,
          assignedClassName: resolvedClassName,
          authProvider: 'google',
          approvedBy: input.actorName,
        }),
        photoUrl: reqItem.photoUrl ?? null,
        googleUid: reqItem.googleUid,
      };
      db.accounts.push(savedAccount);
    }

    const updatedReq: GoogleAccessRequest = {
      ...reqItem,
      fullName: finalName,
      status: 'approved',
      reviewedAt: nowIso,
      reviewedBy: input.actorName,
    };
    db.accessRequests[reqIdx] = updatedReq;
    this.writeDb(db);

    return {
      ok: true,
      account: sanitizeAccount(savedAccount),
      request: updatedReq,
    };
  }

  rejectAccessRequest(
    requestId: string,
    actorName: string
  ): { ok: true; request: GoogleAccessRequest } | { ok: false; message: string } {
    const db = this.readDb();
    const idx = db.accessRequests.findIndex((r) => r.id === requestId);
    if (idx < 0) {
      return { ok: false, message: 'Permintaan izin Google tidak ditemukan.' };
    }
    const updated: GoogleAccessRequest = {
      ...db.accessRequests[idx],
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: actorName,
    };
    db.accessRequests[idx] = updated;
    this.writeDb(db);
    return { ok: true, request: updated };
  }

  deleteAccessRequest(requestId: string): boolean {
    const db = this.readDb();
    const before = db.accessRequests.length;
    db.accessRequests = db.accessRequests.filter((r) => r.id !== requestId);
    if (db.accessRequests.length === before) return false;
    this.writeDb(db);
    return true;
  }

  listAccounts(): SchoolAccountSummary[] {
    const db = this.readDb();
    return db.accounts.map(sanitizeAccount);
  }

  createAccount(input: {
    email: string;
    fullName: string;
    role: UserRole;
    assignedClassId: string | null;
    password?: string;
    authProvider?: AuthProviderKind;
    actorRole: UserRole;
    actorName: string;
  }): { ok: true; account: SchoolAccountSummary } | { ok: false; message: string } {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    const password = (input.password ?? '').trim();
    const provider: AuthProviderKind =
      input.authProvider ?? (password.length > 0 ? 'both' : 'google');

    if (input.role === 'Super Admin' && input.actorRole !== 'Super Admin') {
      return {
        ok: false,
        message: 'Hanya Super Admin yang dapat membuat akun Super Admin.',
      };
    }

    if (!email || !email.includes('@')) {
      return { ok: false, message: 'Format alamat email tidak valid.' };
    }
    if (!fullName) {
      return { ok: false, message: 'Nama lengkap petugas/guru wajib diisi.' };
    }
    if (provider !== 'google' && password.length < 6) {
      return {
        ok: false,
        message: 'Kata sandi minimal 6 karakter untuk akun dengan login sandi.',
      };
    }

    const db = this.readDb();
    if (db.accounts.some((a) => a.email.toLowerCase() === email)) {
      return { ok: false, message: 'Email tersebut sudah terdaftar di sistem.' };
    }

    let resolvedClassId: string | null = null;
    let resolvedClassName: string | null = null;
    if (input.role === 'Guru Kelas') {
      if (!input.assignedClassId) {
        return { ok: false, message: 'Akun Guru Kelas wajib memilih kelas binaan.' };
      }
      const cls = db.classes.find((c) => c.id === input.assignedClassId);
      if (!cls) {
        return { ok: false, message: 'Kelas binaan tidak ditemukan.' };
      }
      resolvedClassId = cls.id;
      resolvedClassName = cls.namaKelas;
    }

    const created = buildSeedAccount({
      id: `acc-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      email,
      fullName,
      role: input.role,
      assignedClassId: resolvedClassId,
      assignedClassName: resolvedClassName,
      defaultPassword: password || undefined,
      authProvider: provider,
      approvedBy: input.actorName,
    });

    db.accounts.push(created);

    // Approve any matching pending Google request automatically
    db.accessRequests = db.accessRequests.map((r) =>
      r.email.toLowerCase() === email
        ? {
            ...r,
            status: 'approved',
            reviewedAt: new Date().toISOString(),
            reviewedBy: input.actorName,
          }
        : r
    );

    this.writeDb(db);
    return { ok: true, account: sanitizeAccount(created) };
  }

  updateAccount(
    accountId: string,
    patch: {
      email?: string;
      fullName?: string;
      role?: UserRole;
      assignedClassId?: string | null;
      isActive?: boolean;
      newPassword?: string;
      authProvider?: AuthProviderKind;
    },
    actorRole: UserRole
  ): { ok: true; account: SchoolAccountSummary } | { ok: false; message: string } {
    const db = this.readDb();
    const idx = db.accounts.findIndex((a) => a.id === accountId);
    if (idx < 0) {
      return { ok: false, message: 'Akun tidak ditemukan.' };
    }

    const current = db.accounts[idx];
    if (current.role === 'Super Admin' && actorRole !== 'Super Admin') {
      return {
        ok: false,
        message: 'Hanya Super Admin yang dapat mengubah akun Super Admin.',
      };
    }

    const nextRole = patch.role ?? current.role;
    if (nextRole === 'Super Admin' && actorRole !== 'Super Admin') {
      return {
        ok: false,
        message: 'Hanya Super Admin yang dapat menetapkan peran Super Admin.',
      };
    }

    const nextEmail = patch.email ? patch.email.trim().toLowerCase() : current.email;
    if (!nextEmail || !nextEmail.includes('@')) {
      return { ok: false, message: 'Format email tidak valid.' };
    }
    if (
      db.accounts.some((a) => a.id !== accountId && a.email.toLowerCase() === nextEmail)
    ) {
      return { ok: false, message: 'Email tersebut sudah digunakan akun lain.' };
    }

    let nextClassId =
      patch.assignedClassId !== undefined ? patch.assignedClassId : current.assignedClassId;
    let nextClassName = current.assignedClassName;

    if (nextRole === 'Guru Kelas') {
      if (!nextClassId) {
        return { ok: false, message: 'Guru Kelas wajib memiliki kelas binaan.' };
      }
      const cls = db.classes.find((c) => c.id === nextClassId);
      if (!cls) {
        return { ok: false, message: 'Kelas binaan tidak ditemukan.' };
      }
      nextClassId = cls.id;
      nextClassName = cls.namaKelas;
    } else {
      nextClassId = null;
      nextClassName = null;
    }

    let passwordSalt = current.passwordSalt;
    let passwordHash = current.passwordHash;
    let nextAuthProvider: AuthProviderKind =
      patch.authProvider ?? current.authProvider ?? (current.passwordHash ? 'both' : 'google');

    if (patch.newPassword && patch.newPassword.length > 0) {
      if (patch.newPassword.length < 6) {
        return { ok: false, message: 'Kata sandi baru minimal 6 karakter.' };
      }
      const hashed = hashPassword(patch.newPassword);
      passwordSalt = hashed.salt;
      passwordHash = hashed.hash;
      if (nextAuthProvider === 'google') {
        nextAuthProvider = 'both';
      }
    }

    const updated: StoredSchoolAccount = {
      ...current,
      email: nextEmail,
      fullName: patch.fullName ? patch.fullName.trim() : current.fullName,
      role: nextRole,
      assignedClassId: nextClassId,
      assignedClassName: nextClassName,
      isActive: patch.isActive !== undefined ? patch.isActive : current.isActive,
      authProvider: nextAuthProvider,
      passwordSalt,
      passwordHash,
    };

    db.accounts[idx] = updated;
    this.writeDb(db);
    return { ok: true, account: sanitizeAccount(updated) };
  }

  changeOwnPassword(
    accountId: string,
    currentPassword: string,
    newPassword: string
  ): { ok: true } | { ok: false; message: string } {
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, message: 'Kata sandi baru minimal 6 karakter.' };
    }
    const db = this.readDb();
    const idx = db.accounts.findIndex((a) => a.id === accountId);
    if (idx < 0) {
      return { ok: false, message: 'Akun tidak ditemukan.' };
    }

    const current = db.accounts[idx];
    if (current.passwordHash && !verifyPassword(currentPassword, current.passwordSalt, current.passwordHash)) {
      return { ok: false, message: 'Kata sandi lama tidak sesuai.' };
    }

    const hashed = hashPassword(newPassword);
    db.accounts[idx] = {
      ...current,
      authProvider: 'both',
      passwordSalt: hashed.salt,
      passwordHash: hashed.hash,
    };
    this.writeDb(db);
    return { ok: true };
  }

  deleteAccount(
    accountId: string,
    requesterId: string,
    requesterRole: UserRole
  ): { ok: true } | { ok: false; message: string } {
    if (accountId === requesterId) {
      return { ok: false, message: 'Tidak dapat menghapus akun yang sedang Anda gunakan.' };
    }
    const db = this.readDb();
    const target = db.accounts.find((a) => a.id === accountId);
    if (!target) {
      return { ok: false, message: 'Akun tidak ditemukan.' };
    }
    if (target.role === 'Super Admin' && requesterRole !== 'Super Admin') {
      return {
        ok: false,
        message: 'Hanya Super Admin yang dapat menghapus akun Super Admin.',
      };
    }

    db.accounts = db.accounts.filter((a) => a.id !== accountId);
    this.writeDb(db);
    return { ok: true };
  }

  getSnapshot(): SchoolDatabaseSnapshot {
    const db = this.readDb();
    return {
      settings: db.settings,
      classes: db.classes,
      students: db.students,
      teachers: db.teachers,
      parents: db.parents,
      logs: db.logs,
      updatedAt: db.updatedAt,
    };
  }

  saveSnapshot(
    patch: Partial<SchoolDatabaseSnapshot>,
    actorRole: UserRole,
    actorClassId: string | null = null
  ): SchoolDatabaseSnapshot {
    const db = this.readDb();
    const isFullManager = actorRole === 'Admin Sekolah' || actorRole === 'Super Admin';

    if (patch.settings && isFullManager) {
      db.settings = patch.settings;
    }
    if (patch.classes && isFullManager) {
      db.classes = patch.classes;
      const classMap = new Map(db.classes.map((c) => [c.id, c]));
      db.students = db.students.map((s) => {
        const cls = classMap.get(s.kelasId);
        return cls ? { ...s, kelasNama: cls.namaKelas, jenjang: cls.jenjang } : s;
      });
    }
    if (patch.teachers && (isFullManager || actorRole === 'Kepala Sekolah')) {
      db.teachers = patch.teachers;
    }
    if (patch.parents && isFullManager) {
      db.parents = patch.parents;
    }
    if (patch.students) {
      if (isFullManager) {
        db.students = patch.students;
      } else if (actorRole === 'Guru Kelas' && actorClassId) {
        // Safely scope Guru Kelas writes ONLY to their assignedClassId without touching other classes
        const otherClassStudents = db.students.filter((s) => s.kelasId !== actorClassId);
        const scopedIncoming = patch.students.filter((s) => s.kelasId === actorClassId);
        db.students = [...otherClassStudents, ...scopedIncoming];
      }
    }
    if (patch.logs && isFullManager) {
      db.logs = patch.logs;
    }

    this.writeDb(db);
    return this.getSnapshot();
  }

  recordAttendance(input: {
    studentId: string;
    gateType: GateType;
    method: ScanMethod;
    status: AttendanceStatus;
    petugasNama?: string;
    petugasRole?: UserRole;
    keterangan?: string;
    waktu?: string;
    tanggal?: string;
  }): { snapshot: SchoolDatabaseSnapshot; log: AttendanceLogRecord; student: StudentRecord } | null {
    const db = this.readDb();
    const studentIdx = db.students.findIndex((s) => s.id === input.studentId);
    if (studentIdx < 0) return null;

    const student = db.students[studentIdx];
    const now = new Date();
    const waktu =
      input.waktu ||
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const tanggal = input.tanggal || getLocalYYYYMMDD(now);

    const updatedStudent: StudentRecord = { ...student };
    if (input.gateType === 'Masuk') {
      updatedStudent.statusHariIni = input.status;
      updatedStudent.jamMasuk = waktu;
    } else if (input.gateType === 'Pulang') {
      updatedStudent.jamPulang = waktu;
    } else {
      updatedStudent.statusHariIni = input.status;
    }
    db.students[studentIdx] = updatedStudent;

    const petugasLabel = input.petugasNama
      ? input.petugasRole
        ? `${input.petugasNama} (${input.petugasRole})`
        : input.petugasNama
      : undefined;

    const newLog: AttendanceLogRecord = {
      id: `log-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      tanggal,
      siswaId: student.id,
      nis: student.nis,
      namaSiswa: student.nama,
      kelasNama: student.kelasNama,
      jenjang: student.jenjang,
      jenis: input.gateType,
      status: input.status,
      waktu,
      metode: input.method,
      petugasNama: petugasLabel,
      keterangan:
        input.keterangan ||
        (input.gateType === 'Pulang'
          ? `Dijemput oleh ${student.namaWali || 'Wali Murid'}`
          : input.gateType === 'Kelas'
            ? `Dicatat di Absensi Kelas${petugasLabel ? ` oleh ${petugasLabel}` : ''}`
            : `Dicatat di Gerbang Masuk${petugasLabel ? ` oleh ${petugasLabel}` : ''}`),
    };

    db.logs = [newLog, ...db.logs];
    this.writeDb(db);
    return {
      snapshot: this.getSnapshot(),
      log: newLog,
      student: updatedStudent,
    };
  }

  // Granular atomic student operations so concurrent gate scans are never overwritten
  mutateStudents(action: {
    type: 'add' | 'import' | 'update' | 'delete';
    student?: StudentRecord;
    students?: StudentRecord[];
    studentId?: string;
    actorRole: UserRole;
    actorClassId?: string | null;
  }):
    | { ok: true; snapshot: SchoolDatabaseSnapshot }
    | { ok: false; statusCode: 400 | 403 | 404; message: string } {
    const db = this.readDb();
    const isFullManager =
      action.actorRole === 'Admin Sekolah' || action.actorRole === 'Super Admin';
    const isScopedTeacher =
      action.actorRole === 'Guru Kelas' && Boolean(action.actorClassId);

    if (!isFullManager && !isScopedTeacher) {
      return { ok: false, statusCode: 403, message: 'Anda tidak memiliki izin mengubah data siswa.' };
    }

    if (action.type === 'add' && action.student) {
      if (isScopedTeacher && action.student.kelasId !== action.actorClassId) {
        return {
          ok: false,
          statusCode: 403,
          message: 'Guru Kelas hanya dapat menambah siswa pada kelas binaannya.',
        };
      }
      const nisNorm = action.student.nis.trim().toLowerCase();
      const qrNorm = action.student.qrCodeValue.trim().toLowerCase();
      if (!nisNorm || !action.student.nama.trim()) {
        return { ok: false, statusCode: 400, message: 'NIS dan nama siswa wajib diisi.' };
      }
      if (
        db.students.some(
          (s) =>
            s.nis.trim().toLowerCase() === nisNorm ||
            s.qrCodeValue.trim().toLowerCase() === qrNorm
        )
      ) {
        return {
          ok: false,
          statusCode: 400,
          message: 'NIS atau Kode QR sudah digunakan oleh siswa lain.',
        };
      }
      db.students = [...db.students, action.student];
    } else if (action.type === 'import' && Array.isArray(action.students)) {
      const existingNis = new Set(db.students.map((s) => s.nis.trim().toLowerCase()));
      const existingQr = new Set(db.students.map((s) => s.qrCodeValue.trim().toLowerCase()));
      const validList: StudentRecord[] = [];
      for (const item of action.students) {
        if (isScopedTeacher && item.kelasId !== action.actorClassId) continue;
        const nisNorm = item.nis.trim().toLowerCase();
        const qrNorm = item.qrCodeValue.trim().toLowerCase();
        if (!nisNorm || !item.nama.trim() || existingNis.has(nisNorm) || existingQr.has(qrNorm)) {
          continue;
        }
        existingNis.add(nisNorm);
        existingQr.add(qrNorm);
        validList.push(item);
      }
      db.students = [...db.students, ...validList];
    } else if (action.type === 'update' && action.student) {
      const idx = db.students.findIndex((s) => s.id === action.student!.id);
      if (idx < 0) return { ok: false, statusCode: 404, message: 'Siswa tidak ditemukan.' };
      const existing = db.students[idx];
      if (isScopedTeacher && existing.kelasId !== action.actorClassId) {
        return {
          ok: false,
          statusCode: 403,
          message: 'Guru Kelas hanya dapat mengubah siswa di kelas binaannya.',
        };
      }
      const nisNorm = action.student.nis.trim().toLowerCase();
      const qrNorm = action.student.qrCodeValue.trim().toLowerCase();
      if (
        db.students.some(
          (s) =>
            s.id !== action.student!.id &&
            (s.nis.trim().toLowerCase() === nisNorm ||
              s.qrCodeValue.trim().toLowerCase() === qrNorm)
        )
      ) {
        return {
          ok: false,
          statusCode: 400,
          message: 'NIS atau Kode QR sudah digunakan oleh siswa lain.',
        };
      }
      // Preserve live attendance timestamps from server so concurrent gate scans aren't lost
      db.students[idx] = {
        ...action.student,
        kelasId: isScopedTeacher ? existing.kelasId : action.student.kelasId,
        kelasNama: isScopedTeacher ? existing.kelasNama : action.student.kelasNama,
        statusHariIni: existing.statusHariIni,
        jamMasuk: existing.jamMasuk,
        jamPulang: existing.jamPulang,
      };
    } else if (action.type === 'delete' && action.studentId) {
      const existing = db.students.find((s) => s.id === action.studentId);
      if (!existing) return { ok: false, statusCode: 404, message: 'Siswa tidak ditemukan.' };
      if (isScopedTeacher && existing.kelasId !== action.actorClassId) {
        return {
          ok: false,
          statusCode: 403,
          message: 'Guru Kelas hanya dapat menghapus siswa di kelas binaannya.',
        };
      }
      db.students = db.students.filter((s) => s.id !== action.studentId);
    }

    this.writeDb(db);
    return { ok: true, snapshot: this.getSnapshot() };
  }

  resetData(mode: 'attendance' | 'all'): SchoolDatabaseSnapshot {
    const db = this.readDb();
    if (mode === 'attendance') {
      db.students = db.students.map((s) => ({
        ...s,
        statusHariIni: 'Belum Scan',
        jamMasuk: null,
        jamPulang: null,
      }));
      db.teachers = db.teachers.map((t) => ({
        ...t,
        kehadiranHariIni: 'Belum Absen',
        jamHadirGuru: null,
      }));
      db.logs = [];
    } else {
      db.students = [];
      db.teachers = [];
      db.parents = [];
      db.logs = [];
    }
    this.writeDb(db);
    return this.getSnapshot();
  }
}
