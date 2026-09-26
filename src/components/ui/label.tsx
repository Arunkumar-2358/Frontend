import * as React from "react";
import { cn } from "@/lib/utils";

/** Plain <label> (no client JS) with the app's field-label style. */
export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("block text-xs font-medium text-slate-700", className)} {...props} />;
}
