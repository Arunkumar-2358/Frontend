"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { raiseRedFlagAction } from "./actions";

type Props = {
  teams: { code: string; name: string }[];
  members: { id: string; name: string; teams: string[] }[];
  kpis: { key: string; label: string; team: string; sheetTitle: string; target?: string }[];
};

export function RaiseRedFlagForm({ teams, members, kpis }: Props) {
  const [team, setTeam] = useState("");
  const [kpi, setKpi] = useState("");
  const agents = members.filter((m) => m.teams.includes(team));
  const teamKpis = kpis.filter((k) => k.team === team);
  const chosen = teamKpis.find((k) => k.key === kpi);
  return (
    <ActionForm action={raiseRedFlagAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Team" required>
        <Select name="teamCode" required value={team} onChange={(e) => { setTeam(e.target.value); setKpi(""); }} placeholder="Choose team…" options={teams.map((t) => ({ value: t.code, label: t.name }))} />
      </Field>
      <Field label="Agent" hint={team ? undefined : "Choose a team first"}>
        <Select name="agentId" disabled={!team} placeholder="Whole team / not agent-specific" options={agents.map((a) => ({ value: a.id, label: a.name }))} />
      </Field>
      <Field label="KPI deviated">
        <Select name="kpiKey" disabled={!team} value={kpi} onChange={(e) => setKpi(e.target.value)} placeholder="SOP deviation (no KPI)" options={[...teamKpis.map((k) => ({ value: k.key, label: k.team === "T4" ? `${k.label} (${k.sheetTitle})` : k.label })), { value: "__other", label: "Other (free text)…" }]} />
      </Field>
      {kpi === "__other" && (
        <Field label="KPI / standard deviated (free text)">
          <Input name="kpiOther" placeholder="e.g. Call script not followed" />
        </Field>
      )}
      <Field label="Target / standard" hint={chosen?.target ? `Configured target: ${chosen.target}` : undefined}>
        <Input name="targetStandard" key={kpi} defaultValue={chosen?.target ?? ""} placeholder="e.g. ≥ 20%" />
      </Field>
      <Field label="Actual">
        <Input name="actual" placeholder="e.g. 12%" />
      </Field>
      <Field label="Due date">
        <Input type="date" name="dueDate" />
      </Field>
      <Field label="Description" required className="sm:col-span-2 lg:col-span-3">
        <Textarea name="description" required placeholder="What was noticed?" />
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Submit>Raise red flag</Submit>
      </div>
    </ActionForm>
  );
}
