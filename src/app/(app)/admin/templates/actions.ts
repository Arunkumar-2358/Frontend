"use server";

import { revalidatePath } from "next/cache";
import type { Channel } from "@contracts";
import { prisma } from "@/lib/db";
import { audit, diffFields } from "@/lib/audit";
import { bool, run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { adminActor } from "../guard";

const CHANNELS: Channel[] = ["WHATSAPP", "SMS", "EMAIL"];

export async function saveTemplateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = str(fd, "id");
    const key = str(fd, "key");
    const name = str(fd, "name");
    const channel = str(fd, "channel") as Channel | undefined;
    const body = str(fd, "body");
    if (!key || !/^[a-z0-9_]+$/.test(key)) throw new ValidationError("Key must be lower-case letters, digits and underscores");
    if (!name) throw new ValidationError("Name is required");
    if (!channel || !CHANNELS.includes(channel)) throw new ValidationError("Choose a channel");
    if (!body) throw new ValidationError("Body is required");
    const data = { key, name, channel, subject: channel === "EMAIL" ? (str(fd, "subject") ?? null) : null, body, active: bool(fd, "active") };
    const clash = await prisma.messageTemplate.findUnique({ where: { key } });
    if (clash && clash.id !== id) throw new ValidationError(`Another template already uses the key "${key}"`);
    if (id) {
      const before = await prisma.messageTemplate.findUniqueOrThrow({ where: { id } });
      await prisma.messageTemplate.update({ where: { id }, data });
      const diff = diffFields(before as unknown as Record<string, unknown>, data);
      if (Object.keys(diff).length) await audit(actor, "SETTING_CHANGE", "message_template", id, diff);
    } else {
      const t = await prisma.messageTemplate.create({ data });
      await audit(actor, "CREATE", "message_template", t.id, data);
    }
    revalidatePath("/admin/templates");
    return id ? "Template saved" : "Template created";
  });
}
