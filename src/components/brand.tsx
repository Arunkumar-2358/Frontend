import Image from "next/image";
import clsx from "clsx";

/** NT mark + "Nextenti Recruit CRM" wordmark (sidebar / headers). */
export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={clsx("flex items-center gap-3", className)}>
      <Image src="/nt-mark.png" alt="NT" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg" priority />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[17px] font-semibold tracking-tight text-ink">
            Nextenti <span className="text-brand-600">Recruit CRM</span>
          </span>
          <span className="block text-xs text-slate-500">Healthcare Talent Lifecycle</span>
        </span>
      )}
    </span>
  );
}

/** The full Nextenti logo with tagline (login, print headers). */
export function FullLogo({ className }: { className?: string }) {
  return <Image src="/nextenti-logo.png" alt="Nextenti — Work Smart Live Better" width={436} height={110} className={clsx("h-auto", className)} priority />;
}
