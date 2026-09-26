import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * shadcn-style Button, styled to the Nextenti brand. Legacy variant names
 * (primary, danger, success, md) are kept alongside shadcn's (default, destructive, outline, link).
 * Note: "secondary" is the white bordered button here (legacy look), same as "outline".
 * Class names are the exact utilities the app used before shadcn (bg-brand-600 = --primary, etc.) so
 * existing pages render identically; the semantic tokens (bg-primary, border-input…) resolve to the same colours.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-600 text-white hover:bg-brand-700 border-transparent",
        default: "bg-brand-600 text-white hover:bg-brand-700 border-transparent",
        secondary: "bg-white text-ink hover:bg-slate-50 hover:border-brand-300 border-slate-300",
        outline: "bg-white text-ink hover:bg-slate-50 hover:border-brand-300 border-slate-300",
        danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
        destructive: "bg-red-600 text-white hover:bg-red-700 border-transparent",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent",
        link: "border-transparent bg-transparent text-brand-600 shadow-none underline-offset-4 hover:underline",
      },
      size: {
        md: "px-4 py-2.5 text-sm",
        default: "px-4 py-2.5 text-sm",
        sm: "px-2.5 py-1 text-xs",
        lg: "px-5 py-3 text-base",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  // A native button inside a form submits by default; make submitting explicit (type="submit").
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} type={asChild ? type : (type ?? "button")} {...props} />;
}
