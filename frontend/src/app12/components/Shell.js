/** App shell: skip link, top navigation, breadcrumbs built from server ancestry (C2). */
import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useSession } from "../session";

export function Shell({ children }) {
  const { user, logout } = useSession();
  const nav = useNavigate();
  const link = ({ isActive }) => `px-2 py-1 rounded text-sm ${isActive ? "text-cyan-300 bg-white/5" : "text-slate-300 hover:text-white"}`;
  return (
    <div className="min-h-screen bg-[#030712] text-slate-100" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 bg-white text-black px-2 py-1 rounded">Skip to content</a>
      <header className="border-b border-white/10 bg-[#050B14]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <Link to="/app" className="font-semibold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>BitBotPro</Link>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            <NavLink to="/app" end className={link}>Enterprises</NavLink>
            {user && user.is_platform_superadmin ? <NavLink to="/app/platform" className={link}>Platform</NavLink> : null}
            <NavLink to="/app/account" className={link}>Account</NavLink>
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400" aria-label="Signed in as">{user ? user.email : ""}</span>
            <button type="button" className="text-slate-300 hover:text-white underline-offset-2 hover:underline"
              onClick={async () => { await logout(); nav("/app/login"); }}>Sign out</button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

const CRUMB_PATH = { enterprise: "enterprises", organisation: "organisations", bot: "bots", instance: "instances", integration: "integrations" };

/**
 * Breadcrumbs from the object's server-assigned ancestry ids. Names are
 * fetched through the same authorised endpoints; an ancestor the user cannot
 * read is shown without a link.
 */
export function Breadcrumbs({ api, node, kind }) {
  const [names, setNames] = useState({});
  const chain = [];
  if (node) {
    if (node.enterprise_id && kind !== "enterprise") chain.push(["enterprise", node.enterprise_id]);
    if (node.organisation_id && kind !== "organisation") chain.push(["organisation", node.organisation_id]);
    if (node.bot_id && kind !== "bot") chain.push(["bot", node.bot_id]);
    chain.push([kind, node.id, node.name]);
  }
  const key = chain.map((c) => c[1]).join("/");
  useEffect(() => {
    let alive = true;
    // An Enterprise the user cannot read directly still appears in their Enterprise list.
    const enterpriseName = (id) => api.enterprise(id).then((n) => n.name).catch(() => api.enterprises()
      .then((r) => ((r.enterprises || []).find((e) => e.id === id) || {}).name || null).catch(() => null));
    const fetchers = { enterprise: enterpriseName, organisation: (id) => api.organisation(id).then((n) => n.name),
      bot: (id) => api.bot(id).then((n) => n.name) };
    Promise.all(chain.slice(0, -1).map(([k, id]) => fetchers[k](id).then((n) => [id, n || null]).catch(() => [id, null])))
      .then((pairs) => alive && setNames(Object.fromEntries(pairs)));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key]);
  if (!node) return null;
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-400 mb-4">
      <ol className="flex flex-wrap gap-1">
        <li><Link to="/app" className="hover:text-white">Enterprises</Link></li>
        {chain.map(([k, id, own], i) => {
          const last = i === chain.length - 1;
          const label = own || names[id] || (names[id] === null ? `${k} (no access)` : "…");
          return (
            <li key={id} className="flex gap-1">
              <span aria-hidden="true">/</span>
              {last ? <span aria-current="page" className="text-white">{label}</span>
                : names[id] === null ? <span>{label}</span>
                  : <Link to={`/app/${CRUMB_PATH[k]}/${id}`} className="hover:text-white">{label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageTitle({ children, kind, sub }) {
  return (
    <div className="mb-4">
      {kind ? <p className="text-xs uppercase tracking-wide text-cyan-400">{kind}</p> : null}
      <h1 className="text-2xl font-semibold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>{children}</h1>
      {sub ? <p className="text-sm text-slate-400 mt-1">{sub}</p> : null}
    </div>
  );
}

/** Simple accessible tabs bound to the URL hash-free local state. */
export function Tabs({ tabs, initial }) {
  const [active, setActive] = useState(initial || (tabs[0] && tabs[0][0]));
  const visible = tabs.filter(Boolean);
  const onKey = (e, i) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = visible[(i + (e.key === "ArrowRight" ? 1 : visible.length - 1)) % visible.length][0];
    setActive(next);
    const el = document.getElementById(`tab-${next}`);
    if (el) el.focus();
  };
  const current = visible.find((t) => t[0] === active) || visible[0];
  return (
    <div>
      <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-1 border-b border-white/10 mb-4">
        {visible.map(([k, label], i) => (
          <button key={k} id={`tab-${k}`} role="tab" type="button" aria-selected={k === current[0]} aria-controls={`panel-${k}`}
            tabIndex={k === current[0] ? 0 : -1} onKeyDown={(e) => onKey(e, i)} onClick={() => setActive(k)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${k === current[0] ? "border-cyan-400 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${current[0]}`} aria-labelledby={`tab-${current[0]}`}>{current[2]()}</div>
    </div>
  );
}
