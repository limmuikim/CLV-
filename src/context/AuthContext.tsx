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
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth modal management
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'request' | 'email'>('signin');

  const openAuthModal = (tab: 'signin' | 'request' | 'email' = 'signin') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
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
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
        setIsCreator(Boolean(data.isCreator));
        setIsApproved(Boolean(data.isApproved));
      }
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
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

  // Sign in with Email (Direct backend authenticated session)
  const signInWithEmail = async (email: string) => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to log in with this email');
      }

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
    } catch (err: any) {
      console.error('Email login error:', err);
      setAuthError(err.message || 'Email login failed');
      throw err;
    }
  };

  // Submit an access request
  const requestAccess = async (email: string, name?: string, note?: string) => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, note }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      // If the email entered was creator, automatically log them in!
      if (data.isCreator) {
        await signInWithEmail(email);
      }
    } catch (err: any) {
      console.error('Request access error:', err);
      setAuthError(err.message || 'Failed to submit request');
      throw err;
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
