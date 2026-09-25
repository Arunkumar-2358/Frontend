"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { btnClass } from "@/components/ui";

const MAX_VIDEO_SECONDS = 65; // "1-minute" intro, with a little slack

function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

/** Upload a resume or intro video to the API (/api/v1/leads/[id]/files), then refresh the page. */
export function FileUpload({ leadId, kind, accept, maxBytes, label, disabled }: { leadId: string; kind: "resume" | "video"; accept: string; maxBytes: number; label: string; disabled?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    if (file.size > maxBytes) {
      setMsg({ ok: false, text: `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` });
      e.target.value = "";
      return;
    }
    if (kind === "video") {
      const d = await videoDuration(file);
      if (d !== null && d > MAX_VIDEO_SECONDS) {
        setMsg({ ok: false, text: `The intro video should be about 1 minute (this one is ${Math.round(d)} s)` });
        e.target.value = "";
        return;
      }
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await fetch(`/api/v1/leads/${leadId}/files`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: { code?: string; message?: string } };
      if (!res.ok) setMsg({ ok: false, text: body.error?.message ?? "Upload failed" });
      else {
        setMsg({ ok: true, text: body.message ?? "Uploaded" });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Upload failed — check your connection" });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <label className={clsx(btnClass("secondary", "sm"), disabled || busy ? "pointer-events-none opacity-50" : "cursor-pointer")}>
        {busy ? "Uploading…" : label}
        <input ref={input} type="file" accept={accept} className="sr-only" onChange={onChange} disabled={disabled || busy} />
      </label>
      {msg && <p className={clsx("mt-1.5 text-xs", msg.ok ? "text-emerald-600" : "text-red-600")}>{msg.text}</p>}
    </div>
  );
}
