"use server";

import { revalidatePath } from "next/cache";
import type { MainCategory, Role, TeamCode } from "@contracts";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

const grantOf = (fd: FormData) => ({
  team: str(fd, "team") as TeamCode | undefined,
  role: str(fd, "role") as Role | undefined,
  category: str(fd, "category") as MainCategory | undefined,
});

export async function createUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/users", {
      body: { ...grantOf(fd), name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password"), phone: str(fd, "phone") },
    });
    revalidatePath("/admin/users");
    return message;
  });
}

export async function addGrantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/users/{id}/grants", { params: { id: String(fd.get("userId")) }, body: grantOf(fd) });
    revalidatePath("/admin/users");
    return message;
  });
}

export async function removeGrantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("DELETE /v1/admin/grants/{id}", { params: { id: String(fd.get("grantId")) } });
    revalidatePath("/admin/users");
    return message;
  });
}

export async function setActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/users/{id}/active", { params: { id: String(fd.get("userId")) }, body: { active: fd.get("active") === "true" } });
    revalidatePath("/admin/users");
    return message;
  });
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/users/{id}/password", { params: { id: String(fd.get("userId")) }, body: { password: str(fd, "password") } });
    return message;
  });
}
