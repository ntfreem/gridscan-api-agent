/** MembersPanel with invitations (C4/C5). The server enforces role limits,
 * delegation policy, no privilege escalation and last-owner protection. */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, DataTable, ErrorBox, Loading, Notice, OneTimeSecret, Section, SelectField, TextField } from "./common";
import { ROLES, fmtDate, useAction, useLoad } from "../util";

export default function MembersPanel({ api, type, scopeId, enterpriseId, canManage }) {
  const members = useLoad(() => api.members(type, scopeId), [api, type, scopeId]);
  const invites = useLoad(() => (canManage ? api.invitations(enterpriseId) : Promise.resolve({ invitations: [] })),
    [api, enterpriseId, canManage]);
  const { busy, error, notice, run } = useAction();
  const roles = type === "enterprise" ? ROLES : ROLES.filter((r) => r !== "owner");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState(null);
  const [delivery, setDelivery] = useState("email");
  const search = async (q) => {
    if ((q || "").trim().length < 3) { setCandidates([]); return; }
    try { setCandidates((await api.memberCandidates(type, scopeId, q.trim())).candidates || []); } catch (e) { setCandidates([]); }
  };
  const [userRole, setUserRole] = useState("viewer");
  const [link, setLink] = useState("");
  const scopeType = { enterprise: "enterprises", organisation: "organisations", bot: "bots" }[type];
  const mine = ((invites.data && invites.data.invitations) || []).filter((i) => i.scope_id === scopeId && i.status === "pending");

  return (
    <Section title="Members" description="Roles inherit downwards. Owners exist only at Enterprise level; the last owner cannot be removed.">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {members.loading ? <Loading /> : <ErrorBox error={members.error} />}
      <DataTable caption="Members" rows={(members.data && members.data.members) || []} columns={[
        { key: "email", label: "User", render: (m) => <span>{m.name || "—"} <span className="text-slate-400">{m.email}</span></span> },
        { key: "role", label: "Role", render: (m) => canManage ? (
          <>
            <label className="sr-only" htmlFor={`role-${m.user_id}`}>Role for {m.email}</label>
            <select id={`role-${m.user_id}`} value={m.role} disabled={busy}
              onChange={(e) => run(async () => { await api.setMemberRole(type, scopeId, m.user_id, e.target.value); await members.reload(); }, "Role updated.")}
              className="rounded border border-white/15 bg-[#050B14] px-2 py-1 text-sm text-white">
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </>) : m.role },
        { key: "x", label: "", render: (m) => canManage ? (
          <ConfirmButton confirmLabel="Remove" onConfirm={() => run(async () => { await api.removeMember(type, scopeId, m.user_id); await members.reload(); }, "Member removed.")}>
            Remove</ConfirmButton>) : null },
      ]} />
      <OneTimeSecret value={link} onDone={() => setLink("")}
        label="Invitation link: send it to the invitee. It works once, for that email address, and is not shown again." />
      {canManage ? (
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <form onSubmit={(e) => { e.preventDefault(); run(async () => {
            const r = await api.invite(enterpriseId, { email, role, scope_type: scopeType, scope_id: scopeId, delivery });
            setEmail("");
            if (r && r.token) setLink(`${window.location.origin}/app/invitations#token=${encodeURIComponent(r.token)}`);
            await invites.reload();
            return r;
          }, (r) => (delivery === "link" ? "Invitation created. Send the link below to the invitee."
            : r && r.email_sent ? "Invitation e-mail sent." : "Invitation created, but the e-mail could not be sent. Revoke it and invite again, or create a link.")); }}>
            <h3 className="text-sm font-semibold mb-2">Invite by email</h3>
            <TextField label="Email" type="email" value={email} onChange={setEmail} required autoComplete="off" />
            <SelectField label="Role" value={role} onChange={setRole} options={roles.map((r) => [r, r])} />
            <SelectField label="Delivery" value={delivery} onChange={setDelivery}
              options={[["email", "Send an invitation e-mail"], ["link", "Create a single-use link to send yourself"]]} />
            <Button size="sm" type="submit" disabled={busy || !email}>{delivery === "email" ? "Send invitation" : "Create link"}</Button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); run(async () => {
            await api.addMember(type, scopeId, picked.id, userRole); setPicked(null); setQuery(""); setCandidates([]); await members.reload();
          }, "Member added."); }}>
            <h3 className="text-sm font-semibold mb-2">Add an existing Enterprise member</h3>
            <TextField label="Search by e-mail" value={query} hint="At least 3 characters. Only people who already belong to this Enterprise appear."
              onChange={(v) => { setQuery(v); setPicked(null); search(v); }} autoComplete="off" />
            {candidates.length ? (
              <ul role="listbox" aria-label="Matching members" className="mb-2 border border-white/10 rounded">
                {candidates.map((c) => (
                  <li key={c.id} role="option" aria-selected={Boolean(picked && picked.id === c.id)}>
                    <button type="button" className={`w-full text-left px-2 py-1 text-sm hover:bg-white/5 ${picked && picked.id === c.id ? "bg-white/10" : ""}`}
                      onClick={() => setPicked(c)}>{c.name || "—"} <span className="text-slate-400">{c.email}</span></button>
                  </li>
                ))}
              </ul>
            ) : null}
            <SelectField label="Role" value={userRole} onChange={setUserRole} options={roles.map((r) => [r, r])} />
            <Button size="sm" type="submit" disabled={busy || !picked}>{picked ? `Add ${picked.email}` : "Add member"}</Button>
          </form>
        </div>
      ) : null}
      {canManage && mine.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-1">Pending invitations</h3>
          <DataTable caption="Pending invitations" rows={mine} columns={[
            { key: "email", label: "Email" }, { key: "role", label: "Role" },
            { key: "expires_at", label: "Expires", render: (i) => fmtDate(i.expires_at) },
            { key: "x", label: "", render: (i) => <ConfirmButton confirmLabel="Revoke"
              onConfirm={() => run(async () => { await api.revokeInvitation(i.id); await invites.reload(); }, "Invitation revoked.")}>Revoke</ConfirmButton> },
          ]} />
        </div>
      ) : null}
    </Section>
  );
}
