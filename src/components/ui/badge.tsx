import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Pill badge. `tone` keeps the app's colour names (StageBadge etc. rely on them). */
export const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", {
  variants: {
    tone: {
      slate: "bg-slate-100 text-slate-700 ring-slate-200",
      blue: "bg-brand-50 text-brand-700 ring-brand-200",
      green: "bg-emerald-600 text-white ring-emerald-600",
      amber: "bg-amber-50 text-amber-800 ring-amber-200",
      red: "bg-red-50 text-red-700 ring-red-200",
      violet: "bg-violet-50 text-violet-700 ring-violet-200",
      cyan: "bg-brand-100 text-brand-800 ring-brand-200",
      brand: "bg-brand-600 text-white ring-brand-600",
      outline: "bg-white text-ink ring-slate-300",
    },
  },
  defaultVariants: { tone: "slate" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}
