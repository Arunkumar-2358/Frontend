import { redirect } from "next/navigation";
import { ShieldCheck, Users, BarChart3 } from "lucide-react";
import { login, currentActor } from "@/lib/session";
import { Input, Field, Button } from "@/components/ui";
import { FullLogo } from "@/components/brand";

export const metadata = { title: "Sign in" };

async function signIn(fd: FormData) {
  "use server";
  const err = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  const next = String(fd.get("next") ?? "/dashboard");
  if (err) redirect(`/login?error=${err}&next=${encodeURIComponent(next)}`);
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await currentActor()) redirect("/dashboard");
  const sp = await searchParams;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="brand-panel relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#01637e]/60" />
        <div className="absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-[#053f51]/70" />
        <div className="relative">
          <div className="text-sm font-semibold tracking-[0.2em] text-[#dcebf0] uppercase">Nextenti Recruit CRM</div>
          <h2 className="mt-4 max-w-md text-4xl leading-tight font-semibold">Healthcare talent, from data dump to 30-day retention.</h2>
          <p className="mt-4 max-w-md text-[#dcebf0]">Doctors, nurses, pharmacy, allied health and executive search — one life cycle, every gate tracked.</p>
        </div>
        <ul className="relative space-y-4 text-[#eef6f8]">
          <li className="flex items-center gap-3"><Users size={20} /> 9-stage lead life cycle with team sign-offs</li>
          <li className="flex items-center gap-3"><BarChart3 size={20} /> Weekly and monthly KPIs for every team and agent</li>
          <li className="flex items-center gap-3"><ShieldCheck size={20} /> Encrypted contact details and DPDP consent</li>
        </ul>
      </div>
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="inline-block rounded-xl dark:bg-white dark:px-4 dark:py-3">
            <FullLogo className="w-64" />
          </div>
          <h1 className="mt-8 text-2xl font-semibold text-ink">Sign in to <span className="text-brand-600">Recruit CRM</span></h1>
          <p className="mt-1 text-sm text-slate-500">Use your Nextenti work account.</p>
          <form action={signIn} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
            <Field label="Work email">
              <Input name="email" type="email" autoComplete="username" required placeholder="you@nextenti.ai" />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            {sp.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-accent">{sp.error === "rate" ? "Too many sign-in attempts. Wait a minute and try again." : "Invalid email or password."}</p>}
            <Button className="w-full" type="submit">Sign in</Button>
          </form>
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-8 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Dev accounts: <code>&lt;firstname&gt;@nextenti.ai</code> (greeshma, jennifer, bhavani, dixha, harsha, sumitha, admin…) · password <code>Nextenti@123</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
