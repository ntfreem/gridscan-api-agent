/** UsagePanel (Phase 6A F1): AI messages by billing state for one target and
 * month, preview and verification usage shown separately, applicable quotas.
 * Counts come only from the API (tenant-scoped there). */
import React, { useState } from "react";
import { DataTable, ErrorBox, KeyValues, Loading, Notice, Section } from "./common";
import { useLoad } from "../util";

export function currentPeriod(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function UsagePanel({ api, type, id, integration = false }) {
  const [period, setPeriod] = useState(currentPeriod());
  const u = useLoad(() => (integration ? api.integrationUsage(id, period) : api.usage(type, id, period)), [api, type, id, period, integration]);
  const d = u.data;
  return (
    <Section title="Usage" description="AI messages for the selected month. Preview traffic is counted against quotas and billed like live traffic; it is only reported separately.">
      <label htmlFor={`period-${id}`} className="text-sm text-slate-300">Month</label>{" "}
      <input id={`period-${id}`} type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)}
        className="rounded-md border border-white/15 bg-[#050B14] px-2 py-1 text-sm text-white mb-3" />
      {u.loading && !d ? <Loading /> : <ErrorBox error={u.error} />}
      {d ? (
        <>
          <KeyValues rows={[
            ["Billed (settled)", d.ai_messages.settled],
            ["Of which preview", d.preview.settled],
            ["Of which answer verification (K-H)", d.verification.settled],
            ["In progress", d.ai_messages.reserved + d.ai_messages.reserving],
            ["Uncertain (awaiting review)", d.ai_messages.uncertain],
            ["Not billed (released / over quota)", `${d.ai_messages.released} / ${d.ai_messages.rejected}`],
            d.webchat_daily_limit ? ["Webchat daily limit per instance", d.webchat_daily_limit] : null,
          ]} />
          {d.ai_messages.uncertain ? <Notice tone="warn">Some generations have an uncertain outcome. Review them on the integration or instance before they are charged or waived.</Notice> : null}
          <h3 className="text-sm font-semibold mt-4 mb-1">Monthly quotas</h3>
          <DataTable caption="Monthly AI message quotas" rows={d.quotas} empty="No quota information is visible at this level." columns={[
            { key: "scope", label: "Scope" },
            { key: "used", label: "Used" },
            { key: "limit", label: "Limit", render: (q) => (q.limit === null || q.limit === undefined ? "Unlimited" : q.limit) },
          ]} />
          <p className="text-xs text-slate-400 mt-2">{d.billing_note}</p>
        </>
      ) : null}
    </Section>
  );
}
