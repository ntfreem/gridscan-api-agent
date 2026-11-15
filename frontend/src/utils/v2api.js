import axios from "axios";

const BASE = "/api";

function headers() {
  const token = localStorage.getItem("bf_token");
  const orgId = localStorage.getItem("bf_org_id");
  return {
    Authorization: `Bearer ${token}`,
    ...(orgId && { "X-Org-ID": orgId }),
  };
}

const v2 = {
  // Orgs
  listOrgs: () => axios.get(`${BASE}/v2/orgs`, { headers: headers() }),
  createOrg: (data) => axios.post(`${BASE}/v2/orgs`, data, { headers: headers() }),
  getOrg: (orgId) => axios.get(`${BASE}/v2/orgs/${orgId}`, { headers: headers() }),
  updateOrg: (orgId, data) => axios.put(`${BASE}/v2/orgs/${orgId}`, data, { headers: headers() }),
  orgOverview: (orgId) => axios.get(`${BASE}/v2/orgs/${orgId}/overview`, { headers: headers() }),
  getOrgMembers: (orgId) => axios.get(`${BASE}/v2/orgs/${orgId}/members`, { headers: headers() }),

  // Bots
  listBots: (orgId) => axios.get(`${BASE}/v2/orgs/${orgId}/bots`, { headers: headers() }),
  createBot: (orgId, data) => axios.post(`${BASE}/v2/orgs/${orgId}/bots`, data, { headers: headers() }),
  getBot: (orgId, botId) => axios.get(`${BASE}/v2/orgs/${orgId}/bots/${botId}`, { headers: headers() }),
  updateBot: (orgId, botId, data) => axios.put(`${BASE}/v2/orgs/${orgId}/bots/${botId}`, data, { headers: headers() }),
  getBotSettings: (orgId, botId) => axios.get(`${BASE}/v2/orgs/${orgId}/bots/${botId}/settings`, { headers: headers() }),
  updateBotSettings: (orgId, botId, data) => axios.put(`${BASE}/v2/orgs/${orgId}/bots/${botId}/settings`, data, { headers: headers() }),
  cloneBot: (orgId, botId) => axios.post(`${BASE}/v2/orgs/${orgId}/bots/${botId}/clone`, {}, { headers: headers() }),

  // Accounts
  listAccounts: (orgId) => axios.get(`${BASE}/v2/orgs/${orgId}/accounts`, { headers: headers() }),
  createAccount: (orgId, data) => axios.post(`${BASE}/v2/orgs/${orgId}/accounts`, data, { headers: headers() }),
  getAccount: (orgId, accId) => axios.get(`${BASE}/v2/orgs/${orgId}/accounts/${accId}`, { headers: headers() }),
  updateAccount: (orgId, accId, data) => axios.put(`${BASE}/v2/orgs/${orgId}/accounts/${accId}`, data, { headers: headers() }),
  disconnectAccount: (orgId, accId) => axios.post(`${BASE}/v2/orgs/${orgId}/accounts/${accId}/disconnect`, {}, { headers: headers() }),
  reconnectAccount: (orgId, accId) => axios.post(`${BASE}/v2/orgs/${orgId}/accounts/${accId}/reconnect`, {}, { headers: headers() }),
  testAccount: (orgId, accId) => axios.post(`${BASE}/v2/orgs/${orgId}/accounts/${accId}/test`, {}, { headers: headers() }),

  // Connections
  listConnections: (orgId, botId) => axios.get(`${BASE}/v2/orgs/${orgId}/bots/${botId}/connections`, { headers: headers() }),
  createConnection: (orgId, botId, data) => axios.post(`${BASE}/v2/orgs/${orgId}/bots/${botId}/connections`, data, { headers: headers() }),
  getConnection: (orgId, botId, connId) => axios.get(`${BASE}/v2/orgs/${orgId}/bots/${botId}/connections/${connId}`, { headers: headers() }),
  updateConnection: (orgId, botId, connId, data) => axios.put(`${BASE}/v2/orgs/${orgId}/bots/${botId}/connections/${connId}`, data, { headers: headers() }),
  toggleConnection: (orgId, botId, connId) => axios.patch(`${BASE}/v2/orgs/${orgId}/bots/${botId}/connections/${connId}/toggle`, {}, { headers: headers() }),
  connectionActivity: (orgId, botId, connId) => axios.get(`${BASE}/v2/orgs/${orgId}/bots/${botId}/connections/${connId}/activity`, { headers: headers() }),

  // Suggestions
  listSuggestions: (orgId, botId, params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.connection_id) qs.set("connection_id", params.connection_id);
    if (params.limit) qs.set("limit", params.limit);
    if (params.skip) qs.set("skip", params.skip);
    return axios.get(`${BASE}/v2/orgs/${orgId}/bots/${botId}/suggestions?${qs}`, { headers: headers() });
  },
  updateSuggestion: (orgId, botId, suggestionId, data) =>
    axios.patch(`${BASE}/v2/orgs/${orgId}/bots/${botId}/suggestions/${suggestionId}`, data, { headers: headers() }),

  // Platform Admin
  platformStats: () => axios.get(`${BASE}/v2/platform/stats`, { headers: headers() }),
  listWorkspaces: () => axios.get(`${BASE}/v2/platform/workspaces`, { headers: headers() }),
  workspaceDetail: (orgId) => axios.get(`${BASE}/v2/platform/workspaces/${orgId}/detail`, { headers: headers() }),
  listProviderApps: () => axios.get(`${BASE}/v2/platform/provider-apps`, { headers: headers() }),
};

export default v2;
