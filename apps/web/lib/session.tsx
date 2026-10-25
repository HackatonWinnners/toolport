"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

interface Session {
  address: string | null;
  token: string | null;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signInDev: (address: string) => Promise<void>;
  signOut: () => void;
}

const SessionContext = createContext<Session | null>(null);
const STORAGE_KEY = "stellarpay.session";

function toBase64(signed: unknown): string {
  if (typeof signed === "string") return signed;
  if (signed && typeof signed === "object" && "data" in signed) {
    // Buffer serialized by the extension: { type: "Buffer", data: number[] }
    return btoa(String.fromCharCode(...((signed as { data: number[] }).data)));
  }
  if (signed instanceof Uint8Array) return btoa(String.fromCharCode(...signed));
  throw new Error("Freighter returned no signature");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved?.token && saved?.address) {
        setToken(saved.token);
        setAddress(saved.address);
      }
    } catch {
      // storage blocked: stay signed out
    }
  }, []);

  const finish = (address: string, token: string) => {
    setAddress(address);
    setToken(token);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, token }));
    } catch {}
  };

  const signIn = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    try {
      const freighter = await import("@stellar/freighter-api");
      const connected = await freighter.isConnected();
      if (!connected.isConnected) throw new Error("Freighter is not installed. Get it at freighter.app");
      const access = await freighter.requestAccess();
      if (access.error) throw new Error(access.error.message ?? "Freighter access denied");
      const { message } = await api<{ message: string }>("/api/auth/challenge", {
        method: "POST",
        body: JSON.stringify({ address: access.address }),
      });
      const signed = await freighter.signMessage(message, { address: access.address });
      if (signed.error) throw new Error(signed.error.message ?? "Signature rejected");
      const { token } = await api<{ token: string }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ address: access.address, message, signature: toBase64(signed.signedMessage) }),
      });
      finish(access.address, token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSigningIn(false);
    }
  }, []);

  /** Only works against a gateway running with AUTH_DISABLED=true. */
  const signInDev = useCallback(async (addr: string) => {
    setError(null);
    try {
      await api("/api/auth/challenge", { method: "POST", body: JSON.stringify({ address: addr }) });
      const { token } = await api<{ token: string }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ address: addr, signature: "dev" }),
      });
      finish(addr, token);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const signOut = useCallback(() => {
    setAddress(null);
    setToken(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return (
    <SessionContext.Provider value={{ address, token, signingIn, error, signIn, signInDev, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession outside SessionProvider");
  return session;
}
