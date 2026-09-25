"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Textarea, btnClass } from "@/components/ui";
import type { ActionState } from "@/lib/action";

type Sub = { key: number; name: string; weight: string };
type Row = { key: number; name: string; weight: string; children: Sub[] };
export type EditorCriterion = { name: string; weightPct?: number; children?: { name: string; weightPct: number }[] };

let seq = 0;
const nextKey = () => ++seq;
const toNum = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={btnClass("primary")}>
      {pending ? "Saving…" : "Save template"}
    </button>
  );
}

export function TemplateEditor({
  action,
  initial,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: { id?: string; name: string; description: string; criteria: EditorCriterion[] };
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.criteria.map((c) => ({
      key: nextKey(),
      name: c.name,
      weight: c.children?.length ? "" : String(c.weightPct ?? ""),
      children: (c.children ?? []).map((ch) => ({ key: nextKey(), name: ch.name, weight: String(ch.weightPct) })),
    })),
  );

  const rowTotal = (r: Row) => (r.children.length ? r.children.reduce((a, ch) => a + toNum(ch.weight), 0) : toNum(r.weight));
  const total = Math.round(rows.reduce((a, r) => a + rowTotal(r), 0) * 100) / 100;
  const exact = Math.abs(total - 100) < 1e-9;
  const namesOk = rows.length > 0 && rows.every((r) => r.name.trim() && r.children.every((ch) => ch.name.trim()));

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateSub = (key: number, subKey: number, patch: Partial<Sub>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, children: r.children.map((ch) => (ch.key === subKey ? { ...ch, ...patch } : ch)) } : r)));
  const move = (idx: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = idx + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });

  const payload = JSON.stringify(
    rows.map((r) =>
      r.children.length
        ? { name: r.name.trim(), children: r.children.map((ch) => ({ name: ch.name.trim(), weightPct: toNum(ch.weight) })) }
        : { name: r.name.trim(), weightPct: toNum(r.weight) },
    ),
  );

  return (
    <ActionForm action={action} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="criteria" value={payload} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Template name" required><Input name="name" required defaultValue={initial.name} /></Field>
        <Field label="Description"><Textarea name="description" rows={1} defaultValue={initial.description} /></Field>
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-right text-xs text-slate-400 tabular-nums">{i + 1}.</span>
              <Input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder="Criterion name" className="min-w-48 flex-1" aria-label="Criterion name" />
              {r.children.length ? (
                <span className="w-28 text-right text-sm text-slate-500 tabular-nums">{Math.round(rowTotal(r) * 100) / 100}% (sum)</span>
              ) : (
                <div className="flex w-28 items-center gap-1">
                  <Input type="number" min={0} step="any" value={r.weight} onChange={(e) => update(r.key, { weight: e.target.value })} className="text-right" aria-label="Weight %" />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              )}
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">↓</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => update(r.key, { children: [...r.children, { key: nextKey(), name: "", weight: r.children.length ? "" : r.weight }], weight: "" })}
                >
                  + Sub-criterion
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove criterion">✕</Button>
              </div>
            </div>
            {r.children.length > 0 && (
              <div className="mt-2 space-y-2 pl-8">
                {r.children.map((ch) => (
                  <div key={ch.key} className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-300">↳</span>
                    <Input value={ch.name} onChange={(e) => updateSub(r.key, ch.key, { name: e.target.value })} placeholder="Sub-criterion name" className="min-w-40 flex-1" aria-label="Sub-criterion name" />
                    <div className="flex w-28 items-center gap-1">
                      <Input type="number" min={0} step="any" value={ch.weight} onChange={(e) => updateSub(r.key, ch.key, { weight: e.target.value })} className="text-right" aria-label="Sub-criterion weight %" />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Remove sub-criterion"
                      onClick={() => {
                        const left = r.children.filter((x) => x.key !== ch.key);
                        update(r.key, { children: left, weight: left.length ? "" : ch.weight });
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, { key: nextKey(), name: "", weight: "", children: [] }])}>
          + Add criterion
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className={clsx("text-sm font-semibold tabular-nums", exact ? "text-emerald-600" : "text-red-600")} aria-live="polite">
          Total weight: {total}% {exact ? "✓" : `— must be exactly 100% (${total > 100 ? `${Math.round((total - 100) * 100) / 100}% over` : `${Math.round((100 - total) * 100) / 100}% short`})`}
        </div>
        <div className="flex items-center gap-3">
          {!namesOk && <span className="text-xs text-slate-500">Every criterion and sub-criterion needs a name.</span>}
          <SaveButton disabled={!exact || !namesOk} />
        </div>
      </div>
    </ActionForm>
  );
}
