# UI conventions (Next.js App Router)

- Pages live under `src/app/(app)/<area>/` (authenticated shell). Server components by default.
- Auth: `const actor = await requireActor()` from `@/lib/session` at the top of every page and action. RBAC helpers in `@/lib/rbac` (`leadScope`, `hasRole`, `isStageLeader`, `canEditLead`, `leaderTeams`, `canManageRedFlags`).
- Mutations: a sibling `actions.ts` with `"use server"`. Each action has signature `(prev: ActionState, fd: FormData) => Promise<ActionState>` and wraps its body in `run(async () => { ...; revalidatePath(...); return "Success message"; })` from `@/lib/action` (helpers `str`, `num`, `bool`, `list`, `ids` read FormData). `run` turns `GateError`/`ValidationError`/`ForbiddenError` into inline messages.
- Forms: `<ActionForm action={x}>` + `<Submit>` from `@/components/action-form` (client). Inputs from `@/components/ui` (`Input`, `Select`, `Textarea`, `Field`, `Checkbox`). Hidden inputs carry ids.
- Layout primitives in `@/components/ui`: `PageHeader`, `Card`, `Table` + `Td`, `Badge`, `StageBadge`, `Stat`, `Progress`, `Pagination`, `Empty`, `Dl`, `LinkButton`, `humanize`.
- **Never** set `candidate.stage` directly — always call `transitionLead` or a domain service in `src/server/**`.
- Dates: display with `formatDate` / `formatDateTime` (IST, DD-MM-YYYY) from `@/lib/dates`; parse `<input type="datetime-local">` with `fromIstInputValue`, fill with `toIstInputValue`. Money: `formatLakhs`.
- Contact details are encrypted: use `decryptCandidate(c)` from `@/server/candidates/service` to show mobile/email, and `maskMobile` for lists. Call `logPiiView(actor, id)` when a page shows full contact details.
- Server-side pagination for lists (`take`/`skip`, `?page=`), filters via `searchParams` (a `Promise` in Next 15 — `await` it).
- Mobile friendly: stack with `grid gap-4 lg:grid-cols-3`, tables scroll horizontally (the `Table` component does this).
- Reference implementation: `src/app/(app)/tasks/`.
