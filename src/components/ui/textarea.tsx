import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

export function Textarea({ className, rows = 3, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" rows={rows} className={cn(fieldClass, className)} {...props} />;
}
