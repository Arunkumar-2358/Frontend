"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { THEME_COOKIE } from "@/lib/theme";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("PUT /v1/me/profile", { body: { name: str(fd, "name") ?? "", phone: str(fd, "phone") } });
    revalidatePath("/", "layout");
    return message;
  });
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("PUT /v1/me/password", {
      body: { current: String(fd.get("current") ?? ""), next: String(fd.get("next") ?? ""), confirm: String(fd.get("confirm") ?? "") },
    });
    return message;
  });
}

export async function setThemeAction(pref: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { theme } = await api("PUT /v1/me/theme", { body: { theme: pref } });
    (await cookies()).set(THEME_COOKIE, theme, { sameSite: "lax", path: "/", maxAge: 365 * 86400 });
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
