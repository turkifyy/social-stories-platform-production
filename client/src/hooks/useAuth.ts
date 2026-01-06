import { useState, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from 'firebase/auth';
import { auth, googleProvider, ensureFirebaseInitialized } from '@/lib/firebase';
import type { User } from '@shared/schema';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function setupAuth() {
      try {
        await ensureFirebaseInitialized();
        
        if (!mounted) return;
        if (!auth) {
          setIsLoading(false);
          return;
        }

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || undefined,
              createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
            });
          } else {
            setUser(null);
          }
          setIsLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        if (mounted) {
          console.error('Auth setup error:', error);
          setIsLoading(false);
        }
      }
    }

    setupAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    await ensureFirebaseInitialized();
    if (!auth) {
      throw new Error('Authentication is not available. Please configure Firebase.');
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signupWithEmail = async (email: string, password: string, displayName: string) => {
    await ensureFirebaseInitialized();
    if (!auth) {
      throw new Error('Authentication is not available. Please configure Firebase.');
    }
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (result.user) {
      await updateProfile(result.user, { displayName });
    }
    return result;
  };

  const loginWithGoogle = async () => {
    await ensureFirebaseInitialized();
    if (!auth || !googleProvider) {
      throw new Error('Authentication is not available. Please configure Firebase.');
    }
    return signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await ensureFirebaseInitialized();
    if (!auth) {
      throw new Error('Authentication is not available. Please configure Firebase.');
    }
    return signOut(auth);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    logout,
  };
}
