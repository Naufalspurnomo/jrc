import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  registrationApi,
  type AuthSession,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  type RegistrationApi,
} from '../registration/api';

export interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  sessionExpired: boolean;
  login(input: LoginInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  logout(): Promise<void>;
  refresh(): Promise<AuthSession | null>;
}

interface AuthProviderProps {
  api?: RegistrationApi;
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 401;
}

export function AuthProvider({ api = registrationApi, children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const hasEstablishedSession = useRef(false);

  const refresh = useCallback(async (): Promise<AuthSession | null> => {
    setLoading(true);
    try {
      const probe = await api.auth.me();
      if (!probe.user) {
        setSession(null);
        return null;
      }
      const nextSession: AuthSession = { ...probe, user: probe.user };
      setSession(nextSession);
      hasEstablishedSession.current = true;
      setSessionExpired(false);
      return nextSession;
    } catch (error) {
      if (isUnauthorized(error)) {
        setSession(null);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = api.auth.onUnauthorized?.(() => {
      setSession(null);
      if (hasEstablishedSession.current) setSessionExpired(true);
    });
    return unsubscribe;
  }, [api]);

  const login = useCallback(async (input: LoginInput) => {
    setLoading(true);
    try {
      const nextSession = await api.auth.login(input);
      setSession(nextSession);
      hasEstablishedSession.current = true;
      setSessionExpired(false);
      return nextSession;
    } finally {
      setLoading(false);
    }
  }, [api]);

  const register = useCallback(async (input: RegisterInput) => {
    setLoading(true);
    try {
      const nextSession = await api.auth.register(input);
      setSession(nextSession);
      hasEstablishedSession.current = true;
      setSessionExpired(false);
      return nextSession;
    } finally {
      setLoading(false);
    }
  }, [api]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await api.auth.logout();
    } finally {
      setSession(null);
      hasEstablishedSession.current = false;
      setSessionExpired(false);
      setLoading(false);
    }
  }, [api]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    login,
    register,
    logout,
    refresh,
    sessionExpired,
  }), [loading, login, logout, refresh, register, session, sessionExpired]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}