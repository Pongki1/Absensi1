import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, LogOut, ShieldAlert } from 'lucide-react';
import {
  DEFAULT_CLASSES,
  DEFAULT_SETTINGS,
  INITIAL_LOGS,
  INITIAL_PARENTS,
  INITIAL_STUDENTS,
  INITIAL_TEACHERS,
  ROLE_ALLOWED_PAGES,
  getRolePolicy,
} from './data/schoolData';
import type {
  AttendanceLogRecord,
  AttendanceStatus,
  ClassRoomRecord,
  GateType,
  PageId,
  ParentRecord,
  ScanMethod,
  SchoolDatabaseSnapshot,
  SchoolSettings,
  StaffAttendanceStatus,
  StudentRecord,
  TeacherRecord,
  UserRole,
} from './types/attendance';
import {
  listGoogleAccessRequests,
  restoreActiveSession,
  signInWithEmailPassword,
  signInWithGooglePopup,
  signOutSchoolAccount,
  type GoogleSignInOutcome,
  type SchoolUserProfile,
} from './services/authService';
import {
  getCleanEmptySnapshot,
  loadSchoolSnapshot,
  mutateStudentsApi,
  recordAttendanceApi,
  resetSchoolDataApi,
  saveSchoolSnapshot,
  subscribeSchoolSyncStream,
} from './services/schoolDataService';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MobileNav } from './components/MobileNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MasterImportModal } from './components/MasterImportModal';
import { NametagPrintModal } from './components/NametagPrintModal';
import { WeeklyWhatsAppFeedbackModal } from './components/WeeklyWhatsAppFeedbackModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { TeachersPage } from './pages/TeachersPage';
import { ParentsPage } from './pages/ParentsPage';
import { ClassesPage } from './pages/ClassesPage';
import { GateInPage } from './pages/GateInPage';
import { ClassAttendancePage } from './pages/ClassAttendancePage';
import { GateOutPage } from './pages/GateOutPage';
import { RecapPage } from './pages/RecapPage';
import { SettingsPage } from './pages/SettingsPage';

