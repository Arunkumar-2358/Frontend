import { unstable_rethrow } from "next/navigation";
import { ApiError } from "./api/errors";

export type ActionState = { ok: boolean; message?: string; error?: string; at?: number } | null;

/**
 * Wrap a server action body: API errors (gate failures, validation,
 * permissions) become a friendly message for <ActionForm>.
 */
export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message || "Saved", at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: actionError(e), at: Date.now() };
  }
}

export function actionError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "GATE") return `Gate not met — ${(e.failures ?? []).join("; ")}`;
    if (e.code === "INTERNAL") return "Something went wrong saving that. Please try again.";
    return e.message;
  }
  if (e instanceof FormError) return e.message;
  console.error(e);
  return "Something went wrong saving that. Please try again.";
}

/** Input problems caught in the form before calling the API. */
export class FormError extends Error {}

// FormData helpers
export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === null || String(v).trim() === "" ? undefined : String(v).trim();
};
export const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const list = (fd: FormData, k: string) =>
  (str(fd, k) ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
export const ids = (fd: FormData, k: string) => fd.getAll(k).map(String).filter(Boolean);
