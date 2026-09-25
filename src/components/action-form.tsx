"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { ActionState } from "@/lib/action";
import { btnClass, type BtnVariant } from "./ui";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
};

/** A form bound to a server action; shows gate/validation errors inline. */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: Props) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <FormMessage state={state} />
    </form>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p key={state.at} role={state.ok ? "status" : "alert"} className={clsx("mt-2 rounded-md px-3 py-2 text-sm", state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

export function Submit({ children, variant = "primary", size = "md", className, name, value }: { children: ReactNode; variant?: BtnVariant; size?: "sm" | "md"; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={clsx(btnClass(variant, size), className)}>
      {pending ? "Working…" : children}
    </button>
  );
}
