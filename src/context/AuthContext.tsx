import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../lib/api";
import { removeCookie, getCookie } from "../lib/cookies";
import type { Role } from "../types/master";

interface AuthState {
  id: string;
  role: Role;
  access: string[];
  username?: string;
}

interface AuthContextValue {
  user: AuthState | null;
  isLoading: boolean;
  accessSet: Set<string>;
  hasAccess: (key: string) => boolean;
  setUser: (user: AuthState | null) => void;
  refreshState: () => Promise<void>;
  logout: (flag: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "auth_state";
const SECRET = "fallback_dev_secret_32chars_pad!";

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey(
    "raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("auth_salt"), iterations: 100_000, hash: "SHA-256" },
    keyMat,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(SECRET);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));

  const toB64 = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf)));

  return `${toB64(iv)}:${toB64(cipherBuf)}`;
}

async function decrypt(stored: string): Promise<string | null> {
  try {
    const [ivB64, cipherB64] = stored.split(":");
    if (!ivB64 || !cipherB64) return null;

    const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const iv = fromB64(ivB64);
    const cipherBuf = fromB64(cipherB64);
    const key = await deriveKey(SECRET);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuf);

    return new TextDecoder().decode(plainBuf);
  } catch {
    return null;
  }
}

async function storeUser(u: AuthState): Promise<void> {
  const encrypted = await encrypt(JSON.stringify(u));
  localStorage.setItem(STORAGE_KEY, encrypted);
}

async function loadUser(): Promise<AuthState | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const plaintext = await decrypt(stored);
    if (!plaintext) return null;

    const parsed = JSON.parse(plaintext) as AuthState;
    if (!parsed?.id || !parsed?.role) return null;

    return {
      ...parsed,
      access: Array.isArray(parsed.access) ? parsed.access : [],
      username: parsed.username,
    };
  } catch {
    return null;
  }
}

function buildAccessSet(access: string[] | undefined): Set<string> {
  return new Set((access ?? []).map((k) => k.trim()).filter(Boolean));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((u: AuthState | null) => {
    setUserState(u);
    if (u) {
      storeUser(u);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearSession = useCallback(() => {
    removeCookie("accessToken");
    removeCookie("refreshToken");
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  }, []);

  const refreshState = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await loadUser();
      if (stored) {
        setUserState(stored);
      }

      const refreshToken = getCookie("refreshToken");
      if (!refreshToken && !stored) {
        clearSession();
        return;
      }

      const data = await apiRequest.execute<any>("/auth/", { method: "GET" });

      if (data?.id && data?.role) {
        setUser({
          id: data.id,
          role: data.role,
          access: Array.isArray(data.access) ? data.access : [],
          username: data.username,
        });
      } else {
        clearSession();
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403 || err?.message === "Forbidden!" || err?.message === "Unauthorized") {
        clearSession();
      } else {
        const stored = await loadUser();
        if (!stored) {
          clearSession();
        }
      }
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  }, [setUser, clearSession]);

  const logout = useCallback(async (flag: boolean) => {
    try {
      await apiRequest.execute(`/auth/${flag}`, { method: "DELETE" });
    } catch {
      // ignore
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    refreshState();
  }, []);

  const accessSet = useMemo(() => buildAccessSet(user?.access), [user]);

  const hasAccess = useCallback(
    (key: string) => {
      if (!user) return false;
      if (user.role === "ADMIN") return true;
      return accessSet.has(key);
    },
    [user, accessSet]
  );

  return (
    <AuthContext.Provider
      value={{ user, isLoading, accessSet, hasAccess, setUser, refreshState, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
