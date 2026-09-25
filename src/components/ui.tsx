import Link from "next/link";
import clsx from "clsx";
import type { ReactNode, ComponentProps } from "react";
import type { Stage } from "@contracts";
import { STAGE_LABEL } from "@contracts/shared/lifecycle";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 px-5 py-4">
          <h2 className="text-[13px] font-medium tracking-[0.06em] text-ink uppercase">{title}</h2>
          {actions}
        </header>
      )}
      <div className={clsx(pad && "px-5 pb-5", pad && !(title || actions) && "pt-5")}>{children}</div>
    </section>
  );
}

const BTN = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 border-transparent",
  secondary: "bg-white text-ink hover:bg-slate-50 hover:border-brand-300 border-slate-300",
  danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent",
};
export type BtnVariant = keyof typeof BTN;
export const btnClass = (variant: BtnVariant = "primary", size: "sm" | "md" = "md") =>
  clsx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2.5 text-sm",
    BTN[variant],
  );

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <button {...p} className={clsx(btnClass(variant, size), className)} />;
}

export function LinkButton({ href, variant = "secondary", size = "md", children, className }: { href: string; variant?: BtnVariant; size?: "sm" | "md"; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={clsx(btnClass(variant, size), className)}>
      {children}
    </Link>
  );
}

const inputCls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink shadow-xs placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500";

export function Input(p: ComponentProps<"input">) {
  return <input {...p} className={clsx(inputCls, p.className)} />;
}
export function Textarea(p: ComponentProps<"textarea">) {
  return <textarea rows={3} {...p} className={clsx(inputCls, p.className)} />;
}
export function Select({ options, placeholder, ...p }: ComponentProps<"select"> & { options: (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <select {...p} className={clsx(inputCls, "pr-8", p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{humanize(o)}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export function Field({ label, hint, children, className, required }: { label: string; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, ...p }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" {...p} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
      {label}
    </label>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-600 text-white ring-emerald-600",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  cyan: "bg-brand-100 text-brand-800 ring-brand-200",
  brand: "bg-brand-600 text-white ring-brand-600",
  outline: "bg-white text-ink ring-slate-300",
};
export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "slate", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export const STAGE_TONE: Record<Stage, Tone> = {
  MAPPING: "outline",
  VALIDATED: "blue",
  ENROLLED: "cyan",
  QUALIFIED: "violet",
  ACTIVE: "green",
  SOURCED: "amber",
  SELECTED: "amber",
  JOINED: "brand",
  SUCCESSFUL: "green",
  NOT_INTERESTED: "red",
  UNREACHABLE: "red",
  DUPLICATE: "slate",
  INVALID: "slate",
  DROPPED: "red",
};

export function StageBadge({ stage, cold }: { stage: Stage; cold?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>
      {cold && <Badge tone="blue">❄ cold</Badge>}
    </span>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "green" | "amber" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="text-[13px] font-medium tracking-[0.06em] text-ink uppercase">{label}</div>
      <div className={clsx("mt-2 text-[34px] leading-none font-medium tabular-nums", tone === "red" ? "text-accent" : tone === "green" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-ink")}>{value}</div>
      {hint && <div className={clsx("mt-3 inline-block rounded-md px-2.5 py-1 text-xs font-semibold", tone === "red" ? "bg-red-50 text-accent" : "bg-brand-50 text-brand-700")}>{hint}</div>}
    </div>
  );
}

export function Table({ head, children, empty, className }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode; className?: string }) {
  const hasRows = Array.isArray(children) ? children.flat().filter(Boolean).length > 0 : !!children;
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-head">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-[13.5px] font-semibold whitespace-nowrap text-ink">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {hasRows ? children : (
            <tr>
              <td colSpan={head.length} className="px-3 py-10 text-center text-sm text-slate-400">{empty ?? "Nothing here yet."}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function Td({ children, className, ...p }: ComponentProps<"td">) {
  return <td {...p} className={clsx("px-4 py-3 align-top text-ink", className)}>{children}</td>;
}

export function Progress({ value }: { value: number }) {
  const tone = value >= 100 ? "bg-emerald-500" : value >= 70 ? "bg-brand-500" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx("h-full rounded-full", tone)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{value}%</span>
    </div>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
      <span>
        {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString("en-IN")}
      </span>
      <div className="flex gap-2">
        {page > 1 && <LinkButton size="sm" href={hrefFor(page - 1)}>← Prev</LinkButton>}
        {page < pages && <LinkButton size="sm" href={hrefFor(page + 1)}>Next →</LinkButton>}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function humanize(s: string) {
  if (!s) return s;
  if (!/^[A-Z0-9_]+$/.test(s)) return s;
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

export function Dl({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="text-sm text-slate-900">{v === null || v === undefined || v === "" ? <span className="text-slate-300">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}
