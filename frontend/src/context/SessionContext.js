/**
 * SessionContext — Spec 012 session-cookie authentication context.
 * Uses the app12 API client for all backend calls.
 * No localStorage tokens — the session is an httpOnly cookie.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "../app12/api/client";
import { makeApi } from "../app12/api/endpoints";

const SessionContext = createContext(null);

function buildApi(onUnauthorized) {
  const client = createClient({ onUnauthorized });
  return makeApi(client);
}

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Hierarchy state
  const [enterprises, setEnterprises] = useState([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [bots, setBots] = useState([]);
  const [selectedBot, setSelectedBot] = useState(null);

  const onUnauthorized = useCallback(() => {
    setUser(null);
    setEnterprises([]);
    setSelectedEnterprise(null);
    setOrganisations([]);
    setSelectedOrg(null);
    setBots([]);
    setSelectedBot(null);
  }, []);

  const api = useMemo(() => buildApi(onUnauthorized), [onUnauthorized]);

  // Check session on mount
  useEffect(() => {
    let cancelled = false;
    api.session()
      .then((data) => {
        if (!cancelled) setUser(data.user || data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setSessionChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, [api]);

  // Fetch enterprises when user is set
  useEffect(() => {
    if (!user) { setEnterprises([]); return; }
    let cancelled = false;
    api.enterprises()
      .then((data) => {
        if (cancelled) return;
        const list = data.enterprises || data || [];
        setEnterprises(list);
        // Auto-select first or restore from sessionStorage
        const storedId = sessionStorage.getItem("bb_enterprise_id");
        const restored = storedId ? list.find(e => e.id === storedId) : null;
        if (restored) {
          setSelectedEnterprise(restored);
        } else if (list.length > 0) {
          setSelectedEnterprise(list[0]);
          sessionStorage.setItem("bb_enterprise_id", list[0].id);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, api]);

  // Fetch organisations when enterprise changes
  useEffect(() => {
    if (!selectedEnterprise) { setOrganisations([]); setSelectedOrg(null); return; }
    let cancelled = false;
    api.organisations(selectedEnterprise.id)
      .then((data) => {
        if (cancelled) return;
        const list = data.organisations || data || [];
        setOrganisations(list);
        const storedId = sessionStorage.getItem("bb_org_id");
        const restored = storedId ? list.find(o => o.id === storedId) : null;
        if (restored) {
          setSelectedOrg(restored);
        } else if (list.length > 0) {
          setSelectedOrg(list[0]);
          sessionStorage.setItem("bb_org_id", list[0].id);
        } else {
          setSelectedOrg(null);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedEnterprise, api]);

  // Fetch bots when organisation changes
  useEffect(() => {
    if (!selectedOrg) { setBots([]); setSelectedBot(null); return; }
    let cancelled = false;
    api.bots(selectedOrg.id)
      .then((data) => {
        if (cancelled) return;
        const list = data.bots || data || [];
        setBots(list);
        const storedId = sessionStorage.getItem("bb_bot_id");
        const restored = storedId ? list.find(b => b.id === storedId) : null;
        if (restored) {
          setSelectedBot(restored);
        } else if (list.length > 0) {
          setSelectedBot(list[0]);
          sessionStorage.setItem("bb_bot_id", list[0].id);
        } else {
          setSelectedBot(null);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedOrg, api]);

  const selectEnterprise = useCallback((ent) => {
    setSelectedEnterprise(ent);
    sessionStorage.setItem("bb_enterprise_id", ent.id);
    setSelectedOrg(null);
    setSelectedBot(null);
    sessionStorage.removeItem("bb_org_id");
    sessionStorage.removeItem("bb_bot_id");
  }, []);

  const selectOrg = useCallback((org) => {
    setSelectedOrg(org);
    sessionStorage.setItem("bb_org_id", org.id);
    setSelectedBot(null);
    sessionStorage.removeItem("bb_bot_id");
  }, []);

  const selectBot = useCallback((bot) => {
    setSelectedBot(bot);
    sessionStorage.setItem("bb_bot_id", bot.id);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user || data);
    return data;
  }, [api]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    setUser(null);
    setEnterprises([]);
    setSelectedEnterprise(null);
    setOrganisations([]);
    setSelectedOrg(null);
    setBots([]);
    setSelectedBot(null);
    sessionStorage.clear();
  }, [api]);

  const refreshEnterprises = useCallback(async () => {
    try {
      const data = await api.enterprises();
      const list = data.enterprises || data || [];
      setEnterprises(list);
      return list;
    } catch { return []; }
  }, [api]);

  const refreshOrgs = useCallback(async () => {
    if (!selectedEnterprise) return [];
    try {
      const data = await api.organisations(selectedEnterprise.id);
      const list = data.organisations || data || [];
      setOrganisations(list);
      return list;
    } catch { return []; }
  }, [selectedEnterprise, api]);

  const refreshBots = useCallback(async () => {
    if (!selectedOrg) return [];
    try {
      const data = await api.bots(selectedOrg.id);
      const list = data.bots || data || [];
      setBots(list);
      return list;
    } catch { return []; }
  }, [selectedOrg, api]);

  const value = useMemo(() => ({
    user, loading, sessionChecked, api,
    enterprises, selectedEnterprise, selectEnterprise, refreshEnterprises,
    organisations, selectedOrg, selectOrg, refreshOrgs,
    bots, selectedBot, selectBot, refreshBots,
    login, logout,
    isSuperAdmin: user?.platform_role === "superadmin" || user?.role === "superadmin",
  }), [
    user, loading, sessionChecked, api,
    enterprises, selectedEnterprise, selectEnterprise, refreshEnterprises,
    organisations, selectedOrg, selectOrg, refreshOrgs,
    bots, selectedBot, selectBot, refreshBots,
    login, logout,
  ]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export const useApi = () => useSession().api;
