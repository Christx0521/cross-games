import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../lib/api.ts";

export interface User {
  id: string;
  nickname: string;
  email: string;
  is_verified: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch((err) => {
        if (!(err instanceof ApiError)) console.error(err);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string): Promise<void> {
    const r = await api.post<{ user: User }>("/auth/login", { identifier, password });
    setUser(r.user);
  }

  async function logout(): Promise<void> {
    await api.post("/auth/logout", {});
    setUser(null);
  }

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
