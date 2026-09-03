import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { DriveUser } from '../types';

declare global {
  interface Window {
    google?: any;
  }
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: DriveUser | null = null;
let tokenExpiresAt: number = 0;

export const clearCachedToken = () => {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  try {
    sessionStorage.removeItem('drive_access_token');
    sessionStorage.removeItem('drive_token_expires_at');
  } catch {}
};

export const setCachedToken = (token: string, expiresInSeconds: number = 3600) => {
  cachedAccessToken = token;
  // Expire 60 seconds early to avoid making requests with edge-of-expiry token
  tokenExpiresAt = Date.now() + Math.max(30, expiresInSeconds - 60) * 1000;
  try {
    sessionStorage.setItem('drive_access_token', token);
    sessionStorage.setItem('drive_token_expires_at', String(tokenExpiresAt));
  } catch {}
};

export const isAccessTokenValid = (): boolean => {
  return !!cachedAccessToken && Date.now() < tokenExpiresAt;
};

// Initialize cached credentials from sessionStorage if available and NOT expired
try {
  const savedToken = sessionStorage.getItem('drive_access_token');
  const savedExpiresAt = sessionStorage.getItem('drive_token_expires_at');
  const savedUser = sessionStorage.getItem('drive_user');

  if (savedToken && savedExpiresAt) {
    const exp = Number(savedExpiresAt);
    if (!isNaN(exp) && Date.now() < exp) {
      cachedAccessToken = savedToken;
      tokenExpiresAt = exp;
    } else {
      // Token has expired - discard immediately
      sessionStorage.removeItem('drive_access_token');
      sessionStorage.removeItem('drive_token_expires_at');
    }
  } else {
    // Unversioned token without expiration - clean up to prevent 401
    sessionStorage.removeItem('drive_access_token');
  }

  if (savedUser) {
    cachedUser = JSON.parse(savedUser);
  }
} catch {}

export const getCachedSession = (): { user: DriveUser | null; token: string | null } => {
  if (Date.now() >= tokenExpiresAt) {
    cachedAccessToken = null;
  }
  return { user: cachedUser, token: cachedAccessToken };
};

export const initAuth = (
  onAuthSuccess?: (user: DriveUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If we have an active, valid (non-expired) session
  if (cachedAccessToken && cachedUser && Date.now() < tokenExpiresAt) {
    if (onAuthSuccess) onAuthSuccess(cachedUser, cachedAccessToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const driveUser: DriveUser = {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        uid: user.uid,
      };
      cachedUser = driveUser;
      try {
        sessionStorage.setItem('drive_user', JSON.stringify(driveUser));
      } catch {}

      if (cachedAccessToken && Date.now() < tokenExpiresAt) {
        if (onAuthSuccess) onAuthSuccess(driveUser, cachedAccessToken);
      } else if (!isSigningIn) {
        clearCachedToken();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearCachedToken();
      cachedUser = null;
      try {
        sessionStorage.removeItem('drive_user');
      } catch {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export interface GisOptions {
  prompt?: string;
  hint?: string;
}

export const signInWithGis = async (options: GisOptions = {}): Promise<{ user: DriveUser; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Библиотека Google Identity Services еще не загрузилась. Подождите пару секунд и попробуйте снова.'));
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          const accessToken = tokenResponse.access_token;
          const expiresIn = Number(tokenResponse.expires_in) || 3600;
          setCachedToken(accessToken, expiresIn);

          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const profile = await res.json();
            const driveUser: DriveUser = {
              displayName: profile.name || profile.email || 'Пользователь Google',
              email: profile.email || null,
              photoURL: profile.picture || null,
              uid: profile.sub || 'gis-user',
            };
            cachedUser = driveUser;
            try {
              sessionStorage.setItem('drive_user', JSON.stringify(driveUser));
            } catch {}
            resolve({ user: driveUser, accessToken });
          } catch {
            const driveUser: DriveUser = {
              displayName: 'Google Пользователь',
              email: null,
              photoURL: null,
              uid: 'gis-user',
            };
            cachedUser = driveUser;
            resolve({ user: driveUser, accessToken });
          }
        },
        error_callback: (err: any) => {
          reject(err);
        },
      });

      const requestConfig: any = {
        prompt: options.prompt ?? 'consent',
      };
      if (options.hint) {
        requestConfig.hint = options.hint;
      }
      tokenClient.requestAccessToken(requestConfig);
    } catch (err) {
      reject(err);
    }
  });
};

export const googleSignIn = async (options: GisOptions = {}): Promise<{ user: DriveUser; accessToken: string } | null> => {
  // First prefer Google Identity Services (GIS) as it directly requests the Drive OAuth scopes
  if (window.google?.accounts?.oauth2) {
    try {
      return await signInWithGis(options);
    } catch (gisErr: any) {
      console.warn('GIS sign in error, falling back to Firebase popup:', gisErr);
      if (gisErr?.message?.includes('access_denied') || gisErr?.message?.includes('user-cancelled')) {
        throw gisErr;
      }
    }
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Не удалось получить токен доступа Google Drive');
    }

    setCachedToken(credential.accessToken, 3600);

    const driveUser: DriveUser = {
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
      uid: result.user.uid,
    };
    cachedUser = driveUser;
    try {
      sessionStorage.setItem('drive_user', JSON.stringify(driveUser));
    } catch {}
    return { user: driveUser, accessToken: credential.accessToken };
  } catch (error: any) {
    const isPopupBlocked =
      error?.code === 'auth/popup-blocked' ||
      error?.message?.includes('auth/popup-blocked');
    const isPopupClosed =
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request';

    if (isPopupBlocked) {
      console.warn('Google sign-in popup was blocked, attempting GIS fallback...');
      if (window.google?.accounts?.oauth2) {
        return await signInWithGis(options);
      }
    } else if (isPopupClosed) {
      console.warn('Google sign-in popup was closed before completion.');
    } else {
      console.error('Sign in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  if (Date.now() >= tokenExpiresAt) {
    cachedAccessToken = null;
  }
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  if (token) {
    setCachedToken(token, 3600);
  } else {
    clearCachedToken();
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Error signing out of firebase auth:', err);
  }
  clearCachedToken();
  cachedUser = null;
  try {
    sessionStorage.removeItem('drive_user');
  } catch {}
};
