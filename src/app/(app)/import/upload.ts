import "server-only";
import type { LeadSource, MainCategory } from "@contracts";
import { ValidationError } from "@/lib/errors";
import { storage } from "@/server/storage";
import { parseSpreadsheet } from "@/server/import/parse";
import { autoMap, type ColumnMapping } from "@/server/import/pipeline";
import { PRESETS, norm } from "@contracts/shared/import-presets";
import { CV_REGISTER_FIELDS, LEAD_SOURCES, MAIN_CATEGORIES } from "@contracts/shared/fields";

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const ALLOWED_EXT = [".xlsx", ".csv"];

/** Target fields offered in the column-mapping selects. */
export const TARGET_FIELDS: { value: string; label: string }[] = [
  ...CV_REGISTER_FIELDS.filter((f) => f.importable).map((f) => ({ value: f.key, label: f.label })),
  { value: "firstName", label: "First name (joined with last name)" },
  { value: "lastName", label: "Last name (joined with first name)" },
];
export const TARGET_KEYS = new Set(TARGET_FIELDS.map((f) => f.value));

export function isImportKey(key: string | undefined): key is string {
  return !!key && key.startsWith("imports/") && !key.includes("..") && !key.includes("\\");
}

/** Load an uploaded spreadsheet from storage and parse it. */
export async function loadUpload(fileKey: string | undefined, fileName: string | undefined) {
  if (!isImportKey(fileKey)) throw new ValidationError("Upload not found — please upload the file again");
  let buf: Buffer;
  try {
    buf = await storage.get(fileKey);
  } catch {
    throw new ValidationError("Upload not found — please upload the file again");
  }
  return parseSpreadsheet(fileName || fileKey, buf);
}

/** Keep only fields the wizard knows about (drops e.g. readonly candidateCode). */
export function cleanMapping(m: ColumnMapping): ColumnMapping {
  return Object.fromEntries(Object.entries(m).map(([h, f]) => [h, TARGET_KEYS.has(f) ? f : ""]));
}

/** Apply a saved mapping (keys = source headers, matched case/space-insensitively). */
export function applySavedMapping(headers: string[], saved: Record<string, string>): ColumnMapping {
  const entries = Object.entries(saved);
  return cleanMapping(Object.fromEntries(headers.map((h) => [h, saved[h] ?? entries.find(([k]) => norm(k) === norm(h))?.[1] ?? ""])));
}

export function suggestMapping(headers: string[], presetName: string | undefined, saved: Record<string, string> | null): ColumnMapping {
  if (saved) return applySavedMapping(headers, saved);
  return cleanMapping(autoMap(headers, presetName && PRESETS[presetName] ? presetName : undefined));
}

export const parseSourceParam = (s: string | undefined): LeadSource =>
  s && (LEAD_SOURCES as readonly string[]).includes(s) ? (s as LeadSource) : "OTHER";
export const parseCategoryParam = (s: string | undefined): MainCategory | undefined =>
  s && (MAIN_CATEGORIES as readonly string[]).includes(s) ? (s as MainCategory) : undefined;

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
