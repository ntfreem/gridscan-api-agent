/** Phase 6C B-ACCT: a new person opens an e-mailed invitation, creates an account and joins. */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockApi, SAMPLES, renderApp } from "../testing/harness";

function anonymous() {
  const api = new MockApi();
  let signedIn = false;
  api.on("GET /auth/session", () => (signedIn ? { status: 200, body: SAMPLES.session.body }
    : { status: 401, body: { detail: "Authentication required." } }));
  return { api, signIn: () => { signedIn = true; } };
}

function openInvitation(api, token) {
  window.history.replaceState(null, "", `/app/invitations#token=${token}`);   // the page reads the real fragment
  return renderApp("/app/invitations", api);
}

async function fill(name, pw, pw2 = pw) {
  await userEvent.type(await screen.findByLabelText("Your name"), name);
  await userEvent.type(screen.getByLabelText("Password"), pw);
  await userEvent.type(screen.getByLabelText("Repeat password"), pw2);
  await userEvent.click(screen.getByRole("button", { name: "Create account and join" }));
}

test("a new person creates an account from the invitation and lands in the app", async () => {
  const { api, signIn } = anonymous();
  api.on("POST /invitations/register", (r) => { signIn(); return { status: 201, body: SAMPLES.invitation_register.body }; });
  openInvitation(api, "tok_from_email");
  await fill("New Person", "Orchid-Lantern-Harbour-2026");
  await waitFor(() => expect(api.calls("POST /invitations/register")).toHaveLength(1));
  const call = api.calls("POST /invitations/register")[0];
  expect(call.body).toEqual({ token: "tok_from_email", name: "New Person", password: "Orchid-Lantern-Harbour-2026" });
  expect(call.headers["X-Requested-With"]).toBe("BitBotPro");                 // CSRF header
  expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
  expect(window.location.hash).toBe("");                                        // token removed from the address bar
});

test("mismatched passwords are caught before any request", async () => {
  const { api } = anonymous();
  openInvitation(api, "tok");
  await fill("New Person", "Orchid-Lantern-Harbour-2026", "Orchid-Lantern-Harbour-2027");
  expect(await screen.findByText("The passwords do not match.")).toBeInTheDocument();
  expect(api.calls("POST /invitations/register")).toHaveLength(0);
});

test("an existing account is sent to sign in; weak passwords and dead links are explained", async () => {
  const { api } = anonymous();
  let answer = { status: 422, body: SAMPLES.invitation_register_weak.body };
  api.on("POST /invitations/register", () => answer);
  openInvitation(api, "tok");
  await fill("New Person", "shortpassword1");
  expect(await screen.findByText(/Password does not meet the requirements/)).toBeInTheDocument();
  answer = { status: 404, body: SAMPLES.invitation_register_used.body };
  await userEvent.click(screen.getByRole("button", { name: "Create account and join" }));
  expect(await screen.findByText(/invalid, has expired or has already been used/)).toBeInTheDocument();
  answer = { status: 409, body: { detail: "An account already exists for this e-mail address. Sign in, then open the invitation link again." } };
  await userEvent.click(screen.getByRole("button", { name: "Create account and join" }));
  expect(await screen.findByText(/An account already exists/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create account and join" })).toBeNull();
  expect(screen.getAllByRole("link", { name: "Sign in" }).length).toBeGreaterThan(0);
});
