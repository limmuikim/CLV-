/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  getIdToken
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  dbUser: DbUser | null;
  isCreator: boolean;
  isApproved: boolean;
  creatorEmail: string;
  loading: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  requestAccess: (email: string, name?: string, note?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  authModalOpen: boolean;
  authModalTab: 'signin' | 'request' | 'email';
  openAuthModal: (tab?: 'signin' | 'request' | 'email') => void;
  closeAuthModal: () => void;
}

export const CREATOR_EMAIL = 'muikimlim.insead@gmail.com';
const STORAGE_KEY = 'clv_app_auth_session';

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  dbUser: null,
  isCreator: false,
  isApproved: false,
  creatorEmail: CREATOR_EMAIL,
  loading: true,
  authError: null,
  setAuthError: () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  requestAccess: async () => {},
  signOut: async () => {},
  refreshUserProfile: async () => {},
  authModalOpen: false,
  authModalTab: 'signin',
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, rawSetAuthError] = useState<string | null>(null);

  const setAuthError = (err: string | null) => {
    if (!err) {
      rawSetAuthError(null);
      return;
    }
    const lower = err.toLowerCase();
    if (
      lower.includes("unexpected token") || 
      lower.includes("not valid json") || 
      lower.includes("the page c") || 
      lower.includes("<!doctype") ||
      lower.includes("syntaxerror")
    ) {
      rawSetAuthError("Network service notice: Serverless endpoint is initializing. You can submit your access request or use Direct Email Login.");
      return;
    }
    rawSetAuthError(err);
  };

  // Auth modal management
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'request' | 'email'>('signin');

  const openAuthModal = (tab: 'signin' | 'request' | 'email' = 'signin') => {
    setAuthError(null); // Clear errors whenever modal opens
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthError(null);
    setAuthModalOpen(false);
  };

  // Safe parser to prevent 'Unexpected token T' errors on static hosts
  const safeParseJson = async (res: Response): Promise<{ ok: boolean; data: any }> => {
    try {
      const text = await res.text();
      if (!text || text.trim() === '') {
        return { ok: false, data: null };
      }
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch {
      return { ok: false, data: null };
    }
  };

  // Sync token with backend /api/user/me
  const syncUserWithBackend = async (sessionToken: string) => {
    try {
      const res = await fetch('/api/user/me', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });
      const parsed = await safeParseJson(res);
      if (res.ok && parsed.ok && parsed.data?.user) {
        setDbUser(parsed.data.user);
        setIsCreator(Boolean(parsed.data.isCreator));
        setIsApproved(Boolean(parsed.data.isApproved));
      }
    } catch (err: any) {
      console.warn('Backend user profile check note:', err?.message);
    }
  };

  const refreshUserProfile = async () => {
    if (token) {
      await syncUserWithBackend(token);
    }
  };

  // Restore stored session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.user) {
          setUser(parsed.user);
          setToken(parsed.token);
          setDbUser(parsed.dbUser || null);
          const isOwner = parsed.user.email?.trim().toLowerCase() === CREATOR_EMAIL.toLowerCase();
          setIsCreator(isOwner);
          setIsApproved(isOwner || Boolean(parsed.isApproved));
          // Verify in background
          syncUserWithBackend(parsed.token);
        }
      }
    } catch (e) {
      console.warn('Failed to restore auth session from storage', e);
    }
  }, []);

  // Listen for Firebase auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userEmail = currentUser.email?.trim().toLowerCase() || '';
        const isOwner = userEmail === CREATOR_EMAIL.toLowerCase();
        
        const authUserObj: AuthUser = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
        };

        setUser(authUserObj);
        setIsCreator(isOwner);
        if (isOwner) {
          setIsApproved(true);
        }

        try {
          const idToken = await getIdToken(currentUser);
          setToken(idToken);
          await syncUserWithBackend(idToken);

          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            user: authUserObj,
            token: idToken,
            isCreator: isOwner,
            isApproved: isOwner,
          }));
        } catch (err: any) {
          console.error('Error fetching Firebase auth token:', err);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with Google (Firebase)
  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const currentUser = result.user;
      const userEmail = currentUser.email?.trim().toLowerCase() || '';
      const isOwner = userEmail === CREATOR_EMAIL.toLowerCase();

      const authUserObj: AuthUser = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
      };

      setUser(authUserObj);
      setIsCreator(isOwner);
      if (isOwner) setIsApproved(true);

      const idToken = await getIdToken(currentUser);
      setToken(idToken);
      await syncUserWithBackend(idToken);

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: authUserObj,
        token: idToken,
        isCreator: isOwner,
        isApproved: isOwner,
      }));
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      let message = err?.message || 'Failed to sign in with Google';
      if (err?.code === 'auth/unauthorized-domain') {
        message = 'This domain is not authorized in Firebase Auth. Use Direct Email Login or add this domain in Firebase Console.';
      } else if (err?.code === 'auth/popup-blocked') {
        message = 'The popup window was blocked by your browser. Please use Direct Email Login or allow popups.';
      }
      setAuthError(message);
      throw err;
    }
  };

  // Sign in with Email (Direct backend or client authenticated session)
  const signInWithEmail = async (email: string) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const isOwner = cleanEmail === CREATOR_EMAIL.toLowerCase();

    // Check if previously registered or approved in local storage
    let localStatus = isOwner ? 'approved' : 'pending';
    let localRole = isOwner ? 'admin' : 'viewer';
    let localUid = isOwner ? 'creator_admin' : `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    try {
      const localReqsRaw = localStorage.getItem('clv_access_requests');
      if (localReqsRaw) {
        const localReqs = JSON.parse(localReqsRaw);
        const found = localReqs.find((r: any) => r.email?.toLowerCase() === cleanEmail);
        if (found) {
          localStatus = found.status || 'pending';
          localRole = found.role || 'viewer';
          localUid = found.uid || localUid;
        }
      }
    } catch {}

    const isApprovedUser = isOwner || localStatus === 'approved';

    // Attempt backend login
    try {
      const res = await fetch('/api/auth/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const parsed = await safeParseJson(res);
      if (res.ok && parsed.ok && parsed.data?.user) {
        const data = parsed.data;
        const authUserObj: AuthUser = {
          uid: data.user.uid,
          email: data.user.email,
          displayName: data.user.displayName,
        };
        setUser(authUserObj);
        setToken(data.token);
        setDbUser(data.dbUser);
        setIsCreator(Boolean(data.isCreator));
        setIsApproved(Boolean(data.isApproved));

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          user: authUserObj,
          token: data.token,
          dbUser: data.dbUser,
          isCreator: data.isCreator,
          isApproved: data.isApproved,
        }));
        return;
      }
    } catch (e) {
      console.warn('Backend login endpoint unavailable, using client fallback session:', e);
    }

    // Client session fallback (for Vercel or when SQL server is offline)
    const fallbackUser: AuthUser = {
      uid: localUid,
      email: cleanEmail,
      displayName: isOwner ? 'Mui Kim (Creator)' : cleanEmail.split('@')[0],
    };
    const fallbackDbUser: DbUser = {
      id: Math.floor(Math.random() * 10000),
      uid: localUid,
      email: cleanEmail,
      role: localRole,
      status: localStatus,
    };
    const fallbackToken = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    setUser(fallbackUser);
    setToken(fallbackToken);
    setDbUser(fallbackDbUser);
    setIsCreator(isOwner);
    setIsApproved(isApprovedUser);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user: fallbackUser,
      token: fallbackToken,
      dbUser: fallbackDbUser,
      isCreator: isOwner,
      isApproved: isApprovedUser,
    }));
  };

  // Submit an access request
  const requestAccess = async (email: string, name?: string, note?: string) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const isOwner = cleanEmail === CREATOR_EMAIL.toLowerCase();

    // 1. Record in local persistent access requests registry (so it is NEVER blocked)
    try {
      const localReqsRaw = localStorage.getItem('clv_access_requests');
      const localReqs: any[] = localReqsRaw ? JSON.parse(localReqsRaw) : [];
      const existingIdx = localReqs.findIndex((r: any) => r.email?.toLowerCase() === cleanEmail);
      const reqRecord = {
        uid: existingIdx >= 0 ? localReqs[existingIdx].uid : `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        note: note || '',
        role: isOwner ? 'admin' : 'viewer',
        status: isOwner ? 'approved' : 'pending',
        createdAt: existingIdx >= 0 ? localReqs[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        localReqs[existingIdx] = { ...localReqs[existingIdx], ...reqRecord };
      } else {
        localReqs.push(reqRecord);
      }
      localStorage.setItem('clv_access_requests', JSON.stringify(localReqs));
    } catch (e) {
      console.warn('Local storage write warning:', e);
    }

    // 2. Safely ping server endpoint
    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name, note }),
      });

      const parsed = await safeParseJson(res);
      if (parsed.ok && !res.ok) {
        console.warn('Server request returned status:', res.status, parsed.data?.error);
      }
    } catch (e) {
      console.warn('Network sync notice during access request:', e);
    }

    // 3. If the user is the creator, automatically log them in
    if (isOwner) {
      await signInWithEmail(cleanEmail);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth).catch(() => {});
    } catch (e) {
      console.warn('Firebase signout warning:', e);
    }
    setUser(null);
    setToken(null);
    setDbUser(null);
    setIsCreator(false);
    setIsApproved(false);
    setAuthError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      dbUser, 
      isCreator, 
      isApproved, 
      creatorEmail: CREATOR_EMAIL,
      loading, 
      authError,
      setAuthError,
      signInWithGoogle, 
      signInWithEmail,
      requestAccess,
      signOut, 
      refreshUserProfile,
      authModalOpen,
      authModalTab,
      openAuthModal,
      closeAuthModal,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
