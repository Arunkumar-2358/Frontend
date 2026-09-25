"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

export async function scrutinizeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/scrutiny/{id}/scrutinize", { params: { id: String(fd.get("candidateId")) }, body: { remark: str(fd, "remark") } });
    revalidatePath("/scrutiny");
    return message;
  });
}

export async function verifyAndQualifyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/scrutiny/{id}/verify", { params: { id: String(fd.get("candidateId")) }, body: { tlRemark: str(fd, "tlRemark") } });
    revalidatePath("/scrutiny");
    revalidatePath("/availability");
    return message;
  });
}
