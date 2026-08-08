import { onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { auth } from '@/lib/firebase';

type CollectorUser = {
  uid: string;
  email: string | null;
};

type AuthContextValue = {
  user: CollectorUser | null;
  initializing: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CollectorUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser ? { uid: nextUser.uid, email: nextUser.email } : null);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signOut: () => firebaseSignOut(auth),
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
