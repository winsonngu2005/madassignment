import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { TOKEN_KEY, USER_KEY } from './api/keys';
import type { LoginResult } from './models';

interface AuthState {
  user: LoginResult | null;
  busy: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function loadStored(): LoginResult | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    if (token && user?.role === 'admin' && user.name === 'Admin Alice') {
      user.name = 'Jia Ying';
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    return token && user ? user : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResult | null>(() => loadStored());
  const [busy, setBusy] = useState(false);

  // keep storage in sync on multi-tab use
  useEffect(() => {
    const onStorage = () => setUser(loadStored());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setBusy(true);
    try {
      const result = await api.login(email, password);
      if (result.role !== 'admin' && result.role !== 'staff') {
        throw new Error('Residents sign in from the mobile app.');
      }
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(USER_KEY, JSON.stringify(result));
      setUser(result);
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const isAdmin = user?.role === 'admin';
  const value = useMemo(() => ({ user, busy, isAdmin, login, logout }), [user, busy, isAdmin, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider.');
  return ctx;
}