type AuthPhase = 'checking' | 'unauthenticated' | 'access_denied' | 'authenticated';

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getTodayYYYYMMDD(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatSyncTimeHHMMSS(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return getCurrentTimeHHMM();
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function App() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>('checking');
  const [verifiedProfile, setVerifiedProfile] = useState<SchoolUserProfile | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  const [activePage, setActivePage] = useState<PageId>('dashboard');

  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [classes, setClasses] = useState<ClassRoomRecord[]>(DEFAULT_CLASSES);
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [teachers, setTeachers] = useState<TeacherRecord[]>(INITIAL_TEACHERS);
  const [parents, setParents] = useState<ParentRecord[]>(INITIAL_PARENTS);
  const [logs, setLogs] = useState<AttendanceLogRecord[]>(INITIAL_LOGS);

  const [liveSyncConnected, setLiveSyncConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastLiveSummary, setLastLiveSummary] = useState<string | null>(null);
  const [pendingGoogleCount, setPendingGoogleCount] = useState(0);
  const [accountsSyncTick, setAccountsSyncTick] = useState(0);

  const [lastConfirmedMap, setLastConfirmedMap] = useState<
    Partial<
      Record<
        GateType,
        { student: StudentRecord; time: string; method: string; status: AttendanceStatus }
      >
    >
  >({});

  const [printModalData, setPrintModalData] = useState<{
    students: StudentRecord[];
    title: string;
  } | null>(null);

  const [feedbackStudent, setFeedbackStudent] = useState<StudentRecord | null>(null);
  const [isMasterImportOpen, setIsMasterImportOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const applySnapshot = useCallback((snapshot: SchoolDatabaseSnapshot) => {
    setSettings(snapshot.settings);
    setClasses(snapshot.classes);
    setStudents(snapshot.students);
    setTeachers(snapshot.teachers);
    setParents(snapshot.parents);
    setLogs(snapshot.logs);
    setLastSyncedAt(formatSyncTimeHHMMSS(snapshot.updatedAt));
  }, []);

  const refreshPendingGoogleCount = useCallback(async (role?: UserRole) => {
    const targetRole = role;
    if (
      targetRole !== 'Super Admin' &&
      targetRole !== 'Admin Sekolah' &&
      targetRole !== 'Kepala Sekolah'
    ) {
      setPendingGoogleCount(0);
      return;
    }
    try {
      const list = await listGoogleAccessRequests();
      setPendingGoogleCount(list.filter((r) => r.status === 'pending').length);
    } catch {
      // Ignore transient errors
    }
  }, []);

  // Restore active session on load
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const profile = await restoreActiveSession();
        if (!active) return;

        if (!profile) {
          setVerifiedProfile(null);
          setAuthPhase('unauthenticated');
          return;
        }

        if (!profile.isActive) {
          setVerifiedProfile(null);
          setAuthErrorMessage('Akun Anda sedang dinonaktifkan oleh Super Admin / Kepala Sekolah.');
          setAuthPhase('access_denied');
          return;
        }

        setVerifiedProfile(profile);
        setActivePage(getRolePolicy(profile.appRole).defaultPage);
        setAuthPhase('authenticated');
      } catch {
        if (!active) return;
        setVerifiedProfile(null);
        setAuthPhase('unauthenticated');
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, []);

  // Load persisted school database + subscribe to real-time SSE stream once authenticated
  useEffect(() => {
    if (authPhase !== 'authenticated' || !verifiedProfile) return;
    let active = true;

    const loadAll = async () => {
      const snapshot = await loadSchoolSnapshot();
      if (!active) return;
      applySnapshot(snapshot);
      await refreshPendingGoogleCount(verifiedProfile.appRole);
    };

    void loadAll();

    const unsubscribe = subscribeSchoolSyncStream(
      (event) => {
        if (!active) return;
        if (event.summary) {
          setLastLiveSummary(event.summary);
        }

        if (event.type === 'attendance_recorded' || event.type === 'snapshot_updated') {
          void loadSchoolSnapshot().then((snapshot) => {
            if (active) applySnapshot(snapshot);
          });
        }

        if (event.type === 'accounts_updated') {
          setAccountsSyncTick((t) => t + 1);
          void refreshPendingGoogleCount(verifiedProfile.appRole);
          // Re-verify active session in case current user's role/class/active status changed
          void restoreActiveSession().then((latestProfile) => {
            if (!active) return;
            if (!latestProfile || !latestProfile.isActive) {
              setVerifiedProfile(null);
              setAuthErrorMessage(
                'Izin akses akun Anda telah diperbarui atau dinonaktifkan oleh Super Admin / Kepala Sekolah.'
              );
              setAuthPhase('access_denied');
              return;
            }
            setVerifiedProfile(latestProfile);
          });
        }
      },
      (connected) => {
        if (active) setLiveSyncConnected(connected);
      }
    );

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        void loadAll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    // Gentle safety sync fallback if SSE is buffered by an external proxy
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAll();
      }
    }, 60000);

    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      window.clearInterval(intervalId);
    };
  }, [authPhase, verifiedProfile?.id, verifiedProfile?.appRole, applySnapshot, refreshPendingGoogleCount]);

  const handleSignIn = async (email: string, password: string): Promise<string | null> => {
    setAuthErrorMessage(null);
    const result = await signInWithEmailPassword(email, password);
    if (!result.ok) {
      return result.message;
    }

    setVerifiedProfile(result.profile);
    setActivePage(getRolePolicy(result.profile.appRole).defaultPage);
    setAuthPhase('authenticated');
    return null;
  };

  const handleGoogleSignIn = async (): Promise<GoogleSignInOutcome> => {
    setAuthErrorMessage(null);
    const outcome = await signInWithGooglePopup();
    if (outcome.status === 'approved') {
      setVerifiedProfile(outcome.profile);
      setActivePage(getRolePolicy(outcome.profile.appRole).defaultPage);
      setAuthPhase('authenticated');
    }
    return outcome;
  };

  const handleLogout = async () => {
    try {
      await signOutSchoolAccount();
    } finally {
      setVerifiedProfile(null);
      setAuthErrorMessage(null);
      setPrintModalData(null);
      setFeedbackStudent(null);
      setIsMasterImportOpen(false);
      setIsChangePasswordOpen(false);
      setLiveSyncConnected(false);
      setLastLiveSummary(null);
      setPendingGoogleCount(0);
      setActivePage('dashboard');
      setAuthPhase('unauthenticated');
    }
  };

  const activeRole: UserRole = verifiedProfile?.appRole ?? 'Admin Sekolah';
  const rolePolicy = useMemo(() => getRolePolicy(activeRole), [activeRole]);
  const allowedPages = useMemo<PageId[]>(
    () => ROLE_ALLOWED_PAGES[activeRole].filter((p) => p !== 'login'),
    [activeRole]
  );

  // Class scoping for Guru Kelas
  const isClassScoped =
    rolePolicy.scopedToClass && Boolean(verifiedProfile?.assignedClassId);
  const scopedClassId = isClassScoped ? (verifiedProfile?.assignedClassId ?? null) : null;
  const scopedClassName = useMemo(() => {
    if (!scopedClassId) return null;
    return (
      classes.find((c) => c.id === scopedClassId)?.namaKelas ??
      verifiedProfile?.assignedClassName ??
      null
    );
  }, [scopedClassId, classes, verifiedProfile?.assignedClassName]);

  const visibleStudents = useMemo(() => {
    if (!scopedClassId) return students;
    return students.filter((s) => s.kelasId === scopedClassId);
  }, [students, scopedClassId]);

  const visibleClasses = useMemo(() => {
    if (!scopedClassId) return classes;
    return classes.filter((c) => c.id === scopedClassId);
  }, [classes, scopedClassId]);

  const visibleLogs = useMemo(() => {
    if (!scopedClassId) return logs;
    const studentIdSet = new Set(visibleStudents.map((s) => s.id));
    return logs.filter(
      (l) => studentIdSet.has(l.siswaId) || (scopedClassName && l.kelasNama === scopedClassName)
    );
  }, [logs, scopedClassId, visibleStudents, scopedClassName]);

  const persistSnapshotPatch = (patch: Partial<SchoolDatabaseSnapshot>) => {
    const nextSnapshot: SchoolDatabaseSnapshot = {
      settings: patch.settings ?? settings,
      classes: patch.classes ?? classes,
      students: patch.students ?? students,
      teachers: patch.teachers ?? teachers,
      parents: patch.parents ?? parents,
      logs: patch.logs ?? logs,
    };

    if (patch.settings) setSettings(patch.settings);
    if (patch.classes) setClasses(patch.classes);
    if (patch.students) setStudents(patch.students);
    if (patch.teachers) setTeachers(patch.teachers);
    if (patch.parents) setParents(patch.parents);
    if (patch.logs) setLogs(patch.logs);

    void saveSchoolSnapshot(patch, nextSnapshot).then((saved) => {
      if (saved) applySnapshot(saved);
    });
  };

  if (authPhase === 'checking') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-3 shadow-xs">
          <img
            src="/assets/aistudio/logo_TKIT_1e974d49.png"
            alt="Logo TKIT AL-I'ANAH"
            className="mx-auto h-14 w-14 rounded-2xl border border-slate-200 bg-white object-contain p-1"
          />
          <h1 className="text-base font-bold text-slate-900">
            SMART ABSENSI TKIT AL-I&apos;ANAH
          </h1>
          <p className="text-xs text-slate-600">Memeriksa sesi autentikasi...</p>
          <div className="mx-auto h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 rounded-full bg-blue-600 animate-pulse" />
          </div>
        </div>
        <OfflineIndicator />
      </div>
    );
  }

  if (authPhase === 'unauthenticated') {
    return (
      <>
        <LoginPage
          onSignIn={handleSignIn}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleApproved={(profile) => {
            setAuthErrorMessage(null);
            setVerifiedProfile(profile);
            setActivePage(getRolePolicy(profile.appRole).defaultPage);
            setAuthPhase('authenticated');
          }}
          initialError={authErrorMessage}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (authPhase === 'access_denied' || !verifiedProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Akses Aplikasi Ditolak</h1>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              {authErrorMessage ||
                'Profil akun Anda tidak valid atau sedang dinonaktifkan oleh Super Admin / Kepala Sekolah.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar &amp; Kembali ke Halaman Login</span>
          </button>
        </div>
        <OfflineIndicator />
      </div>
    );
  }

  const handleNavigate = (page: PageId) => {
    if (!allowedPages.includes(page)) {
      setActivePage('dashboard');
      return;
    }
    setActivePage(page);
  };

  const handleConfirmAttendance = async (
    gateType: GateType,
    student: StudentRecord,
    method: ScanMethod,
    confirmedStatus: AttendanceStatus
  ) => {
    const waktu = getCurrentTimeHHMM();
    const tanggal = getTodayYYYYMMDD();

    const result = await recordAttendanceApi({
      student,
      gateType,
      method,
      status: confirmedStatus,
      waktu,
      tanggal,
      petugasNama: `${verifiedProfile.fullName} (${verifiedProfile.appRole})`,
    });

    if (result.snapshot) {
      applySnapshot(result.snapshot);
    } else {
      const nextLogs = [result.log, ...logs];
      const nextStudents = students.map((s) =>
        s.id === student.id ? result.student : s
      );
      persistSnapshotPatch({ students: nextStudents, logs: nextLogs });
    }

    setLastConfirmedMap((prev) => ({
      ...prev,
      [gateType]: {
        student: result.student,
        time: waktu,
        method,
        status: confirmedStatus,
      },
    }));
  };

  const handleUpdateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    const target = students.find((s) => s.id === studentId);
    if (!target) return;
    void handleConfirmAttendance('Kelas', target, 'Manual Kelas', status);
  };

  const handleMutateStudents = async (action: {
    type: 'add' | 'import' | 'update' | 'delete';
    student?: StudentRecord;
    students?: StudentRecord[];
    studentId?: string;
  }) => {
    const serverSnapshot = await mutateStudentsApi(action);
    if (action.type === 'delete' && action.studentId) {
      setLastConfirmedMap((prev) => {
        const next = { ...prev };
        for (const gate of ['Masuk', 'Kelas', 'Pulang'] as GateType[]) {
          if (next[gate]?.student.id === action.studentId) {
            delete next[gate];
          }
        }
        return next;
      });
    }

    if (serverSnapshot) {
      applySnapshot(serverSnapshot);
      return;
    }

    // Offline fallback
    if (action.type === 'add' && action.student) {
      persistSnapshotPatch({ students: [...students, action.student] });
    } else if (action.type === 'import' && action.students) {
      persistSnapshotPatch({ students: [...students, ...action.students] });
    } else if (action.type === 'update' && action.student) {
      persistSnapshotPatch({
        students: students.map((s) => (s.id === action.student!.id ? action.student! : s)),
      });
    } else if (action.type === 'delete' && action.studentId) {
      persistSnapshotPatch({
        students: students.filter((s) => s.id !== action.studentId),
      });
    }
  };

  const handleUpdateTeacherAttendance = (
    teacherId: string,
    status: StaffAttendanceStatus
  ) => {
    const time = status === 'Hadir' ? getCurrentTimeHHMM() : null;
    const nextTeachers = teachers.map((t) =>
      t.id === teacherId
        ? { ...t, kehadiranHariIni: status, jamHadirGuru: time }
        : t
    );
    persistSnapshotPatch({ teachers: nextTeachers });
  };

  const handleResetTeacherAttendance = () => {
    const nextTeachers = teachers.map((t) => ({
      ...t,
      kehadiranHariIni: 'Belum Absen' as StaffAttendanceStatus,
      jamHadirGuru: null,
    }));
    persistSnapshotPatch({ teachers: nextTeachers });
  };

  const handleResetAllAttendance = async () => {
    const serverSnapshot = await resetSchoolDataApi('attendance');
    if (serverSnapshot) {
      applySnapshot(serverSnapshot);
    } else {
      const nextStudents = students.map((s) => ({
        ...s,
        statusHariIni: 'Belum Scan' as AttendanceStatus,
        jamMasuk: null,
        jamPulang: null,
      }));
      const nextTeachers = teachers.map((t) => ({
        ...t,
        kehadiranHariIni: 'Belum Absen' as StaffAttendanceStatus,
        jamHadirGuru: null,
      }));
      persistSnapshotPatch({ students: nextStudents, teachers: nextTeachers, logs: [] });
    }
    setLastConfirmedMap({});
  };

  const handleClearMasterData = async () => {
    const serverSnapshot = await resetSchoolDataApi('all');
    if (serverSnapshot) {
      applySnapshot(serverSnapshot);
    } else {
      const empty = getCleanEmptySnapshot();
      persistSnapshotPatch({
        students: empty.students,
        teachers: empty.teachers,
        parents: empty.parents,
        logs: empty.logs,
      });
    }
    setLastConfirmedMap({});
  };

  const openPrintAll = () => {
    if (!rolePolicy.canPrintNametags) return;
    setPrintModalData({
      students: visibleStudents,
      title: scopedClassName
        ? `Kartu Nametag QR Siswa — ${scopedClassName}`
        : `Semua Kartu Nametag QR Siswa (${visibleStudents.length} Siswa)`,
    });
  };

  const isAdmin = activeRole === 'Admin Sekolah' || activeRole === 'Super Admin';
  const canAuthorizeUsers = isAdmin || activeRole === 'Kepala Sekolah';

  const renderPage = () => {
    if (!allowedPages.includes(activePage)) {
      return (
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Akses Halaman Dibatasi</h2>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              Role <strong className="text-slate-900">{verifiedProfile.appRole}</strong> tidak
              memiliki izin untuk membuka halaman ini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActivePage(rolePolicy.defaultPage)}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 min-h-[44px]"
          >
            Kembali ke Halaman Utama
          </button>
        </div>
      );
    }

    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            activeRole={activeRole}
            verifiedProfile={verifiedProfile}
            rolePolicy={rolePolicy}
            allowedPages={allowedPages}
            assignedClassName={scopedClassName}
            liveSyncConnected={liveSyncConnected}
            lastSyncedAt={lastSyncedAt}
            lastLiveSummary={lastLiveSummary}
            pendingGoogleCount={pendingGoogleCount}
            canAuthorizeUsers={canAuthorizeUsers}
            students={visibleStudents}
            classes={visibleClasses}
            logs={visibleLogs}
            onNavigate={handleNavigate}
            onOpenPrintAll={openPrintAll}
          />
        );
      case 'siswa':
        return (
          <StudentsPage
            students={visibleStudents}
            allStudents={students}
            classes={classes}
            scopedClassId={scopedClassId}
            scopedClassName={scopedClassName}
            canPrintNametags={rolePolicy.canPrintNametags}
            canSendWeeklyFeedback={rolePolicy.canSendWeeklyFeedback}
            canImportStudents={rolePolicy.canImportStudents}
            onPrintStudents={(targetStudents, title) => {
              if (!rolePolicy.canPrintNametags) return;
              setPrintModalData({ students: targetStudents, title });
            }}
            onOpenWeeklyFeedback={(student) => {
              if (!rolePolicy.canSendWeeklyFeedback) return;
              setFeedbackStudent(student);
            }}
            onImportStudents={(imported) => {
              if (!rolePolicy.canImportStudents) return;
              void handleMutateStudents({ type: 'import', students: imported });
            }}
            onAddStudent={(created) => {
              if (!rolePolicy.canImportStudents) return;
              void handleMutateStudents({ type: 'add', student: created });
            }}
            onUpdateStudent={(updated) => {
              if (!rolePolicy.canImportStudents) return;
              void handleMutateStudents({ type: 'update', student: updated });
            }}
            onDeleteStudent={(studentId) => {
              if (!rolePolicy.canImportStudents) return;
              void handleMutateStudents({ type: 'delete', studentId });
            }}
          />
        );
      case 'guru':
        return (
          <TeachersPage
            teachers={teachers}
            classes={classes}
            canImportStaff={rolePolicy.canImportStaff}
            onImportTeachers={(imported) => {
              if (!rolePolicy.canImportStaff) return;
              persistSnapshotPatch({ teachers: [...teachers, ...imported] });
            }}
            onAddTeacher={(created) => {
              if (!rolePolicy.canImportStaff) return;
              persistSnapshotPatch({ teachers: [...teachers, created] });
            }}
            onUpdateTeacher={(updated) => {
              if (!rolePolicy.canImportStaff) return;
              persistSnapshotPatch({
                teachers: teachers.map((t) => (t.id === updated.id ? updated : t)),
              });
            }}
            onDeleteTeacher={(teacherId) => {
              if (!rolePolicy.canImportStaff) return;
              persistSnapshotPatch({
                teachers: teachers.filter((t) => t.id !== teacherId),
              });
            }}
            onUpdateTeacherAttendance={handleUpdateTeacherAttendance}
            onResetTeacherAttendance={handleResetTeacherAttendance}
          />
        );
      case 'orang-tua':
        return (
          <ParentsPage
            parents={parents}
            students={students}
            canSendWeeklyFeedback={rolePolicy.canSendWeeklyFeedback}
            canManageParents={isAdmin}
            onOpenWeeklyFeedback={(student) => {
              if (!rolePolicy.canSendWeeklyFeedback) return;
              setFeedbackStudent(student);
            }}
            onAddParent={(created) => {
              persistSnapshotPatch({ parents: [...parents, created] });
            }}
            onToggleParentStatus={(parentId) => {
              persistSnapshotPatch({
                parents: parents.map((p) =>
                  p.id === parentId
                    ? {
                        ...p,
                        izinPenjemputan:
                          p.izinPenjemputan === 'Terverifikasi'
                            ? 'Menunggu Verifikasi'
                            : 'Terverifikasi',
                      }
                    : p
                ),
              });
            }}
            onDeleteParent={(parentId) => {
              persistSnapshotPatch({
                parents: parents.filter((p) => p.id !== parentId),
              });
            }}
          />
        );
      case 'kelas':
        return (
          <ClassesPage
            classes={classes}
            students={students}
            canPrintNametags={rolePolicy.canPrintNametags}
            canManageClasses={isAdmin}
            onPrintStudents={(targetStudents, title) => {
              if (!rolePolicy.canPrintNametags) return;
              setPrintModalData({ students: targetStudents, title });
            }}
            onAddClass={(created) => {
              persistSnapshotPatch({ classes: [...classes, created] });
            }}
            onUpdateClass={(updated) => {
              persistSnapshotPatch({
                classes: classes.map((c) => (c.id === updated.id ? updated : c)),
              });
            }}
            onDeleteClass={(classId) => {
              persistSnapshotPatch({
                classes: classes.filter((c) => c.id !== classId),
              });
            }}
          />
        );
      case 'absensi-gerbang-masuk':
        return (
          <GateInPage
            students={students}
            logs={logs}
            batasTerlambat={settings.batasTerlambat}
            lastConfirmed={lastConfirmedMap.Masuk ?? null}
            onConfirmGateIn={(student, method, status) =>
              void handleConfirmAttendance('Masuk', student, method, status)
            }
          />
        );
      case 'absensi-kelas':
        return (
          <ClassAttendancePage
            classes={visibleClasses}
            students={visibleStudents}
            lockedClassId={scopedClassId}
            lastConfirmed={lastConfirmedMap.Kelas ?? null}
            onConfirmClass={(student, method, status) =>
              void handleConfirmAttendance('Kelas', student, method, status)
            }
            onUpdateStudentStatus={handleUpdateStudentStatus}
          />
        );
      case 'absensi-gerbang-pulang':
        return (
          <GateOutPage
            students={students}
            logs={logs}
            lastConfirmed={lastConfirmedMap.Pulang ?? null}
            onConfirmGateOut={(student, method, status) =>
              void handleConfirmAttendance('Pulang', student, method, status)
            }
          />
        );
      case 'rekap-absensi':
        return (
          <RecapPage
            students={visibleStudents}
            classes={visibleClasses}
            logs={visibleLogs}
            scopedClassId={scopedClassId}
            scopedClassName={scopedClassName}
            canExportCsv={rolePolicy.canExportCsv}
            canSendWeeklyFeedback={rolePolicy.canSendWeeklyFeedback}
            canResetAttendance={rolePolicy.canImportStudents && rolePolicy.canImportStaff}
            onOpenWeeklyFeedback={(student) => {
              if (!rolePolicy.canSendWeeklyFeedback) return;
              setFeedbackStudent(student);
            }}
            onResetAttendance={() => void handleResetAllAttendance()}
          />
        );
      case 'pengaturan':
        return (
          <SettingsPage
            settings={settings}
            classes={classes}
            currentUserId={verifiedProfile.id}
            currentUserRole={activeRole}
            canImportMaster={rolePolicy.canImportStudents && rolePolicy.canImportStaff}
            canManageAccounts={canAuthorizeUsers}
            canEditSystemSettings={isAdmin}
            accountsSyncTick={accountsSyncTick}
            liveSyncConnected={liveSyncConnected}
            studentCount={students.length}
            teacherCount={teachers.length}
            logCount={logs.length}
            onSaveSettings={(nextSettings) => persistSnapshotPatch({ settings: nextSettings })}
            onOpenMasterImport={() => setIsMasterImportOpen(true)}
            onResetAttendance={() => void handleResetAllAttendance()}
            onClearMasterData={() => void handleClearMasterData()}
            onAccountsChanged={() => void refreshPendingGoogleCount(activeRole)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activePage={activePage}
        verifiedProfile={verifiedProfile}
        allowedPages={allowedPages}
        pendingGoogleCount={canAuthorizeUsers ? pendingGoogleCount : 0}
        onNavigate={handleNavigate}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={() => void handleLogout()}
      />

      <div className="lg:pl-[264px] flex flex-col min-h-screen">
        <TopBar
          activePage={activePage}
          verifiedProfile={verifiedProfile}
          canPrintNametags={rolePolicy.canPrintNametags}
          liveSyncConnected={liveSyncConnected}
          lastSyncedAt={lastSyncedAt}
          onOpenPrintAll={openPrintAll}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onLogout={() => void handleLogout()}
        />

        <MobileNav
          activePage={activePage}
          verifiedProfile={verifiedProfile}
          canPrintNametags={rolePolicy.canPrintNametags}
          allowedPages={allowedPages}
          pendingGoogleCount={canAuthorizeUsers ? pendingGoogleCount : 0}
          onNavigate={handleNavigate}
          onOpenPrintAll={openPrintAll}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onLogout={() => void handleLogout()}
        />

        <main className="no-print flex-1 px-4 py-5 sm:px-6 lg:px-8 pb-24 lg:pb-8 max-w-[1320px] w-full mx-auto">
          {renderPage()}
        </main>
      </div>

      {printModalData && (
        <NametagPrintModal
          students={printModalData.students}
          title={printModalData.title}
          onClose={() => setPrintModalData(null)}
        />
      )}

      {feedbackStudent && (
        <WeeklyWhatsAppFeedbackModal
          student={feedbackStudent}
          logs={logs}
          senderRole={verifiedProfile.appRole}
          onClose={() => setFeedbackStudent(null)}
        />
      )}

      {isMasterImportOpen && rolePolicy.canImportStudents && rolePolicy.canImportStaff && (
        <MasterImportModal
          existingStudents={students}
          existingTeachers={teachers}
          classes={classes}
          onImportMaster={({ students: newStudents, teachers: newTeachers }) => {
            if (newStudents.length > 0) {
              void handleMutateStudents({ type: 'import', students: newStudents });
            }
            if (newTeachers.length > 0) {
              persistSnapshotPatch({ teachers: [...teachers, ...newTeachers] });
            }
          }}
          onClose={() => setIsMasterImportOpen(false)}
        />
      )}

      {isChangePasswordOpen &&
        verifiedProfile.authSource === 'school_server' &&
        verifiedProfile.authProvider !== 'google' && (
          <ChangePasswordModal
            userEmail={verifiedProfile.email}
            fullName={verifiedProfile.fullName}
            onClose={() => setIsChangePasswordOpen(false)}
          />
        )}

      <OfflineIndicator />
    </div>
  );
}
