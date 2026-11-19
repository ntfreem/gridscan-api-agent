/**
 * Session state for the Spec 012 admin app (C1).
 * The session lives only in the API's httpOnly cookie; this context holds the
 * public user view in memory (never in web storage). Expiry (any 401) returns
 * to the sign-in page with a notice.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "./api/client";
import { makeApi } from "./api/endpoints";

const Ctx = createContext(null);

export function SessionProvider({ children, client: injected }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const userRef = useRef(null);
  userRef.current = user;

  const api = useMemo(() => {
    const client = injected || createClient({
      onUnauthorized: () => {
        if (userRef.current) setExpired(true);
        setUser(null);
      },
    });
    return makeApi(client);
  }, [injected]);

  const refresh = useCallback(async () => {
    try {
      const s = await api.session();
      setUser(s.user);
      return s.user;
    } catch (e) {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    await api.login(email, password);
    setExpired(false);
    return refresh();
  }, [api, refresh]);

  const logout = useCallback(async (everywhere = false) => {
    try {
      await (everywhere ? api.logoutAll() : api.logout());
    } finally {
      setUser(null);
    }
  }, [api]);

  const value = useMemo(() => ({ api, user, loading, expired, login, logout, refresh, setExpired }),
    [api, user, loading, expired, login, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

export const useApi = () => useSession().api;
