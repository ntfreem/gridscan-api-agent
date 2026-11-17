import axios from "axios";

import { API_BASE } from "./apiBase";

const BASE = API_BASE;

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
  deleteBot: (orgId, botId) => axios.delete(`${BASE}/v2/orgs/${orgId}/bots/${botId}`, { headers: headers() }),
  deleteOrg: (orgId) => axios.delete(`${BASE}/v2/orgs/${orgId}`, { headers: headers() }),
  cloneBot: (orgId, botId) => axios.post(`${BASE}/v2/orgs/${orgId}/bots/${botId}/clone`, {}, { headers: headers() }),
  saveAsTemplate: (orgId, botId, data) => axios.post(`${BASE}/v2/orgs/${orgId}/bots/${botId}/save-as-template`, data || {}, { headers: headers() }),
  getLlmConfig: (orgId, botId) => axios.get(`${BASE}/v2/orgs/${orgId}/bots/${botId}/llm-config`, { headers: headers() }),
  putLlmConfig: (orgId, botId, data) => axios.put(`${BASE}/v2/orgs/${orgId}/bots/${botId}/llm-config`, data, { headers: headers() }),
  testLlmConfig: (orgId, botId) => axios.post(`${BASE}/v2/orgs/${orgId}/bots/${botId}/llm-config/test`, {}, { headers: headers() }),

  // Templates
  listTemplates: (orgId) => axios.get(`${BASE}/v2/orgs/${orgId}/templates`, { headers: headers() }),
  createBotFromTemplate: (orgId, templateId, data) => axios.post(`${BASE}/v2/orgs/${orgId}/templates/${templateId}/create-bot`, data || {}, { headers: headers() }),
  deleteTemplate: (orgId, templateId) => axios.delete(`${BASE}/v2/orgs/${orgId}/templates/${templateId}`, { headers: headers() }),

  // Accounts
  listAccounts: (orgId) => axios.get(`${BASE}/v2/orgs/${orgId}/accounts`, { headers: headers() }),
  createAccount: (orgId, data) => axios.post(`${BASE}/v2/orgs/${orgId}/accounts`, data, { headers: headers() }),
  deleteAccount: (orgId, accountId) => axios.delete(`${BASE}/v2/orgs/${orgId}/accounts/${accountId}`, { headers: headers() }),
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

  // Customer Workspaces
  getMyWorkspaces: () => axios.get(`${BASE}/v2/workspaces`, { headers: headers() }),
  getWorkspace: (wsId) => axios.get(`${BASE}/v2/workspaces/${wsId}`, { headers: headers() }),
  createWorkspace: (data) => axios.post(`${BASE}/v2/workspaces`, data, { headers: headers() }),
  updateWorkspace: (wsId, data) => axios.put(`${BASE}/v2/workspaces/${wsId}`, data, { headers: headers() }),
  deleteWorkspace: (wsId) => axios.delete(`${BASE}/v2/workspaces/${wsId}`, { headers: headers() }),
  getWorkspaceMembers: (wsId) => axios.get(`${BASE}/v2/workspaces/${wsId}/members`, { headers: headers() }),
  addWorkspaceMember: (wsId, data) => axios.post(`${BASE}/v2/workspaces/${wsId}/members`, data, { headers: headers() }),
  removeWorkspaceMember: (wsId, userId) => axios.delete(`${BASE}/v2/workspaces/${wsId}/members/${userId}`, { headers: headers() }),
  updateWorkspaceMemberRole: (wsId, userId, data) => axios.patch(`${BASE}/v2/workspaces/${wsId}/members/${userId}/role`, data, { headers: headers() }),
  getWorkspaceOrgs: (wsId) => axios.get(`${BASE}/v2/workspaces/${wsId}/orgs`, { headers: headers() }),
  getWorkspaceUsers: (wsId) => axios.get(`${BASE}/v2/workspaces/${wsId}/users`, { headers: headers() }),
  removeWorkspaceUser: (wsId, userId) => axios.delete(`${BASE}/v2/workspaces/${wsId}/users/${userId}`, { headers: headers() }),
  getUserOrgMemberships: (wsId, userId) => axios.get(`${BASE}/v2/workspaces/${wsId}/user-orgs/${userId}`, { headers: headers() }),
  updateOrgMembership: (wsId, data) => axios.post(`${BASE}/v2/workspaces/${wsId}/org-membership`, data, { headers: headers() }),
  getWorkspaceBilling: (wsId) => axios.get(`${BASE}/v2/workspaces/${wsId}/billing`, { headers: headers() }),
  updateWorkspaceBilling: (wsId, data) => axios.put(`${BASE}/v2/workspaces/${wsId}/billing`, data, { headers: headers() }),
  getWorkspaceDiscordApps: (wsId) => axios.get(`${BASE}/v2/workspaces/${wsId}/discord-apps`, { headers: headers() }),
  createWorkspaceDiscordApp: (wsId, data) => axios.post(`${BASE}/v2/workspaces/${wsId}/discord-apps`, data, { headers: headers() }),
  updateWorkspaceDiscordApp: (wsId, appId, data) => axios.put(`${BASE}/v2/workspaces/${wsId}/discord-apps/${appId}`, data, { headers: headers() }),
  deleteWorkspaceDiscordApp: (wsId, appId) => axios.delete(`${BASE}/v2/workspaces/${wsId}/discord-apps/${appId}`, { headers: headers() }),
  getPlatformDiscordApp: () => axios.get(`${BASE}/v2/platform/discord-app`, { headers: headers() }),
  updatePlatformDiscordApp: (data) => axios.put(`${BASE}/v2/platform/discord-app`, data, { headers: headers() }),

  // Workspace-scoped org listing
  listOrgsInWorkspace: (wsId) => {
    const h = headers();
    h["X-Workspace-ID"] = wsId;
    return axios.get(`${BASE}/v2/orgs`, { headers: h });
  },
};

export default v2;
