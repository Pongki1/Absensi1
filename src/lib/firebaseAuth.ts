import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

function getFirebaseAppInstance() {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export interface GooglePopupAuthPayload {
  idToken: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  uid: string;
}

export async function signInWithGoogleAccount(): Promise<GooglePopupAuthPayload> {
  const app = getFirebaseAppInstance();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = (user.email ?? '').trim().toLowerCase();

    if (!email) {
      throw new Error('Akun Google tidak memiliki alamat email yang terverifikasi.');
    }

    const idToken = await user.getIdToken(true);
    return {
      idToken,
      email,
      displayName: user.displayName?.trim() || email.split('@')[0],
      photoUrl: user.photoURL || null,
      uid: user.uid,
    };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Jendela login Google ditutup sebelum proses masuk selesai.');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Popup login Google diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.');
    }
    if (code === 'auth/network-request-failed') {
      throw new Error('Koneksi internet terganggu saat menghubungi layanan Google.');
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error('Domain aplikasi belum terdaftar di Firebase Auth. Hubungi administrator.');
    }
    throw err instanceof Error
      ? err
      : new Error('Gagal masuk dengan akun Google. Silakan coba kembali.');
  }
}

export async function signOutFirebaseAuth(): Promise<void> {
  try {
    if (getApps().length === 0) return;
    const auth = getAuth(getApp());
    await signOut(auth);
  } catch {
    // Abaikan jika sesi Firebase belum aktif
  }
}
