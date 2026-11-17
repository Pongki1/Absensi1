import {
  DEFAULT_CLASSES,
  DEFAULT_SETTINGS,
  INITIAL_LOGS,
  INITIAL_PARENTS,
  INITIAL_STUDENTS,
  INITIAL_TEACHERS,
} from '../data/schoolData';
import type {
  AttendanceLogRecord,
  AttendanceStatus,
  GateType,
  ScanMethod,
  SchoolDatabaseSnapshot,
  SchoolSyncEvent,
  StudentRecord,
} from '../types/attendance';
import { getStoredAuthToken } from './authService';

const LOCAL_MIRROR_KEY = 'smart_absensi_school_snapshot_v2';

function authHeaders(): Record<string, string> {
  const token = getStoredAuthToken();
  return token
    ? {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      }
    : {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
}

export function getCleanEmptySnapshot(): SchoolDatabaseSnapshot {
  return {
    settings: { ...DEFAULT_SETTINGS },
    classes: DEFAULT_CLASSES.map((c) => ({ ...c })),
    students: INITIAL_STUDENTS,
    teachers: INITIAL_TEACHERS,
    parents: INITIAL_PARENTS,
    logs: INITIAL_LOGS,
  };
}

function readLocalMirror(): SchoolDatabaseSnapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SchoolDatabaseSnapshot>;
    if (!parsed || !parsed.settings || !Array.isArray(parsed.classes)) return null;
    return {
      settings: parsed.settings,
      classes: parsed.classes,
      students: Array.isArray(parsed.students) ? parsed.students : [],
      teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
      parents: Array.isArray(parsed.parents) ? parsed.parents : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeLocalMirror(snapshot: SchoolDatabaseSnapshot): void {
  try {
    localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

export async function loadSchoolSnapshot(): Promise<SchoolDatabaseSnapshot> {
  try {
    const res = await fetch('/api/school-data', {
      method: 'GET',
      headers: authHeaders(),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as SchoolDatabaseSnapshot;
      writeLocalMirror(data);
      return data;
    }
  } catch {
    // Offline or static fallback
  }

  return readLocalMirror() ?? getCleanEmptySnapshot();
}

export async function saveSchoolSnapshot(
  patch: Partial<SchoolDatabaseSnapshot>,
  fullMirrorSnapshot: SchoolDatabaseSnapshot
): Promise<SchoolDatabaseSnapshot> {
  writeLocalMirror(fullMirrorSnapshot);
  try {
    const res = await fetch('/api/school-data', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = (await res.json()) as SchoolDatabaseSnapshot;
      writeLocalMirror(updated);
      return updated;
    }
  } catch {
    // Offline fallback already saved to localStorage
  }
  return fullMirrorSnapshot;
}

export async function mutateStudentsApi(action: {
  type: 'add' | 'import' | 'update' | 'delete';
  student?: StudentRecord;
  students?: StudentRecord[];
  studentId?: string;
}): Promise<SchoolDatabaseSnapshot | null> {
  try {
    const res = await fetch('/api/school-data/students/mutate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(action),
    });
    if (res.ok) {
      const updated = (await res.json()) as SchoolDatabaseSnapshot;
      writeLocalMirror(updated);
      return updated;
    }
  } catch {
    // Offline fallback handled by caller
  }
  return null;
}

export async function recordAttendanceApi(input: {
  student: StudentRecord;
  gateType: GateType;
  method: ScanMethod;
  status: AttendanceStatus;
  waktu: string;
  tanggal: string;
  petugasNama?: string;
}): Promise<{
  snapshot: SchoolDatabaseSnapshot | null;
  log: AttendanceLogRecord;
  student: StudentRecord;
}> {
  try {
    const res = await fetch('/api/school-data/attendance', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        studentId: input.student.id,
        gateType: input.gateType,
        method: input.method,
        status: input.status,
        waktu: input.waktu,
        tanggal: input.tanggal,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        snapshot: SchoolDatabaseSnapshot;
        log: AttendanceLogRecord;
        student: StudentRecord;
      };
      writeLocalMirror(data.snapshot);
      return data;
    }
  } catch {
    // Offline fallback
  }

  const updatedStudent: StudentRecord = { ...input.student };
  if (input.gateType === 'Masuk') {
    updatedStudent.statusHariIni = input.status;
    updatedStudent.jamMasuk = input.waktu;
  } else if (input.gateType === 'Pulang') {
    updatedStudent.jamPulang = input.waktu;
  } else {
    updatedStudent.statusHariIni = input.status;
  }

  const fallbackLog: AttendanceLogRecord = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tanggal: input.tanggal,
    siswaId: input.student.id,
    nis: input.student.nis,
    namaSiswa: input.student.nama,
    kelasNama: input.student.kelasNama,
    jenjang: input.student.jenjang,
    jenis: input.gateType,
    status: input.status,
    waktu: input.waktu,
    metode: input.method,
    petugasNama: input.petugasNama,
    keterangan:
      input.gateType === 'Pulang'
        ? `Dijemput oleh ${input.student.namaWali || 'Wali Murid'}`
        : `Dicatat di ${input.gateType === 'Kelas' ? 'Absensi Kelas' : 'Gerbang Masuk'}`,
  };

  return {
    snapshot: null,
    log: fallbackLog,
    student: updatedStudent,
  };
}

export async function resetSchoolDataApi(
  mode: 'attendance' | 'all'
): Promise<SchoolDatabaseSnapshot | null> {
  try {
    const res = await fetch('/api/school-data/reset', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      const updated = (await res.json()) as SchoolDatabaseSnapshot;
      writeLocalMirror(updated);
      return updated;
    }
  } catch {
    // Fallback handled by caller
  }
  return null;
}

export function subscribeSchoolSyncStream(
  onSyncEvent: (event: SchoolSyncEvent) => void,
  onConnectionChange?: (connected: boolean) => void
): () => void {
  const token = getStoredAuthToken();
  if (!token || typeof EventSource === 'undefined') {
    onConnectionChange?.(false);
    return () => {};
  }

  const url = `/api/school-data/stream?token=${encodeURIComponent(token)}`;
  const source = new EventSource(url);

  source.addEventListener('connected', () => {
    onConnectionChange?.(true);
  });

  source.addEventListener('school_sync', (ev) => {
    try {
      const parsed = JSON.parse((ev as MessageEvent<string>).data) as SchoolSyncEvent;
      onSyncEvent(parsed);
    } catch {
      // Ignore malformed SSE frame
    }
  });

  source.onerror = () => {
    onConnectionChange?.(false);
  };

  return () => {
    onConnectionChange?.(false);
    source.close();
  };
}
