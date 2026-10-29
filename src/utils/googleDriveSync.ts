import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BackupPackage,
  activateAuthenticatedUserNamespace,
  setActiveAccountNamespace,
  UNAUTHENTICATED_NAMESPACE,
} from './storage.ts';
import { executeAndVerifyRecaptcha } from './recaptchaEnterprise.ts';

// Initialize Firebase App singleton safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const DRIVE_FILE_NAME = 'ResiMed-Censo-MI.json';
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function createGoogleDriveAuthProvider(forceConsent: boolean = false): GoogleAuthProvider {
  const authProvider = new GoogleAuthProvider();
  authProvider.addScope(DRIVE_FILE_SCOPE);
  authProvider.setCustomParameters({
    prompt: forceConsent ? 'consent select_account' : 'select_account',
    include_granted_scopes: 'true',
  });
  return authProvider;
}

let isSigningIn = false;
const SESSION_TOKEN_KEY = 'resimed_gdrive_access_token_v2';
const SESSION_USER_KEY = 'resimed_gdrive_user_info_v2';
const WORKSPACE_MODE_KEY = 'resimed_workspace_mode_v2'; // 'drive' | 'local' | 'demo' | null

export interface SavedDriveUserInfo {
  email: string;
  displayName: string;
  uid: string;
  hasDriveScope?: boolean;
}

let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(SESSION_TOKEN_KEY) : null;

export type WorkspaceMode = 'drive' | 'local' | 'demo' | null;

export function getWorkspaceMode(): WorkspaceMode {
  try {
    const mode = localStorage.getItem(WORKSPACE_MODE_KEY);
    if (mode === 'drive' || mode === 'local' || mode === 'demo') return mode;
    return null;
  } catch {
    return null;
  }
}

export function setWorkspaceMode(mode: WorkspaceMode): void {
  try {
    if (!mode) {
      localStorage.removeItem(WORKSPACE_MODE_KEY);
    } else {
      localStorage.setItem(WORKSPACE_MODE_KEY, mode);
    }
  } catch (e) {
    console.error('Error setting workspace mode:', e);
  }
}

export function getSavedDriveUser(): SavedDriveUserInfo | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedDriveUserInfo;
    if (!parsed || (!parsed.uid && !parsed.email)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Verifies with Google OAuth2 tokeninfo endpoint whether the access token
 * actually holds the required Google Drive scope (`drive.file` or `drive`).
 */
export async function verifyTokenHasDriveScope(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const resp = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { method: 'GET', cache: 'no-store' }
    );
    if (!resp.ok) {
      // If offline or endpoint unreachable, assume true and let Drive API validate
      return resp.status !== 400 && resp.status !== 401;
    }
    const info = await resp.json();
    const scopesStr = String(info?.scope || '');
    return (
      scopesStr.includes('https://www.googleapis.com/auth/drive.file') ||
      scopesStr.includes('https://www.googleapis.com/auth/drive')
    );
  } catch {
    return true;
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (isSigningIn) return;

    if (user) {
      const saved = getSavedDriveUser();
      // If Firebase restored a user session, ensure the UID namespace matches the authenticated user
      activateAuthenticatedUserNamespace(user.uid, user.email);

      const userInfo: SavedDriveUserInfo = {
        email: user.email || user.uid,
        displayName: user.displayName || user.email || 'Usuario Google Drive',
        uid: user.uid,
        hasDriveScope: saved?.uid === user.uid ? saved.hasDriveScope : undefined,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(userInfo));
      }

      // If the cached token belonged to a different UID, discard it immediately
      if (saved && saved.uid && saved.uid !== user.uid) {
        clearExpiredAccessToken();
      }

      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(SESSION_USER_KEY);
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (options?: {
  forceConsent?: boolean;
}): Promise<{ user: User; accessToken: string; hasDriveScope: boolean } | null> => {
  try {
    isSigningIn = true;
    // Execute reCAPTCHA Enterprise LOGIN assessment concurrently so popup is never blocked by browser
    void executeAndVerifyRecaptcha('LOGIN').catch(() => {});

    const authProvider = createGoogleDriveAuthProvider(Boolean(options?.forceConsent));
    const result = await signInWithPopup(auth, authProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Drive');
    }

    const token = credential.accessToken;
    const hasScope = await verifyTokenHasDriveScope(token);

    // Activate canonical UID namespace (and migrate any legacy email data for this same user)
    activateAuthenticatedUserNamespace(result.user.uid, result.user.email);
    setWorkspaceMode('drive');

    if (hasScope) {
      cachedAccessToken = token;
    } else {
      // Do not cache an access token that lacks drive.file scope so we never poll Drive with a 403 token
      cachedAccessToken = null;
    }

    if (typeof window !== 'undefined') {
      if (hasScope) {
        localStorage.setItem(SESSION_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY);
      }
      localStorage.setItem(
        SESSION_USER_KEY,
        JSON.stringify({
          email: result.user.email || result.user.uid,
          displayName: result.user.displayName || result.user.email || 'Usuario Google Drive',
          uid: result.user.uid,
          hasDriveScope: hasScope,
        } satisfies SavedDriveUserInfo)
      );
    }

    return { user: result.user, accessToken: token, hasDriveScope: hasScope };
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearExpiredAccessToken = (): void => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
};

export const googleLogout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out warning:', e);
  }
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    setWorkspaceMode(null);
    setActiveAccountNamespace(UNAUTHENTICATED_NAMESPACE);
  }
};

