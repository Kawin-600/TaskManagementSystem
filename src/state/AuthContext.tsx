import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultAuthService, type AuthService } from '../services/authService';
import type { User } from '../types/models';

interface AuthContextValue {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemoUser: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  authService = defaultAuthService,
  children,
}: {
  authService?: AuthService;
  children: ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const user = await authService.getSession();
    setCurrentUser(user);
  }, [authService]);

  useEffect(() => {
    let active = true;
    authService
      .getSession()
      .then((user) => {
        if (active) setCurrentUser(user);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authService]);

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await authService.login(email, password);
      setCurrentUser(user);
    },
    [authService],
  );

  const loginAsDemoUser = useCallback(
    async (userId: string) => {
      if (!authService.loginAsDemoUser) {
        throw new Error('โหมดทดลองเข้าใช้งานไม่พร้อมใช้งาน');
      }
      const user = await authService.loginAsDemoUser(userId);
      setCurrentUser(user);
    },
    [authService],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
  }, [authService]);

  return (
    <AuthContext.Provider
      value={{ currentUser, isLoading, login, loginAsDemoUser, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
