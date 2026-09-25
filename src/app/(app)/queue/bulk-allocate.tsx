"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action";
import { FormMessage, Submit } from "@/components/action-form";

/** Keep in sync with the `form` attribute on the row checkboxes in page.tsx. */
const ALLOCATE_FORM_ID = "allocate-form";

/**
 * Bulk allocation form. Row checkboxes live elsewhere on the page and join this
 * form through the HTML `form` attribute (rows have their own forms, which cannot nest).
 */
export function BulkAllocateForm({ action, telecallers }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; telecallers: { value: string; label: string }[] }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form id={ALLOCATE_FORM_ID} action={formAction}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Allocate ticked leads to tele-caller</span>
          <select name="telecallerId" required defaultValue="" className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-900 shadow-xs focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none sm:w-64">
            <option value="" disabled>Choose a tele-caller…</option>
            {telecallers.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <Submit>Allocate for first-time call</Submit>
        <SelectAll />
      </div>
      <FormMessage state={state} />
    </form>
  );
}

function SelectAll() {
  const toggle = (checked: boolean) => {
    document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form=${ALLOCATE_FORM_ID}]`).forEach((el) => (el.checked = checked));
  };
  return (
    <div className="flex gap-3 text-xs sm:ml-2 sm:self-center">
      <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => toggle(true)}>Tick all on page</button>
      <button type="button" className="font-medium text-slate-500 hover:underline" onClick={() => toggle(false)}>Clear</button>
    </div>
  );
}
