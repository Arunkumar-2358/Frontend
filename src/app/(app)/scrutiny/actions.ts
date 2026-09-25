"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/session";
import { run, str, type ActionState } from "@/lib/action";
import { scrutinize, verifyAndQualify } from "@/server/scrutiny/service";
import { fieldLabel } from "@contracts/shared/fields";

export async function scrutinizeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const check = await scrutinize(actor, String(fd.get("candidateId")), str(fd, "remark"));
    revalidatePath("/scrutiny");
    return check.missing.length
      ? `Scrutinised — ${check.missing.length} field(s) missing (${check.missing.map(fieldLabel).join(", ")}). A "collect details" call task is open.`
      : "Scrutinised — profile complete, awaiting team leader verification";
  });
}

export async function verifyAndQualifyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    await verifyAndQualify(actor, String(fd.get("candidateId")), str(fd, "tlRemark"));
    revalidatePath("/scrutiny");
    revalidatePath("/availability");
    return "Verified — lead moved to Qualified";
  });
}
