import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

/** A real <select>: works in server-rendered forms and server actions with no client JS. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="native-select" className={cn(fieldClass, "pr-8", className)} {...props} />;
}

export function NativeSelectOption(props: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}
