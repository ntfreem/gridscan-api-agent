import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfigPanel from "../components/ConfigPanel";
import DeleteDialog, { JobView } from "../components/DeleteDialog";
import { createClient } from "../api/client";
import { makeApi } from "../api/endpoints";
import { MockApi, SAMPLES, IDS } from "../testing/harness";

const apiFor = (mock) => makeApi(createClient({ origin: "", fetchImpl: mock.fetch }));

describe("ConfigPanel", () => {
  const view = () => {
    const v = JSON.parse(JSON.stringify(SAMPLES.config_bot.body));
    v.sources["behaviour.language"] = { kind: "override", level: "organisation", object_id: IDS.organisation };
    v.sources["knowledge.mode"] = { kind: "override", level: "bot", object_id: IDS.bot };
    v.values["knowledge.mode"] = "strict_knowledge_only";
    v.overridable["ai.model"] = false;
    return v;
  };

  test("shows provenance, own overrides, policy locks", () => {
    render(<ConfigPanel view={view()} targetId={IDS.bot} canEdit onPatch={jest.fn()} names={{ [IDS.organisation]: "Org A" }} />);
    expect(screen.getByText("Inherited from Organisation Org A")).toBeInTheDocument();
    expect(screen.getAllByText("Set here")).toHaveLength(1);
    expect(screen.getAllByText("Platform default").length).toBeGreaterThan(5);
    expect(screen.getByText(/Locked: set by a parent policy/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Override ai.model" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reset knowledge.mode to inherited" })).toBeInTheDocument();
    expect(screen.getByText(/never falls back to general AI knowledge/)).toBeInTheDocument();
  });

  test("override sends a sparse change; reset sends null", async () => {
    const onPatch = jest.fn().mockResolvedValue({});
    render(<ConfigPanel view={view()} targetId={IDS.bot} canEdit onPatch={onPatch} />);
    await userEvent.click(screen.getByRole("button", { name: "Override knowledge.min_evidence_score" }));
    const input = screen.getByLabelText("knowledge.min_evidence_score");
    await userEvent.clear(input);
    await userEvent.type(input, "0.7");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith({ "knowledge.min_evidence_score": 0.7 }));
    await userEvent.click(screen.getByRole("button", { name: "Reset knowledge.mode to inherited" }));
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith({ "knowledge.mode": null }));
  });

  test("server refusal is shown and the value is not changed locally", async () => {
    const err = Object.assign(new Error("x"), {});
    const onPatch = jest.fn().mockRejectedValue(err);
    render(<ConfigPanel view={view()} targetId={IDS.bot} canEdit onPatch={onPatch} />);
    await userEvent.click(screen.getByRole("button", { name: "Override knowledge.require_citations" }));
    await userEvent.click(screen.getByLabelText("knowledge.require_citations"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  test("viewers see values but no edit controls (C15)", () => {
    render(<ConfigPanel view={view()} targetId={IDS.bot} canEdit={false} onPatch={jest.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("strict_knowledge_only")).toBeInTheDocument();
  });
});

describe("DeleteDialog (C13)", () => {
  test("preview → exact typed name → job progress", async () => {
    const mock = new MockApi();
    const job = { ...SAMPLES.deletion_job.body, status: "awaiting_external_cleanup" };
    mock.on("GET /deletion-jobs/{job_id}", { status: 200, body: job });
    render(<DeleteDialog api={apiFor(mock)} type="organisation" id={IDS.organisation} name="Org A" open onOpenChange={() => {}} pollMs={0} />);
    expect(await screen.findByText(/bot instances/)).toBeInTheDocument();
    expect(screen.getByText(/discord leave guild/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Delete permanently" });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/to confirm/), "Org a");
    expect(btn).toBeDisabled();                                            // exact, case-sensitive
    await userEvent.clear(screen.getByLabelText(/to confirm/));
    await userEvent.type(screen.getByLabelText(/to confirm/), "Org A");
    await userEvent.click(btn);
    const [del] = mock.calls("POST /{type_}/{object_id}/delete");
    expect(del.body).toEqual({ preview_token: SAMPLES.deletion_preview.body.preview_token, confirm_name: "Org A" });
    expect(del.headers["X-Requested-With"]).toBe("BitBotPro");
    expect(await screen.findByText(/Deleting|Deletion queued|Waiting for external cleanup|Data removed/)).toBeInTheDocument();
  });

  test("last-owner / last-superadmin refusals from the server are shown", async () => {
    const mock = new MockApi();
    mock.on("POST /{type_}/{object_id}/delete", { status: 409, body: { detail: "The last Enterprise owner cannot be removed." } });
    render(<DeleteDialog api={apiFor(mock)} type="enterprise" id={IDS.enterprise} name="Org A" open onOpenChange={() => {}} pollMs={0} />);
    await screen.findByText(/bot instances/);
    await userEvent.type(screen.getByLabelText(/to confirm/), "Org A");
    await userEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(await screen.findByText("The last Enterprise owner cannot be removed.")).toBeInTheDocument();
  });

  test("failed cleanup can be resumed, and failed actions resolved only with a reason", async () => {
    const mock = new MockApi();
    const failed = { ...SAMPLES.deletion_job.body, status: "cleanup_failed",
      external_actions: [{ ...SAMPLES.deletion_job.body.external_actions[0], state: "failed", error_class: "forbidden" }] };
    mock.on("POST /deletion-jobs/{job_id}/resume", { status: 200, body: { ...failed, status: "running" } });
    mock.on("POST /deletion-jobs/{job_id}/actions/{action_id}/resolve", { status: 200, body: { ...failed, status: "completed" } });
    render(<JobView api={apiFor(mock)} job={failed} pollMs={0} />);
    expect(screen.getByText(/Some external cleanup failed/)).toBeInTheDocument();
    const resolve = screen.getByRole("button", { name: "Resolve" });
    expect(resolve).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason for resolving/), "Bot removed by hand");
    await userEvent.click(resolve);
    await waitFor(() => expect(mock.calls("POST /deletion-jobs/{job_id}/actions/{action_id}/resolve")[0].body).toEqual({ reason: "Bot removed by hand" }));
    expect(await screen.findByText("Deletion completed.")).toBeInTheDocument();
  });

  test("table of external actions is labelled", () => {
    render(<JobView api={apiFor(new MockApi())} job={SAMPLES.deletion_job.body} pollMs={0} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").length).toBeGreaterThan(3);
  });
});
