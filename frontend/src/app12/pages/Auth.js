/** C1: sign in, forgotten password, reset, account (change password, sign out
 * everywhere, delete own account) and invitation acceptance. Tokens from links
 * are read from the URL fragment (never sent to the frontend server) and the
 * fragment is cleared immediately. Nothing is stored in web storage. */
import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ErrorBox, Notice, Section, TextField } from "../components/common";
import { PageTitle } from "../components/Shell";
import { useSession } from "../session";
import { errorMessage } from "../api/client";
import { useAction } from "../util";

function AuthCard({ title, children }) {
  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center px-4">
      <main id="main" className="w-full max-w-sm rounded-lg border border-white/10 bg-[#0B132B] p-6">
        <h1 className="text-xl font-semibold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h1>
        {children}
      </main>
    </div>
  );
}

/** Read `#token=…` once and remove it from the address bar. */
export function useFragmentToken() {
  const [token] = useState(() => {
    const m = /(?:^#|&)token=([^&]+)/.exec(window.location.hash || "");
    return m ? decodeURIComponent(m[1]) : "";
  });
  useEffect(() => {
    if (window.location.hash && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);
  return token;
}

export function LoginPage() {
  const { login, user, expired } = useSession();
  const loc = useLocation();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();
  if (user) return <Navigate to={(loc.state && loc.state.from) || "/app"} replace />;
  const submit = async (e) => {
    e.preventDefault();
    const u = await run(() => login(email, password));
    setPassword("");
    if (u) nav((loc.state && loc.state.from) || "/app", { replace: true });
  };
  return (
    <AuthCard title="Sign in to BitBotPro">
      {expired ? <Notice tone="warn">Your session has ended. Sign in again to continue.</Notice> : null}
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit}>
        <TextField label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} required />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} required />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="text-sm mt-4"><Link className="text-cyan-300 hover:underline" to="/app/forgot-password">Forgotten password?</Link></p>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const { api } = useSession();
  const [email, setEmail] = useState("");
  const { busy, error, notice, run } = useAction();
  return (
    <AuthCard title="Reset your password">
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.forgotPassword(email),
        "If an account exists for this address, a reset link has been sent. It expires soon and works once."); }}>
        <TextField label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} required />
        <Button type="submit" className="w-full" disabled={busy}>Send reset link</Button>
      </form>
      <p className="text-sm mt-4"><Link className="text-cyan-300 hover:underline" to="/app/login">Back to sign in</Link></p>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const { api } = useSession();
  const token = useFragmentToken();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const { busy, error, notice, run, setError } = useAction();
  const submit = (e) => {
    e.preventDefault();
    if (pw !== pw2) return setError("The passwords do not match.");
    return run(async () => { await api.resetPassword(token, pw); setPw(""); setPw2(""); },
      "Password changed. Every existing session was signed out.");
  };
  return (
    <AuthCard title="Choose a new password">
      {!token ? <ErrorBox>This reset link is incomplete. Request a new one.</ErrorBox> : null}
      <ErrorBox>{error}</ErrorBox>
      <Notice tone="ok">{notice}</Notice>
      {notice ? <Link className="text-cyan-300 hover:underline text-sm" to="/app/login">Sign in</Link> : (
        <form onSubmit={submit}>
          <TextField label="New password" type="password" autoComplete="new-password" value={pw} onChange={setPw} required minLength={12}
            hint="At least 12 characters; avoid common passwords." />
          <TextField label="Repeat new password" type="password" autoComplete="new-password" value={pw2} onChange={setPw2} required />
          <Button type="submit" className="w-full" disabled={busy || !token}>Change password</Button>
        </form>
      )}
    </AuthCard>
  );
}

