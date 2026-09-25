"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { saveTemplateAction } from "./actions";
import { PLACEHOLDERS } from "./placeholders";


const render = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (k in PLACEHOLDERS ? PLACEHOLDERS[k] : `⟨unknown: ${k}⟩`));

type T = { id?: string; key: string; name: string; channel: string; subject: string | null; body: string; active: boolean };

export function TemplateEditor({ t }: { t: T }) {
  const [channel, setChannel] = useState(t.channel);
  const [subject, setSubject] = useState(t.subject ?? "");
  const [body, setBody] = useState(t.body);
  return (
    <ActionForm action={saveTemplateAction} className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        {t.id && <input type="hidden" name="id" value={t.id} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Key" required><Input name="key" defaultValue={t.key} required pattern="[a-z0-9_]+" /></Field>
          <Field label="Name" required><Input name="name" defaultValue={t.name} required /></Field>
          <Field label="Channel" required>
            <Select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} options={["WHATSAPP", "SMS", "EMAIL"].map((c) => ({ value: c, label: c === "WHATSAPP" ? "WhatsApp" : c === "SMS" ? "SMS" : "Email" }))} />
          </Field>
        </div>
        {channel === "EMAIL" && (
          <Field label="Subject"><Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        )}
        <Field label="Body" required>
          <Textarea name="body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required className="font-mono text-xs" />
        </Field>
        <div className="flex items-center gap-4">
          <Checkbox name="active" label="Active" defaultChecked={t.active} />
          <Submit size="sm">{t.id ? "Save template" : "Create template"}</Submit>
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-slate-600">Live preview (sample data)</div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-800">
          {channel === "EMAIL" && <div className="mb-2 border-b border-slate-200 pb-2 font-medium">{render(subject) || <span className="text-slate-400">(no subject)</span>}</div>}
          {render(body)}
        </div>
        {channel === "SMS" && <p className="mt-1 text-xs text-slate-400">{render(body).length} characters{render(body).length > 160 ? " · more than one SMS segment" : ""}</p>}
      </div>
    </ActionForm>
  );
}
