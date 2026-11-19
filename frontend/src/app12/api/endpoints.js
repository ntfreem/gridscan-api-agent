/**
 * Every Spec 012 route the admin app calls, as "METHOD /template" strings.
 * `call` refuses any template that is not in the generated manifest
 * (contract/routes.json, exported from the API by
 * backend/tests/contract/export_frontend_contract.py), so the UI cannot call
 * an invented or retired route. Path values are URI-encoded.
 */
import ROUTES from "../contract/routes.json";

const KNOWN = new Set(ROUTES);

export function fill(template, params = {}) {
  const [method, path] = template.split(" ");
  const out = path.replace(/\{([a-z_]+)\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined || v === null || v === "") throw new Error(`Missing route parameter ${k}`);
    return encodeURIComponent(String(v));
  });
  return [method, out];
}

export function makeApi(client) {
  const call = (template, params, opts) => {
    if (!KNOWN.has(template)) throw new Error(`Route not in the API contract: ${template}`);
    const [method, path] = fill(template, params);
    return client.request(method, path, opts).then((r) => r.data);
  };
  const callFull = (template, params, opts) => {
    if (!KNOWN.has(template)) throw new Error(`Route not in the API contract: ${template}`);
    const [method, path] = fill(template, params);
    return client.request(method, path, opts);
  };
  const T = (type) => ({ enterprise: "enterprises", organisation: "organisations", bot: "bots", instance: "instances" }[type] || type);

  return {
    raw: client,
    url: (template, params) => client.url(fill(template, params)[1]),
    // ── auth (C1) ──
    session: () => call("GET /auth/session", {}, { auth: false }),
    login: (email, password) => call("POST /auth/login", {}, { body: { email, password }, auth: false }),
    logout: () => call("POST /auth/logout", {}),
    logoutAll: () => call("POST /auth/logout-all", {}),
    forgotPassword: (email) => call("POST /auth/forgot-password", {}, { body: { email }, auth: false }),
    resetPassword: (token, new_password) => call("POST /auth/reset-password", {}, { body: { token, new_password }, auth: false }),
    changePassword: (current_password, new_password) =>
      call("POST /auth/change-password", {}, { body: { current_password, new_password } }),
    me: () => call("GET /users/me", {}),
    meDeletionPreview: () => call("POST /users/me/deletion-preview", {}),
    meDelete: (preview_token, confirm_email) => call("POST /users/me/delete", {}, { body: { preview_token, confirm_email } }),

    // ── hierarchy (C2–C6) ──
    enterprises: () => call("GET /enterprises", {}),
    createEnterprise: (body) => call("POST /enterprises", {}, { body }),
    enterprise: (enterprise_id) => call("GET /enterprises/{enterprise_id}", { enterprise_id }),
    patchEnterprise: (enterprise_id, body) => call("PATCH /enterprises/{enterprise_id}", { enterprise_id }, { body }),
    organisations: (parent_id) => call("GET /enterprises/{parent_id}/organisations", { parent_id }),
    createOrganisation: (parent_id, body) => call("POST /enterprises/{parent_id}/organisations", { parent_id }, { body }),
    organisation: (object_id) => call("GET /organisations/{object_id}", { object_id }),
    patchOrganisation: (object_id, body) => call("PATCH /organisations/{object_id}", { object_id }, { body }),
    bots: (parent_id) => call("GET /organisations/{parent_id}/bots", { parent_id }),
    createBot: (parent_id, body) => call("POST /organisations/{parent_id}/bots", { parent_id }, { body }),
    bot: (object_id) => call("GET /bots/{object_id}", { object_id }),
    patchBot: (object_id, body) => call("PATCH /bots/{object_id}", { object_id }, { body }),
    instances: (bot_id) => call("GET /bots/{bot_id}/instances", { bot_id }),
    createInstance: (bot_id, body) => call("POST /bots/{bot_id}/instances", { bot_id }, { body }),
    instance: (instance_id) => call("GET /instances/{instance_id}", { instance_id }),
    patchInstance: (instance_id, body) => call("PATCH /instances/{instance_id}", { instance_id }, { body }),
    putLogo: (bot_id, file) => call("PUT /bots/{bot_id}/logo", { bot_id }, { raw: file, contentType: file.type || "application/octet-stream" }),
    deleteLogo: (bot_id) => call("DELETE /bots/{bot_id}/logo", { bot_id }),

    // ── configuration and policy (ConfigPanel / PolicyPanel) ──
    config: (type, object_id) => call("GET /{type_}/{object_id}/config", { type_: T(type), object_id }),
    patchConfig: (type, object_id, changes) => call("PATCH /{type_}/{object_id}/config", { type_: T(type), object_id }, { body: { changes } }),
    policy: (type, object_id) => call("GET /{type_}/{object_id}/policy", { type_: T(type), object_id }),
    patchPolicy: (type, object_id, changes) => call("PATCH /{type_}/{object_id}/policy", { type_: T(type), object_id }, { body: { changes } }),

    // ── lifecycle and deletion (C13) ──
    lifecycle: (type, object_id, op, reason) =>
      call(`POST /{type_}/{object_id}/${op}`, { type_: T(type), object_id }, { body: { reason: reason || "" } }),
    deletionPreview: (type, object_id) => call("POST /{type_}/{object_id}/deletion-preview", { type_: T(type), object_id }),
    deleteObject: (type, object_id, preview_token, confirm_name) =>
      callFull("POST /{type_}/{object_id}/delete", { type_: T(type), object_id }, { body: { preview_token, confirm_name } }),
    deletionJob: (job_id) => call("GET /deletion-jobs/{job_id}", { job_id }),
    resumeDeletionJob: (job_id) => call("POST /deletion-jobs/{job_id}/resume", { job_id }),
    resolveDeletionAction: (job_id, action_id, reason) =>
      call("POST /deletion-jobs/{job_id}/actions/{action_id}/resolve", { job_id, action_id }, { body: { reason } }),

    // ── members and invitations (C4) ──
    members: (type, scope_id) => call("GET /{scope_type}/{scope_id}/members", { scope_type: T(type), scope_id }),
    addMember: (type, scope_id, user_id, role) =>
      call("POST /{scope_type}/{scope_id}/members", { scope_type: T(type), scope_id }, { body: { user_id, role } }),
    setMemberRole: (type, scope_id, member_id, role) =>
      call("PATCH /{scope_type}/{scope_id}/members/{member_id}", { scope_type: T(type), scope_id, member_id }, { body: { role } }),
    removeMember: (type, scope_id, member_id) =>
      call("DELETE /{scope_type}/{scope_id}/members/{member_id}", { scope_type: T(type), scope_id, member_id }),
    invitations: (enterprise_id) => call("GET /enterprises/{enterprise_id}/invitations", { enterprise_id }),
    invite: (enterprise_id, body) => call("POST /enterprises/{enterprise_id}/invitations", { enterprise_id }, { body }),
    revokeInvitation: (invitation_id) => call("DELETE /invitations/{invitation_id}", { invitation_id }),
    lookupInvitation: (token) => call("POST /invitations/lookup", {}, { body: { token } }),
    acceptInvitation: (token) => call("POST /invitations/accept", {}, { body: { token } }),
    // 6C B-ACCT: a new person invited by e-mail creates their account and joins
    registerByInvitation: (token, name, password) => call("POST /invitations/register", {}, { body: { token, name, password } }),

    // ── credentials (C4–C6) ──
    credentials: (type, owner_id) => call("GET /{owner_type}/{owner_id}/credentials", { owner_type: T(type), owner_id }),
    createCredential: (type, owner_id, body) =>
      call("POST /{owner_type}/{owner_id}/credentials", { owner_type: T(type), owner_id }, { body }),
    patchCredential: (credential_id, body) => call("PATCH /credentials/{credential_id}", { credential_id }, { body }),
    credentialScope: (credential_id, usable_by) =>
      call("PUT /credentials/{credential_id}/scope", { credential_id }, { body: { usable_by } }),
    revokeCredential: (credential_id) => call("POST /credentials/{credential_id}/revoke", { credential_id }),
    testCredential: (credential_id) => call("POST /credentials/{credential_id}/test", { credential_id }),
    deleteCredential: (credential_id) => call("DELETE /credentials/{credential_id}", { credential_id }),

    // ── knowledge (C11) ──
    sources: (type, owner_id) => call("GET /{owner_type}/{owner_id}/knowledge/sources", { owner_type: T(type), owner_id }),
    createSource: (type, owner_id, body) =>
      call("POST /{owner_type}/{owner_id}/knowledge/sources", { owner_type: T(type), owner_id }, { body }),
    patchSource: (source_id, body) => call("PATCH /knowledge/sources/{source_id}", { source_id }, { body }),
    deleteSource: (source_id) => call("DELETE /knowledge/sources/{source_id}", { source_id }),
    documents: (source_id) => call("GET /knowledge/sources/{source_id}/documents", { source_id }),
    uploadDocument: (source_id, name, file) =>
      call("PUT /knowledge/sources/{source_id}/documents/{name}", { source_id, name },
        { raw: file, contentType: file.type || "application/octet-stream" }),
    document: (document_id) => call("GET /knowledge/documents/{document_id}", { document_id }),
    documentAcl: (document_id, body) => call("PUT /knowledge/documents/{document_id}/acl", { document_id }, { body }),
    documentValidity: (document_id, body) => call("PUT /knowledge/documents/{document_id}/validity", { document_id }, { body }),
    reprocessDocument: (document_id) => call("POST /knowledge/documents/{document_id}/reprocess", { document_id }),
    deleteDocument: (document_id) => call("DELETE /knowledge/documents/{document_id}", { document_id }),

    // ── channels: generic (C7–C9) ──
    channelStatus: (instance_id) => call("GET /instances/{instance_id}/channel/status", { instance_id }),
    channelConnect: (instance_id) => call("POST /instances/{instance_id}/channel/connect", { instance_id }),
    channelDisconnect: (instance_id) => call("POST /instances/{instance_id}/channel/disconnect", { instance_id }),
    channelTest: (instance_id) => call("POST /instances/{instance_id}/channel/test", { instance_id }),
    channelRotateSecret: (instance_id) => call("POST /instances/{instance_id}/channel/rotate-secret", { instance_id }),
    deliveries: (instance_id, status) => call("GET /instances/{instance_id}/deliveries", { instance_id }, { query: { status } }),
    resolveDelivery: (instance_id, delivery_id, body) =>
      call("POST /instances/{instance_id}/deliveries/{delivery_id}/resolve", { instance_id, delivery_id }, { body }),

    // ── Discord: Organisation flow (C7) — no application controls here ──
    discordAvailability: (enterprise_id) => call("GET /enterprises/{enterprise_id}/discord", { enterprise_id }),
    discordInstallUrl: (instance_id) => call("POST /instances/{instance_id}/channel/discord/install-url", { instance_id }),
    discordChannels: (instance_id) => call("GET /instances/{instance_id}/channel/discord/channels", { instance_id }),
    discordSettings: (instance_id, body) => call("PUT /instances/{instance_id}/channel/discord/settings", { instance_id }, { body }),
    discordNickname: (instance_id, nickname) =>
      call("PUT /instances/{instance_id}/channel/discord/nickname", { instance_id }, { body: { nickname } }),
    discordShareLinks: (instance_id) => call("GET /instances/{instance_id}/channel/discord/share-links", { instance_id }),
    discordCreateShareLink: (instance_id, body) =>
      call("POST /instances/{instance_id}/channel/discord/share-links", { instance_id }, { body }),
    discordRevokeShareLink: (instance_id, share_id) =>
      call("DELETE /instances/{instance_id}/channel/discord/share-links/{share_id}", { instance_id, share_id }),
    discordHandoffs: (instance_id) => call("GET /instances/{instance_id}/channel/discord/handoffs", { instance_id }),
    discordStartHandoff: (instance_id, channel_id, minutes) =>
      call("PUT /instances/{instance_id}/channel/discord/handoffs/{channel_id}", { instance_id, channel_id }, { body: { minutes } }),
    discordResumeHandoff: (instance_id, channel_id) =>
      call("POST /instances/{instance_id}/channel/discord/handoffs/{channel_id}/resume", { instance_id, channel_id }),

    // ── Webchat (C9) ──
    embedSnippet: (instance_id) => call("GET /instances/{instance_id}/embed-snippet", { instance_id }),
    runtimeConfig: (instance_id) => call("GET /instances/{instance_id}/runtime-config", { instance_id }),
    conversations: (instance_id) => call("GET /instances/{instance_id}/conversations", { instance_id }),
    conversation: (instance_id, session_id) =>
      call("GET /instances/{instance_id}/conversations/{session_id}", { instance_id, session_id }),
    approveMessage: (instance_id, session_id, message_id) =>
      call("POST /instances/{instance_id}/conversations/{session_id}/approve", { instance_id, session_id }, { body: { message_id } }),

    // ── Zendesk Bot Integration (C10) ──
    integrations: (bot_id) => call("GET /bots/{bot_id}/integrations", { bot_id }),
    createIntegration: (bot_id, body) => call("POST /bots/{bot_id}/integrations", { bot_id }, { body }),
    integration: (integration_id) => call("GET /integrations/{integration_id}", { integration_id }),
    patchIntegration: (integration_id, body) => call("PATCH /integrations/{integration_id}", { integration_id }, { body }),
    deleteIntegration: (integration_id) => callFull("DELETE /integrations/{integration_id}", { integration_id }),
    integrationConfig: (integration_id) => call("GET /integrations/{integration_id}/config", { integration_id }),
    patchIntegrationConfig: (integration_id, changes) =>
      call("PATCH /integrations/{integration_id}/config", { integration_id }, { body: { changes } }),
    zendeskOAuthStart: (integration_id, subdomain) =>
      call("POST /integrations/{integration_id}/zendesk/oauth/start", { integration_id }, { body: { subdomain } }),
    integrationTest: (integration_id) => call("POST /integrations/{integration_id}/test", { integration_id }),
    zendeskWebhook: (integration_id) => call("GET /integrations/{integration_id}/zendesk/webhook", { integration_id }),
    zendeskSigningSecret: (integration_id, secret) =>
      call("PUT /integrations/{integration_id}/zendesk/signing-secret", { integration_id }, { body: { secret } }),
    zendeskRotateWebhook: (integration_id) => call("POST /integrations/{integration_id}/rotate-webhook-secret", { integration_id }),
    zendeskProvision: (integration_id) => call("POST /integrations/{integration_id}/zendesk/webhook/provision", { integration_id }),
    zendeskDeprovision: (integration_id) => call("POST /integrations/{integration_id}/zendesk/webhook/deprovision", { integration_id }),
    zendeskOwnerCredential: (integration_id, credential_id) =>
      call("PUT /integrations/{integration_id}/zendesk/webhook/owner-credential", { integration_id }, { body: { credential_id } }),
    zendeskEvents: (integration_id, status) => call("GET /integrations/{integration_id}/events", { integration_id }, { query: { status } }),
    zendeskResolveEvent: (integration_id, event_id, decision, note) =>
      call("POST /integrations/{integration_id}/events/{event_id}/resolve", { integration_id, event_id }, { body: { decision, note } }),
    zendeskSidebarKey: (integration_id) => call("POST /integrations/{integration_id}/sidebar-key", { integration_id }),
    zendeskRevokeSidebarKey: (integration_id) => call("DELETE /integrations/{integration_id}/sidebar-key", { integration_id }),
    zendeskSuggestions: (integration_id) => call("GET /integrations/{integration_id}/suggestions", { integration_id }),
    zendeskDecideSuggestion: (integration_id, suggestion_id, decision) =>
      call("POST /integrations/{integration_id}/suggestions/{suggestion_id}/{decision}", { integration_id, suggestion_id, decision }),
    zendeskDeliveries: (integration_id) => call("GET /integrations/{integration_id}/deliveries", { integration_id }),
    zendeskSidebarZipUrl: (integration_id) => client.url(fill("GET /integrations/{integration_id}/zendesk/sidebar-app.zip", { integration_id })[1]),

    // ── Phase 6A: usage (F1), user discovery (F2), webchat preview (F5) ──
    usage: (type, object_id, period) => call("GET /{type_}/{object_id}/usage", { type_: T(type), object_id }, { query: { period } }),
    integrationUsage: (integration_id, period) =>
      call("GET /integrations/{integration_id}/usage", { integration_id }, { query: { period } }),
    platformUsers: (q, after, limit = 25) => call("GET /platform/users", {}, { query: { q, after, limit } }),
    memberCandidates: (type, scope_id, q) =>
      call("GET /{scope_type}/{scope_id}/member-candidates", { scope_type: T(type), scope_id }, { query: { q } }),
    previewSession: (instance_id) => call("POST /instances/{instance_id}/preview-session", { instance_id }),

    // ── audit and operations (C12) ──
    enterpriseAudit: (enterprise_id, limit = 100) => call("GET /enterprises/{enterprise_id}/audit", { enterprise_id }, { query: { limit } }),
    platformAudit: (limit = 100) => call("GET /platform/audit", {}, { query: { limit } }),
    platformWorkers: () => call("GET /platform/workers", {}),

    // ── platform superadmin (C3) ──
    platformCredentials: () => call("GET /platform/credentials", {}),
    putPlatformCredential: (kind, body) => call("PUT /platform/credentials/{kind}", { kind }, { body }),
    revokePlatformCredential: (kind) => call("POST /platform/credentials/{kind}/revoke", { kind }),
    discordApp: (enterprise_id) => call("GET /platform/enterprises/{enterprise_id}/discord-application", { enterprise_id }),
    putDiscordApp: (enterprise_id, body) =>
      call("PUT /platform/enterprises/{enterprise_id}/discord-application", { enterprise_id }, { body }),
    discordAppRotateToken: (enterprise_id, value) =>
      call("POST /platform/enterprises/{enterprise_id}/discord-application/rotate-token", { enterprise_id }, { body: { value } }),
    discordAppRotateSecret: (enterprise_id, value) =>
      call("POST /platform/enterprises/{enterprise_id}/discord-application/rotate-secret", { enterprise_id }, { body: { value } }),
    discordAppEnable: (enterprise_id) => call("POST /platform/enterprises/{enterprise_id}/discord-application/enable", { enterprise_id }),
    discordAppDisable: (enterprise_id) => call("POST /platform/enterprises/{enterprise_id}/discord-application/disable", { enterprise_id }),
    discordAppGateway: (enterprise_id, op) =>
      call("POST /platform/enterprises/{enterprise_id}/discord-application/gateway/{op}", { enterprise_id, op }),
    discordAppAvatar: (enterprise_id, image) =>
      call("POST /platform/enterprises/{enterprise_id}/discord-application/avatar", { enterprise_id }, { body: { image } }),
    setSuperadmin: (user_id, grant) => call("POST /platform/users/{user_id}/superadmin", { user_id }, { body: { grant } }),
    userDeletionPreview: (user_id) => call("POST /platform/users/{user_id}/deletion-preview", { user_id }),
    deleteUser: (user_id, preview_token, confirm_email) =>
      call("POST /platform/users/{user_id}/delete", { user_id }, { body: { preview_token, confirm_email } }),
  };
}
