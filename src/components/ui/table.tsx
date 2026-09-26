import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn-style table parts with the app's look. Wrap in a horizontal scroller for mobile. */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="overflow-x-auto">
      <table data-slot="table" className={cn("min-w-full divide-y divide-slate-200 text-sm", className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("bg-head", className)} {...props} />;
}
export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("divide-y divide-slate-100 bg-white", className)} {...props} />;
}
export function TableRow(props: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" {...props} />;
}
export const tableHeadClass = "px-4 py-3 text-left text-[13.5px] font-semibold whitespace-nowrap text-ink";
export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th data-slot="table-head" className={cn(tableHeadClass, className)} {...props} />;
}
export const tableCellClass = "px-4 py-3 align-top text-ink";
export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn(tableCellClass, className)} {...props} />;
}
