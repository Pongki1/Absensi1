import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const GOOGLE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  photoUrl: string | null;
}

function getFirebaseProjectId(rootDir: string): string | null {
  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envProjectId) return envProjectId;

  const configPath = path.resolve(rootDir, 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: string };
    return raw.projectId?.trim() || null;
  } catch {
    return null;
  }
}

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && now < certCache.expiresAt) {
    return certCache.certs;
  }

  const res = await fetch(GOOGLE_CERT_URL);
  if (!res.ok) {
    throw new Error('Gagal mengambil sertifikat verifikasi Google Sign-In.');
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  certCache = {
    certs,
    expiresAt: now + Math.max(60, maxAgeSec) * 1000,
  };
  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T {
  try {
    const jsonStr = Buffer.from(segment, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error('Format token Google tidak valid.');
  }
}

export async function verifyFirebaseGoogleIdToken(
  idToken: string,
  rootDir: string
): Promise<VerifiedFirebaseIdentity> {
  const projectId = getFirebaseProjectId(rootDir);
  if (!projectId) {
    throw new Error('Konfigurasi Firebase projectId belum tersedia di server.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Format token Google tidak valid.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Algoritma atau ID kunci token Google tidak valid.');
  }

  const certs = await getGooglePublicCerts();
  let certPem = certs[header.kid];
  if (!certPem) {
    // Force refresh once in case Google rotated certificates
    certCache = null;
    const refreshed = await getGooglePublicCerts();
    certPem = refreshed[header.kid];
  }

  if (!certPem) {
    throw new Error('Sertifikat penandatangan token Google tidak ditemukan.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const sigBuffer = Buffer.from(signatureB64, 'base64url');
  if (!verifier.verify(certPem, sigBuffer)) {
    throw new Error('Tanda tangan token Google tidak valid.');
  }

  const payload = decodeBase64UrlJson<{
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }>(payloadB64);

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) {
    throw new Error('Token Google tidak ditujukan untuk aplikasi sekolah ini.');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Penerbit token Google tidak sesuai.');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Identitas pengguna Google tidak valid.');
  }
  if (!payload.exp || payload.exp <= nowSec - 60) {
    throw new Error('Sesi login Google sudah kedaluwarsa. Silakan masuk ulang.');
  }

  const email = (payload.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Akun Google tidak menyertakan alamat email yang valid.');
  }
  if (payload.email_verified !== true) {
    throw new Error('Email akun Google belum terverifikasi.');
  }

  return {
    uid: payload.sub,
    email,
    emailVerified: true,
    fullName: (payload.name ?? '').trim() || email.split('@')[0],
    photoUrl: typeof payload.picture === 'string' ? payload.picture : null,
  };
}
