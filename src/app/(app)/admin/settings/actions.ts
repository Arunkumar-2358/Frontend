"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_SETTINGS, getAllSettings, setSetting, type SettingKey, type Settings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { adminActor } from "../guard";
import { MANDATORY_CHOICES, SETTING_META } from "./meta";

function parseNumber(v: string | undefined, label: string) {
  if (v === undefined) throw new ValidationError(`${label} is required`);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${label} must be a non-negative number`);
  return n;
}

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const current = await getAllSettings();
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
      const def = DEFAULT_SETTINGS[key] as unknown;
      const label = SETTING_META[key]?.label ?? key;
      if (key === "mandatorySopFields") {
        const picked = fd.getAll(key).map(String).filter((k) => MANDATORY_CHOICES.some((c) => c.key === k));
        if (!picked.length) throw new ValidationError("Pick at least one mandatory SOP field");
        next[key] = picked;
      } else if (Array.isArray(def)) {
        const parts = (str(fd, key) ?? "").split(/[,\s]+/).filter(Boolean);
        next[key] = parts.map((p) => parseNumber(p, label));
        if (!parts.length) throw new ValidationError(`${label}: enter at least one value`);
      } else if (typeof def === "number") {
        next[key] = parseNumber(str(fd, key), label);
      } else if (typeof def === "string") {
        const v = str(fd, key);
        if (!v) throw new ValidationError(`${label} is required`);
        next[key] = v;
      } else if (def && typeof def === "object") {
        const obj: Record<string, number> = {};
        const cur = (current[key] ?? def) as Record<string, number>;
        for (const sub of new Set([...Object.keys(def as object), ...Object.keys(cur)])) obj[sub] = parseNumber(str(fd, `${key}.${sub}`), `${label} – ${sub}`);
        next[key] = obj;
      }
    }
    if (typeof next.enrolmentLinkTemplate === "string" && !next.enrolmentLinkTemplate.includes("{{code}}")) throw new ValidationError("The enrolment link template must contain {{code}}");
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(next)) {
      if (JSON.stringify(current[k as SettingKey]) === JSON.stringify(v)) continue;
      diff[k] = { from: current[k as SettingKey], to: v };
      await setSetting(k as SettingKey, v as Settings[SettingKey]);
    }
    if (!Object.keys(diff).length) return "No changes";
    await audit(actor, "SETTING_CHANGE", "app_setting", Object.keys(diff).join(","), diff);
    revalidatePath("/admin/settings");
    return `Saved ${Object.keys(diff).length} setting${Object.keys(diff).length === 1 ? "" : "s"}`;
  });
}