export function AccountPage() {
  const { api, user, logout } = useSession();
  const nav = useNavigate();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState("");
  const pw = useAction();
  const del = useAction();
  return (
    <>
      <PageTitle kind="Account">{user && (user.name || user.email)}</PageTitle>
      <Section title="Change password" description="Changing your password signs out every other session.">
        <ErrorBox>{pw.error}</ErrorBox>
        <Notice tone="ok">{pw.notice}</Notice>
        <form className="max-w-sm" onSubmit={(e) => { e.preventDefault(); pw.run(async () => { await api.changePassword(cur, next); setCur(""); setNext(""); }, "Password changed."); }}>
          <TextField label="Current password" type="password" autoComplete="current-password" value={cur} onChange={setCur} required />
          <TextField label="New password" type="password" autoComplete="new-password" value={next} onChange={setNext} required minLength={12} />
          <Button size="sm" type="submit" disabled={pw.busy}>Change password</Button>
        </form>
      </Section>
      <Section title="Sessions">
        <Button size="sm" variant="outline" type="button" onClick={async () => { await logout(true); nav("/app/login"); }}>Sign out everywhere</Button>
      </Section>
      <Section title="Delete my account" description="Your memberships are removed. The last owner of an Enterprise or the last platform superadmin cannot delete their account.">
        <ErrorBox>{del.error}</ErrorBox>
        {!preview ? (
          <Button size="sm" variant="outline" type="button" onClick={() => del.run(async () => setPreview(await api.meDeletionPreview()))}>Preview deletion…</Button>
        ) : (
          <form className="max-w-sm" onSubmit={(e) => { e.preventDefault(); del.run(async () => { await api.meDelete(preview.preview_token, confirm); await logout(); nav("/app/login"); }); }}>
            <p className="text-sm text-slate-300 mb-2">This permanently deletes your account. Type your email address to confirm.</p>
            <TextField label="Email address" value={confirm} onChange={setConfirm} autoComplete="off" />
            <Button size="sm" variant="destructive" type="submit" disabled={del.busy || !confirm}>Delete my account</Button>
          </form>
        )}
      </Section>
    </>
  );
}

/** 6C B-ACCT: create an account from an e-mailed invitation (existing accounts sign in instead). */
export function CreateAccountFromInvitation({ token, onJoined }) {
  const { api, refresh } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [signIn, setSignIn] = useState(false);
  const { busy, error, run, setError } = useAction();
  const submit = (e) => {
    e.preventDefault();
    if (pw !== pw2) return setError("The passwords do not match.");
    return run(async () => {
      try {
        await api.registerByInvitation(token, name, pw);
      } catch (err) {
        if (err && err.status === 409) setSignIn(true);
        if (err && err.status === 404) throw new Error("This invitation link is invalid, has expired or has already been used. Ask for a new invitation.");
        throw err;
      }
      setPw(""); setPw2("");
      onJoined();
      await refresh();
      navigate("/app", { replace: true });
    });
  };
  return (
    <AuthCard title="You have been invited">
      <p className="text-sm text-slate-300 mb-3">Create your BitBotPro account to accept the invitation. Already have an account?{" "}
        <Link className="text-cyan-300 hover:underline" to="/app/login">Sign in</Link>, then open the invitation link again.</p>
      <ErrorBox>{error}</ErrorBox>
      {signIn ? <Link className="text-cyan-300 hover:underline text-sm" to="/app/login">Sign in</Link> : (
        <form onSubmit={submit}>
          <TextField label="Your name" autoComplete="name" value={name} onChange={setName} required maxLength={120} />
          <TextField label="Password" type="password" autoComplete="new-password" value={pw} onChange={setPw} required minLength={12}
            hint="At least 12 characters; avoid common passwords." />
          <TextField label="Repeat password" type="password" autoComplete="new-password" value={pw2} onChange={setPw2} required />
          <Button type="submit" className="w-full" disabled={busy || !token}>Create account and join</Button>
        </form>
      )}
    </AuthCard>
  );
}

export function InvitationPage() {
  const { api, user } = useSession();
  const token = useFragmentToken();
  const [held, setHeld] = useState(() => token);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!user || !held) return;
    api.lookupInvitation(held).then(setInfo).catch((e) => setError(errorMessage(e)));
  }, [api, user, held]);
  if (!held) return <AuthCard title="Invitation"><ErrorBox>This invitation link is incomplete.</ErrorBox></AuthCard>;
  if (!user) return <CreateAccountFromInvitation token={held} onJoined={() => setHeld("")} />;
  return (
    <AuthCard title="Accept invitation">
      <ErrorBox>{error}</ErrorBox>
      {done ? <><Notice tone="ok">Invitation accepted.</Notice><Link to="/app" className="text-cyan-300 hover:underline text-sm">Continue</Link></> : info ? (
        <>
          <p className="text-sm text-slate-200 mb-3">Join <strong>{info.enterprise_name}</strong> as <strong>{info.role}</strong>.</p>
          <Button type="button" onClick={async () => { try { await api.acceptInvitation(held); setHeld(""); setDone(true); } catch (e) { setError(errorMessage(e)); } }}>Accept</Button>
        </>
      ) : null}
    </AuthCard>
  );
}
