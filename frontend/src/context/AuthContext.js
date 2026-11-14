import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";

const BASE = `/api`;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [loading, setLoading] = useState(true);

  // v2 org model
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [bots, setBots] = useState([]);
  const [selectedBot, setSelectedBot] = useState(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("bf_token") : null;

  // Restore session
  useEffect(() => {
    const storedUser = localStorage.getItem("bf_user");
    const storedToken = localStorage.getItem("bf_token");

    if (!storedUser || !storedToken) {
      setLoading(false);
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch {
      localStorage.clear();
      setLoading(false);
      return;
    }

    axios.get(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
      withCredentials: true,
    }).then(async (res) => {
      const freshInstances = res.data.instances || [];
      setInstances(freshInstances);
      localStorage.setItem("bf_instances", JSON.stringify(freshInstances));

      // Restore instance selection
      const storedInstance = localStorage.getItem("bf_instance");
      if (storedInstance) {
        try {
          const parsed = JSON.parse(storedInstance);
          const stillValid = freshInstances.some(i => i.id === parsed.id);
          if (stillValid) setSelectedInstance(parsed);
          else {
            localStorage.removeItem("bf_instance");
            localStorage.removeItem("bf_instance_id");
            if (freshInstances.length === 1) {
              setSelectedInstance(freshInstances[0]);
              localStorage.setItem("bf_instance", JSON.stringify(freshInstances[0]));
              localStorage.setItem("bf_instance_id", freshInstances[0].id);
            }
          }
        } catch {
          localStorage.removeItem("bf_instance");
          localStorage.removeItem("bf_instance_id");
        }
      } else if (freshInstances.length === 1) {
        setSelectedInstance(freshInstances[0]);
        localStorage.setItem("bf_instance", JSON.stringify(freshInstances[0]));
        localStorage.setItem("bf_instance_id", freshInstances[0].id);
      }

      // Fetch v2 orgs
      try {
        const orgRes = await axios.get(`${BASE}/v2/orgs`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const fetchedOrgs = orgRes.data.organisations || [];
        setOrgs(fetchedOrgs);

        // Restore or auto-select org
        const storedOrgId = localStorage.getItem("bf_org_id");
        const restoredOrg = storedOrgId ? fetchedOrgs.find(o => o.id === storedOrgId) : null;
        if (restoredOrg) {
          setSelectedOrg(restoredOrg);
        } else if (fetchedOrgs.length > 0) {
          setSelectedOrg(fetchedOrgs[0]);
          localStorage.setItem("bf_org_id", fetchedOrgs[0].id);
        }
      } catch {
        // v2 orgs not available — legacy mode
      }
    }).catch(() => {
      localStorage.clear();
      setUser(null);
    }).finally(() => {
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch orgs when user is set (covers both session restore and fresh login)
  useEffect(() => {
    if (!user) return;
    const tk = localStorage.getItem("bf_token");
    if (!tk) return;
    // Only fetch if we don't already have orgs
    if (orgs.length > 0) return;
    axios.get(`${BASE}/v2/orgs`, {
      headers: { Authorization: `Bearer ${tk}` },
    }).then(res => {
      const fetchedOrgs = res.data.organisations || [];
      setOrgs(fetchedOrgs);
      if (fetchedOrgs.length > 0 && !selectedOrg) {
        const storedOrgId = localStorage.getItem("bf_org_id");
        const restoredOrg = storedOrgId ? fetchedOrgs.find(o => o.id === storedOrgId) : null;
        if (restoredOrg) {
          setSelectedOrg(restoredOrg);
        } else {
          setSelectedOrg(fetchedOrgs[0]);
          localStorage.setItem("bf_org_id", fetchedOrgs[0].id);
        }
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch bots when org changes
  useEffect(() => {
    if (!selectedOrg || !token) {
      setBots([]);
      setSelectedBot(null);
      return;
    }
    axios.get(`${BASE}/v2/orgs/${selectedOrg.id}/bots`, {
      headers: { Authorization: `Bearer ${token}`, "X-Org-ID": selectedOrg.id },
    }).then(res => {
      const fetchedBots = res.data.bots || [];
      setBots(fetchedBots);

      // Restore or auto-select bot
      const storedBotId = localStorage.getItem("bf_bot_id");
      const restoredBot = storedBotId ? fetchedBots.find(b => b.id === storedBotId) : null;
      if (restoredBot) {
        setSelectedBot(restoredBot);
      } else if (fetchedBots.length > 0) {
        setSelectedBot(fetchedBots[0]);
        localStorage.setItem("bf_bot_id", fetchedBots[0].id);
      }

      // Also sync legacy instance from bot's legacy_instance_id
      if (fetchedBots.length > 0) {
        const bot = restoredBot || fetchedBots[0];
        const legacyId = bot.legacy_instance_id;
        if (legacyId) {
          const inst = instances.find(i => i.id === legacyId);
          if (inst && (!selectedInstance || selectedInstance.id !== inst.id)) {
            setSelectedInstance(inst);
            localStorage.setItem("bf_instance", JSON.stringify(inst));
            localStorage.setItem("bf_instance_id", inst.id);
          }
        }
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, token]);

  const login = useCallback((tokenVal, userVal, instancesVal) => {
    const inst = instancesVal || [];
    setUser(userVal);
    setInstances(inst);
    if (tokenVal) localStorage.setItem("bf_token", tokenVal);
    localStorage.setItem("bf_user", JSON.stringify(userVal));
    localStorage.setItem("bf_instances", JSON.stringify(inst));

    if (inst.length === 1) {
      setSelectedInstance(inst[0]);
      localStorage.setItem("bf_instance", JSON.stringify(inst[0]));
      localStorage.setItem("bf_instance_id", inst[0].id);
    }
  }, []);

  const selectInstance = useCallback((instance) => {
    setSelectedInstance(instance);
    localStorage.setItem("bf_instance", JSON.stringify(instance));
    localStorage.setItem("bf_instance_id", instance.id);
  }, []);

  const selectOrg = useCallback((org) => {
    setSelectedOrg(org);
    localStorage.setItem("bf_org_id", org.id);
    // Reset bot selection when org changes
    setSelectedBot(null);
    localStorage.removeItem("bf_bot_id");
  }, []);

  const selectBot = useCallback((bot) => {
    setSelectedBot(bot);
    localStorage.setItem("bf_bot_id", bot.id);
    // Sync legacy instance
    if (bot.legacy_instance_id) {
      const inst = instances.find(i => i.id === bot.legacy_instance_id);
      if (inst) {
        setSelectedInstance(inst);
        localStorage.setItem("bf_instance", JSON.stringify(inst));
        localStorage.setItem("bf_instance_id", inst.id);
      }
    }
  }, [instances]);

  const refreshBots = useCallback(async () => {
    if (!selectedOrg || !token) return;
    try {
      const res = await axios.get(`${BASE}/v2/orgs/${selectedOrg.id}/bots`, {
        headers: { Authorization: `Bearer ${token}`, "X-Org-ID": selectedOrg.id },
      });
      setBots(res.data.bots || []);
    } catch {}
  }, [selectedOrg, token]);

  const logout = useCallback(() => {
    axios.post(`${BASE}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
    setUser(null);
    setInstances([]);
    setSelectedInstance(null);
    setOrgs([]);
    setSelectedOrg(null);
    setBots([]);
    setSelectedBot(null);
    ["bf_token", "bf_user", "bf_instance", "bf_instance_id", "bf_instances",
     "bf_org_id", "bf_bot_id"].forEach(k => localStorage.removeItem(k));
  }, []);

  const refreshInstances = useCallback(async () => {
    const tk = localStorage.getItem("bf_token");
    if (!tk) return;
    try {
      const res = await axios.get(`${BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${tk}` },
        withCredentials: true,
      });
      const newInstances = res.data.instances || [];
      setInstances(newInstances);
      localStorage.setItem("bf_instances", JSON.stringify(newInstances));
      if (newInstances.length === 1) {
        setSelectedInstance(newInstances[0]);
        localStorage.setItem("bf_instance", JSON.stringify(newInstances[0]));
        localStorage.setItem("bf_instance_id", newInstances[0].id);
      }
    } catch {}
  }, []);

  const refreshOrgs = useCallback(async () => {
    const tk = localStorage.getItem("bf_token");
    if (!tk) return;
    try {
      const res = await axios.get(`${BASE}/v2/orgs`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const fetchedOrgs = res.data.organisations || [];
      setOrgs(fetchedOrgs);
      if (selectedOrg) {
        const updated = fetchedOrgs.find(o => o.id === selectedOrg.id);
        if (updated) setSelectedOrg(updated);
      }
    } catch {}
  }, [selectedOrg]);

  const value = useMemo(() => ({
    user, instances, selectedInstance, login, selectInstance, logout, loading, refreshInstances,
    // v2
    orgs, selectedOrg, selectOrg, bots, selectedBot, selectBot, refreshBots, refreshOrgs,
  }), [user, instances, selectedInstance, login, selectInstance, logout, loading, refreshInstances,
       orgs, selectedOrg, selectOrg, bots, selectedBot, selectBot, refreshBots, refreshOrgs]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
