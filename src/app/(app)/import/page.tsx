import Link from "next/link";
import type { ImportMappingStep } from "@contracts";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireActor } from "@/lib/session";
import { hasRole } from "@contracts/shared/rbac";
import { formatDateTime } from "@contracts/shared/dates";
import { LEAD_SOURCES, MAIN_CATEGORIES, NON_NT_SOURCES } from "@contracts/shared/fields";
import { TARGET_FIELDS, isImportKey, parseCategoryParam, parseSourceParam } from "@contracts/shared/d-import";
import { PageHeader, Card, Table, Td, Badge, Input, Select, Field, Empty, Pagination, LinkButton, humanize, btnClass } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { runImportAction, uploadImportAction } from "./actions";

export const metadata = { title: "Data import" };

type SP = { file?: string; name?: string; source?: string; category?: string; location?: string; preset?: string; page?: string };

export default async function ImportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  if (!hasRole(actor, "data_analyst", "admin")) return <Empty title="No access">Data import (bulk upload and mapping) is for the data analyst and admin. To add a single lead from a non-NT portal, use the Outreach queue.</Empty>;
  const sp = await searchParams;
  if (sp.file) return <MappingStep sp={sp} />;

  const { batches, total, page, pageSize: PAGE_SIZE } = await api("GET /v1/imports", { query: { page: Math.max(1, Number(sp.page) || 1) } });

  return (
    <>
      <PageHeader title="Data import" subtitle="Step 1 of 2 · Upload a raw data dump (.xlsx or .csv, up to 25 MB). Rows are normalised, deduped and validated before becoming leads." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Upload a file" className="lg:col-span-1">
          <ActionForm action={uploadImportAction} className="space-y-4">
            <Field label="Spreadsheet" required hint=".xlsx or .csv · first row must be the column headers">
              <Input type="file" name="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required />
            </Field>
            <Field label="Source" required hint={`Non-NT portals: ${NON_NT_SOURCES.map(humanize).join(", ")}. A "Source" column in the file overrides this per row.`}>
              <Select name="source" options={[...LEAD_SOURCES]} defaultValue="OTHER" required />
            </Field>
            <Field label="Default category" hint="Used when a row has no category / job title">
              <Select name="category" options={[...MAIN_CATEGORIES]} placeholder="(none)" />
            </Field>
            <Field label="Default location" hint="Used when a row has no location">
              <Input name="location" placeholder="e.g. Hyderabad" />
            </Field>
            <Submit>Upload &amp; map columns →</Submit>
          </ActionForm>
        </Card>

        <Card title="Import history" pad={false} className="lg:col-span-2">
          <Table head={["Uploaded", "File", "Source", "Total", "Accepted", "Needs mapping", "Duplicates", "Invalid", ""]} empty="No imports yet.">
            {batches.map((b) => (
              <tr key={b.id}>
                <Td className="whitespace-nowrap">
                  <div>{formatDateTime(b.createdAt)}</div>
                  <div className="text-xs text-slate-400">{b.uploadedBy?.name ?? "system"}</div>
                </Td>
                <Td className="max-w-56 break-words">
                  {b.fileName}
                  {b.status !== "COMPLETED" && <Badge tone={b.status === "FAILED" ? "red" : "amber"} className="ml-1">{humanize(b.status)}</Badge>}
                </Td>
                <Td><Badge>{humanize(b.source)}</Badge></Td>
                <Td className="tabular-nums">{b.totalRows}</Td>
                <Td className="tabular-nums text-emerald-700">{b.acceptedRows}</Td>
                <Td className="tabular-nums text-amber-700">{b.needsMappingRows}</Td>
                <Td className="tabular-nums">{b.duplicateRows}</Td>
                <Td className="tabular-nums text-red-600">{b.invalidRows}</Td>
                <Td><Link href={`/import/${b.id}`} className="text-brand-600 hover:underline">Report</Link></Td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/import?page=${p}`} />
        </Card>
      </div>
    </>
  );
}

async function MappingStep({ sp }: { sp: SP }) {
  const fileKey = sp.file;
  const fileName = sp.name ?? "import.xlsx";
  const source = parseSourceParam(sp.source);
  const category = parseCategoryParam(sp.category);
  const location = sp.location ?? "";

  let step: ImportMappingStep | undefined;
  let failure = "Upload not found — please upload the file again";
  if (isImportKey(fileKey)) {
    try {
      step = await api("GET /v1/imports/uploads", { query: { file: fileKey, name: fileName, preset: sp.preset } });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      failure = e.message;
    }
  }
  if (!step) {
    return (
      <>
        <PageHeader title="Data import" />
        <Empty title="Could not open the uploaded file">
          {failure} <Link href="/import" className="text-brand-600 hover:underline">Start again</Link>
        </Empty>
      </>
    );
  }
  const { headers, rowCount, preview, samples, savedMappings, chosen } = step;
  const mapping = step.mapping;
  const sample = (i: number) => samples[i] ?? "";
  const mappedCount = mapping.filter(Boolean).length;
  const carry = { file: fileKey!, name: fileName, source, ...(category ? { category } : {}), ...(location ? { location } : {}) };

  return (
    <>
      <PageHeader
        title="Map columns"
        subtitle={
          <>
            Step 2 of 2 · <span className="font-medium text-slate-700">{fileName}</span> · {rowCount.toLocaleString("en-IN")} data rows · {headers.length} columns · source {humanize(source)}
            {category && <> · default category {humanize(category)}</>}
            {location && <> · default location {location}</>}
          </>
        }
        actions={<LinkButton href="/import">Cancel</LinkButton>}
      />

      <div className="space-y-6">
        <Card title="Preview (first 5 rows)" pad={false}>
          <Table head={headers}>
            {preview.map((r, i) => (
              <tr key={i}>
                {headers.map((_h, j) => (
                  <Td key={j} className="max-w-48 truncate whitespace-nowrap" title={r[j]}>{r[j]}</Td>
                ))}
              </tr>
            ))}
          </Table>
        </Card>

        <Card
          title="Column mapping"
          actions={
            <form method="get" action="/import" className="flex flex-wrap items-center gap-2">
              {Object.entries(carry).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <Select name="preset" defaultValue={chosen?.name ?? ""} placeholder="Auto-detect (all presets)" options={savedMappings.map((m) => ({ value: m.name, label: m.isPreset ? `${m.name} (preset)` : m.name }))} className="w-auto py-1 text-xs" />
              <button type="submit" className={btnClass("secondary", "sm")}>Apply</button>
            </form>
          }
          pad={false}
        >
          <ActionForm action={runImportAction}>
            {Object.entries(carry).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Table head={["Source column", "Sample value", "Maps to"]}>
              {headers.map((h, i) => (
                <tr key={i}>
                  <Td className="font-medium text-slate-900">{h}</Td>
                  <Td className="max-w-64 truncate text-slate-500" title={sample(i)}>{sample(i) || <span className="text-slate-300">—</span>}</Td>
                  <Td className="min-w-56">
                    <Select name={`map_${i}`} defaultValue={mapping[i] ?? ""} options={[{ value: "", label: "(ignore)" }, ...TARGET_FIELDS]} className="py-1.5" />
                  </Td>
                </tr>
              ))}
            </Table>
            <div className="flex flex-col gap-4 border-t border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between">
              <Field label="Save this mapping as…" hint="Optional — reuse it next time from the picker above" className="sm:w-80">
                <Input name="saveMappingAs" placeholder="e.g. Naukri export Sept" defaultValue={chosen && !chosen.isPreset ? chosen.name : ""} />
              </Field>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <span className="text-xs text-slate-500">{mappedCount} of {headers.length} columns mapped · Mobile and Name are required</span>
                <Submit>Run import ({rowCount.toLocaleString("en-IN")} rows)</Submit>
              </div>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
