/**
 * AuthContext – provides user identity, JWT token management, and auth
 * actions (login, register, logout, fetchMe) to the entire React tree.
 *
 * On mount it reads the stored JWT and re-fetches the current user profile
 * so a hard refresh keeps the session alive.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, saveToken, TOKEN_KEY } from "@/lib/api";

/* ─── Types ─── */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "NOTARY" | "ADMIN";
  walletAddress: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

/* ─── Context ─── */

const AuthContext = createContext<AuthContextValue | null>(null);

/* ─── Provider ─── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true); // true until first me-check

  /** Fetch the current user using the stored JWT */
  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ success: true; user: AuthUser }>(
        "/auth/me",
      );
      setUser(data.user);
    } catch {
      // Token expired or invalid – clear it
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: restore session from stored token
  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await api.post<{ success: true; token: string; user: AuthUser }>(
      "/auth/login",
      payload,
    );
    saveToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await api.post<{ success: true; token: string; user: AuthUser }>(
      "/auth/register",
      payload,
    );
    saveToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Hook ─── */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
