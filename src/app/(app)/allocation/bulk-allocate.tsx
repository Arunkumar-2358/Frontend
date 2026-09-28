"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action";
import { FormMessage, Submit } from "@/components/action-form";

/** Keep in sync with the `form` attribute on the row checkboxes in page.tsx. */
export const ALLOCATE_FORM_ID = "allocate-ticked";

/**
 * Allocate the ticked rows (checkboxes join this form through the HTML `form` attribute).
 * Also used by the cold-lead calls page, with its own form id and field name.
 */
export function BulkAllocateForm({
  action,
  sourcers,
  formId = ALLOCATE_FORM_ID,
  field = "sourcerId",
  label = "Allocate ticked leads to",
  placeholder = "Choose a Team 2 sourcer…",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  sourcers: { value: string; label: string }[];
  formId?: string;
  field?: string;
  label?: string;
  placeholder?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const toggle = (checked: boolean) =>
    document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form=${formId}]`).forEach((el) => (el.checked = checked));
  return (
    <form id={formId} action={formAction}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
          <select name={field} required defaultValue="" className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-900 shadow-xs focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none sm:w-72">
            <option value="" disabled>{placeholder}</option>
            {sourcers.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <Submit>Allocate ticked</Submit>
        <div className="flex gap-3 text-xs sm:ml-2 sm:self-center">
          <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => toggle(true)}>Tick all on page</button>
          <button type="button" className="font-medium text-slate-500 hover:underline" onClick={() => toggle(false)}>Clear</button>
        </div>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
