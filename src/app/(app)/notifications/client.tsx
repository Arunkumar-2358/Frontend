"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { btnClass } from "@/components/ui";
import { markAllReadAction, markReadAction } from "./actions";

export function MarkAllButton() {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => markAllReadAction())} className={btnClass("secondary")}>
      <CheckCheck size={16} /> Mark all read
    </button>
  );
}

export function OpenNotification({ id, link, read }: { id: string; link?: string; read: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!read) await markReadAction(id);
          if (link) router.push(link);
        })
      }
      className={btnClass(link ? "primary" : "ghost", "sm")}
    >
      {link ? "Open" : "Mark read"}
    </button>
  );
}
