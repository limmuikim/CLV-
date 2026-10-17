/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  getIdToken
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  dbUser: DbUser | null;
  isCreator: boolean;
  isApproved: boolean;
  creatorEmail: string;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  authError: string | null;
}

const CREATOR_EMAIL = 'muikimlim.insead@gmail.com';

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  dbUser: null,
  isCreator: false,
  isApproved: false,
  creatorEmail: CREATOR_EMAIL,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshUserProfile: async () => {},
  authError: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncUserWithBackend = async (idToken: string) => {
    try {
      const res = await fetch('/api/user/me', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
        setIsCreator(data.isCreator);
        setIsApproved(data.isApproved);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userEmail = currentUser.email?.trim().toLowerCase() || '';
        const isOwner = userEmail === CREATOR_EMAIL.toLowerCase();
        setIsCreator(isOwner);
        if (isOwner) {
          setIsApproved(true);
        }
        try {
          const idToken = await getIdToken(currentUser);
          setToken(idToken);
          await syncUserWithBackend(idToken);
        } catch (err: any) {
          console.error('Error fetching auth token:', err);
        }
      } else {
        setToken(null);
        setDbUser(null);
        setIsCreator(false);
        setIsApproved(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await getIdToken(result.user);
      setToken(idToken);
      await syncUserWithBackend(idToken);
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setAuthError(err.message || 'Failed to sign in with Google');
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setToken(null);
      setDbUser(null);
      setIsCreator(false);
      setIsApproved(false);
    } catch (err: any) {
      console.error('Sign-out failed:', err);
    }
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
      signInWithGoogle, 
      signOut, 
      refreshUserProfile,
      authError 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
