/** Phase 6A UI: usage (F1), user discovery (F2), invitation e-mail (F3),
 * credential tests (F4), webchat preview (F5), deferred features (F6). */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ALL_PERMISSIONS, IDS, MockApi, SAMPLES, renderApp, withPermissions } from "../testing/harness";
import { testMessage } from "../components/Credentials";

const admin = () => {
  const api = new MockApi();
  api.on("GET /{type_}/{object_id}/config", withPermissions(ALL_PERMISSIONS));
  return api;
};

test("F1 usage tab shows billing states, preview share and quotas for the chosen month", async () => {
  const api = admin();
  const usage = { ...SAMPLES.usage_org.body, ai_messages: { ...SAMPLES.usage_org.body.ai_messages, settled: 12, uncertain: 1 },
    preview: { settled: 3 }, quotas: [{ scope: "organisation", id: IDS.organisation, limit: null, used: 12 }] };
  api.on("GET /{type_}/{object_id}/usage", { status: 200, body: usage });
  renderApp(`/app/organisations/${IDS.organisation}`, api);
  await userEvent.click(await screen.findByRole("tab", { name: "Usage" }));
  expect(await screen.findByText("Billed (settled)")).toBeInTheDocument();
  expect(screen.getByText(/uncertain outcome/)).toBeInTheDocument();
  expect(within(screen.getByRole("table", { name: "Monthly AI message quotas" })).getByText("Unlimited")).toBeInTheDocument();
  const month = screen.getByLabelText("Month");
  fireEvent.change(month, { target: { value: "2026-10" } });          // jsdom has no month picker
  await waitFor(() => expect(api.calls("GET /{type_}/{object_id}/usage").some((c) => c.query.period === "2026-10")).toBe(true));
});

test("F3 invitations are e-mailed by default; a link is created only on request", async () => {
  const api = admin();
  api.on("POST /enterprises/{enterprise_id}/invitations", (r) => ({ status: 201,
    body: r.body.delivery === "link" ? { invitation: {}, token: "tok_once", email_sent: false } : { invitation: {}, email_sent: true } }));
  renderApp(`/app/enterprises/${IDS.enterprise}`, api);
  await userEvent.click(await screen.findByRole("tab", { name: "Members" }));
  await userEvent.type(await screen.findByLabelText("Email"), "new@example.test");
  await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));
  expect(await screen.findByText("Invitation e-mail sent.")).toBeInTheDocument();
  expect(screen.queryByTestId("one-time-secret")).toBeNull();
  expect(api.calls("POST /enterprises/{enterprise_id}/invitations")[0].body.delivery).toBe("email");
  await userEvent.type(screen.getByLabelText("Email"), "other@example.test");
  await userEvent.selectOptions(screen.getByLabelText("Delivery"), "link");
  await userEvent.click(screen.getByRole("button", { name: "Create link" }));
  expect(await screen.findByTestId("one-time-secret")).toHaveTextContent("/app/invitations#token=tok_once");
});

test("F2 adding a member searches Enterprise members only (min 3 characters)", async () => {
  const api = admin();
  api.on("POST /{scope_type}/{scope_id}/members", { status: 200, body: SAMPLES.members_enterprise.body });
  renderApp(`/app/organisations/${IDS.organisation}`, api);
  await userEvent.click(await screen.findByRole("tab", { name: "Members" }));
  const search = await screen.findByLabelText("Search by e-mail");
  await userEvent.type(search, "me");
  expect(api.calls("GET /{scope_type}/{scope_id}/member-candidates")).toHaveLength(0);
  await userEvent.type(search, "m");
  await userEvent.click(await screen.findByRole("button", { name: /member2@example.test/ }));
  await userEvent.click(screen.getByRole("button", { name: "Add member2@example.test" }));
  await waitFor(() => expect(api.calls("POST /{scope_type}/{scope_id}/members")[0].body.user_id).toBe(SAMPLES.member_candidates.body.candidates[0].id));
});

test("F2 platform user search and pagination (superadmin)", async () => {
  const api = admin();
  api.on("GET /auth/session", { status: 200, body: SAMPLES.session_root.body });
  renderApp("/app/platform", api);
  await userEvent.click(await screen.findByRole("tab", { name: "Users" }));
  expect(await screen.findByText("admin@example.test")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(api.calls("GET /platform/users").some((c) => c.query.after === SAMPLES.platform_users.body.next)).toBe(true));
  await userEvent.type(screen.getByLabelText("Search users by e-mail"), "OWN");
  await waitFor(() => expect(api.calls("GET /platform/users").some((c) => c.query.q === "own")).toBe(true));
});

test("F4 credential tests show sanitised results only", async () => {
  expect(testMessage({ ok: true, category: null })).toMatch(/^Works/);
  expect(testMessage({ ok: false, category: "unauthorized" })).toMatch(/did not accept/);
  expect(testMessage({ ok: false, category: "<b>x</b>" })).toBe("The provider did not accept this credential.");
  const api = admin();
  api.on("POST /credentials/{credential_id}/test", { status: 200, body: { ok: true, category: null } });
  renderApp(`/app/enterprises/${IDS.enterprise}`, api);
  await userEvent.click(await screen.findByRole("tab", { name: "Credentials" }));
  await userEvent.click(await screen.findByRole("button", { name: "Test" }));
  expect(await screen.findByText("Works: the provider accepted this credential.")).toBeInTheDocument();
});

test("F5 preview opens the API-hosted widget with a server-created preview session", async () => {
  const api = admin();
  const url = `${SAMPLES.embed_snippet.body.widget_url}?mode=fullpage#preview=abc.def`;
  api.on("POST /instances/{instance_id}/preview-session", { status: 201, body: { preview_url: url, expires_at: "x" } });
  const open = jest.spyOn(window, "open").mockImplementation(() => null);
  renderApp(`/app/instances/${IDS.instance_web}`, api);
  await userEvent.click(await screen.findByRole("button", { name: "Open preview" }));
  await waitFor(() => expect(open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer"));
  expect(screen.getByText(/still count against quotas/)).toBeInTheDocument();
  open.mockRestore();
});

test("F6 deferred features are labelled, not offered as working controls", async () => {
  const api = admin();
  renderApp(`/app/integrations/${IDS.integration}`, api);
  await userEvent.click(await screen.findByRole("tab", { name: "Usage" }));
  expect(await screen.findByText(/analytics dashboards are not available yet/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /analytics/i })).toBeNull();
});
