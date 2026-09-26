# UI conventions (Next.js App Router)

- Pages live under `src/app/(app)/<area>/` (authenticated shell). Server components by default.
- Auth: `const actor = await requireActor()` from `@/lib/session` at the top of every page and action. Token refresh happens only in `src/middleware.ts` — never try to refresh or set session cookies from a page (see README "Auth flow"). RBAC helpers in `@/lib/rbac` (`leadScope`, `hasRole`, `isStageLeader`, `canEditLead`, `leaderTeams`, `canManageRedFlags`).
- Mutations: a sibling `actions.ts` with `"use server"`. Each action has signature `(prev: ActionState, fd: FormData) => Promise<ActionState>` and wraps its body in `run(async () => { ...; revalidatePath(...); return "Success message"; })` from `@/lib/action` (helpers `str`, `num`, `bool`, `list`, `ids` read FormData). `run` turns `GateError`/`ValidationError`/`ForbiddenError` into inline messages.
- Forms: `<ActionForm action={x}>` + `<Submit>` from `@/components/action-form` (client). Inputs from `@/components/ui` (`Input`, `Select`, `Textarea`, `Field`, `Checkbox`). Hidden inputs carry ids.
- Layout primitives in `@/components/ui`: `PageHeader`, `Card`, `Table` + `Td`, `Badge`, `StageBadge`, `Stat`, `Progress`, `Pagination`, `Empty`, `Dl`, `LinkButton`, `humanize`.
- **Never** set `candidate.stage` directly — always call `transitionLead` or a domain service in `src/server/**`.
- Dates: display with `formatDate` / `formatDateTime` (IST, DD-MM-YYYY) from `@/lib/dates`; parse `<input type="datetime-local">` with `fromIstInputValue`, fill with `toIstInputValue`. Money: `formatLakhs`.
- Contact details are encrypted: use `decryptCandidate(c)` from `@/server/candidates/service` to show mobile/email, and `maskMobile` for lists. Call `logPiiView(actor, id)` when a page shows full contact details.
- Server-side pagination for lists (`take`/`skip`, `?page=`), filters via `searchParams` (a `Promise` in Next 15 — `await` it).
- Mobile friendly: stack with `grid gap-4 lg:grid-cols-3`, tables scroll horizontally (the `Table` component does this).
- Reference implementation: `src/app/(app)/tasks/`.

## shadcn/ui primitives

- Foundation per the ADR (Next.js + Tailwind + shadcn/ui): `components.json`, `cn()` in `@/lib/utils` (clsx + tailwind-merge — later utilities win), primitives in `src/components/ui/*.tsx`.
- `@/components/ui` (= `src/components/ui/index.tsx`) is still **the** import for pages: `Button`, `Input`, `Field`, `Card`, `Table`, `Badge`… with the same props as before. They take their styles from the primitives but join `className` with plain `clsx` (no tailwind-merge) so existing pages render exactly as they did. Don't switch them to `cn()` without checking call sites that pass conflicting classes (e.g. `<Input className="py-1 text-xs">`, `<Select className="w-auto">` — today the base class wins).
- New components may import primitives directly and compose with `cn()`:
  - server-safe (no client JS): `ui/button` (`Button`, `buttonVariants`, `asChild`), `ui/input`, `ui/textarea`, `ui/native-select` (a real `<select>` — use it in server-action forms), `ui/label`, `ui/card`, `ui/badge`, `ui/table`, `ui/separator`, `ui/skeleton`.
  - client (Radix, keyboard accessible): `ui/dialog`, `ui/dropdown-menu` (used by the header notification bell), `ui/tooltip`.
- Button variants: shadcn names (`default`, `destructive`, `outline`, `ghost`, `link`) plus the app's (`primary`, `secondary`, `danger`, `success`). `secondary` is the white bordered button (= `outline`), not shadcn's grey one.
- Colour tokens: shadcn's CSS variables (`--primary`, `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--border`, `--input`, `--ring`, `--destructive`, …) are defined in `globals.css` on top of the brand palette (primary = brand teal `#01637E`) for light and `.dark`, so `bg-primary`, `text-muted-foreground`, `border-border` etc. work and follow dark mode.
- **`accent` is the brand red** (`text-accent`, `bg-accent` across the app), not shadcn's hover surface. When adding a component with `npx shadcn add …`, replace `bg-accent`/`focus:bg-accent`/`text-accent-foreground` highlights with `bg-muted` / `data-[highlighted]:bg-muted`. The CLI writes into `src/components/ui/` — don't let it overwrite `index.tsx` or an existing primitive without reviewing the diff. Animation classes (`animate-in`, `fade-in-0`, …) need `tw-animate-css`, which is not installed; drop them or add the package.
