import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { setUnauthorizedHandler, tokenStore } from "../api/client";
import { authApi } from "../api/endpoints";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  isManager: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    tokenStore.set(response.access_token);
    setUser(response.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, isManager: user?.role === "MANAGER", login, logout }),
    [user, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