export function getFirebaseProjectId(): string {
  return firebaseConfig.projectId || 'gen-lang-client-0796485781';
}

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

function handleDriveHttpError(status: number, errorText: string, contextMsg: string): never {
  if (status === 401) {
    clearExpiredAccessToken();
    throw new Error('DRIVE_TOKEN_EXPIRED');
  }
  if (
    status === 403 &&
    (errorText.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
      errorText.includes('insufficientPermissions') ||
      errorText.includes('insufficient authentication scopes'))
  ) {
    clearExpiredAccessToken();
    const saved = getSavedDriveUser();
    if (saved && typeof window !== 'undefined') {
      localStorage.setItem(
        SESSION_USER_KEY,
        JSON.stringify({ ...saved, hasDriveScope: false })
      );
    }
    throw new Error('DRIVE_SCOPE_INSUFFICIENT');
  }
  throw new Error(`${contextMsg}: ${status} - ${errorText}`);
}

/**
 * Search for the shared ResiMed file in user's Google Drive (Always bypasses browser HTTP cache)
 */
export async function findDriveCensusFile(accessToken: string): Promise<DriveFileInfo | null> {
  const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)&spaces=drive&_cb=${Date.now()}`;

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    handleDriveHttpError(response.status, errorText, 'Error al buscar archivo en Google Drive');
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0] as DriveFileInfo;
  }
  return null;
}

/**
 * Downloads the census JSON from Google Drive (Always bypasses browser HTTP cache)
 */
export async function downloadCensusFromDrive(
  fileId: string,
  accessToken: string
): Promise<{ data: BackupPackage; modifiedTime?: string }> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&_cb=${Date.now()}`;

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    handleDriveHttpError(response.status, errorText, 'Error al descargar archivo de Google Drive');
  }

  const json: BackupPackage = await response.json();
  return { data: json };
}

/**
 * Uploads (create or replace) the authoritative census JSON in Google Drive
 */
export async function saveCensusToDrive(
  backupData: BackupPackage,
  accessToken: string
): Promise<{ fileId: string; updatedTime: string; isNew: boolean }> {
  const savedUser = getSavedDriveUser();
  const stampedPackage: BackupPackage = {
    ...backupData,
    accountUid: backupData.accountUid || savedUser?.uid,
    accountEmail: backupData.accountEmail || savedUser?.email,
  };

  const existingFile = await findDriveCensusFile(accessToken);
  const jsonContent = JSON.stringify(stampedPackage, null, 2);

  if (existingFile) {
    // Update existing file content
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media&fields=id,modifiedTime`;
    const patchResponse = await fetch(uploadUrl, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonContent,
    });

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      handleDriveHttpError(
        patchResponse.status,
        errorText,
        'Error al actualizar censo en Google Drive'
      );
    }

    const result = await patchResponse.json();
    return {
      fileId: existingFile.id,
      updatedTime: result.modifiedTime || new Date().toISOString(),
      isNew: false,
    };
  } else {
    // Create new file with multipart upload
    const metadata = {
      name: DRIVE_FILE_NAME,
      mimeType: 'application/json',
      description: 'Censo hospitalario y notas de evolución de Medicina Interna - ResiMed MI',
    };

    const boundary = '-------resimed_boundary_' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      jsonContent +
      closeDelimiter;

    const createUrl =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';
    const postResponse = await fetch(createUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      handleDriveHttpError(postResponse.status, errorText, 'Error al crear archivo en Google Drive');
    }

    const created = await postResponse.json();
    return {
      fileId: created.id,
      updatedTime: created.modifiedTime || new Date().toISOString(),
      isNew: true,
    };
  }
}
