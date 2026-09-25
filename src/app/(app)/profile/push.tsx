"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BellRing, BellOff, Smartphone } from "lucide-react";

type Status = "unsupported" | "denied" | "off" | "on" | "checking";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Lets this specific browser/device opt in to push notifications (separate from the Notification kind you receive). */
export function PushToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Push is not configured on this server");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const json = sub.toJSON();
      const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save subscription");
      setStatus("on");
      setMsg("Notifications enabled on this device.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setStatus("off");
      setMsg("Notifications turned off on this device.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;

  return (
    <div className="flex items-start gap-3">
      <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", status === "on" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
        {status === "on" ? <BellRing size={18} /> : <BellOff size={18} />}
      </span>
      <div className="flex-1">
        {status === "unsupported" && <p className="text-sm text-slate-500">This browser doesn&apos;t support push notifications. On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then try again from there.</p>}
        {status === "denied" && <p className="text-sm text-slate-500">Notifications are blocked for this site in your browser settings. Allow them there, then reload this page.</p>}
        {(status === "off" || status === "on") && (
          <>
            <p className="text-sm text-ink">
              {status === "on" ? "Push notifications are on for this device." : "Get a phone notification for new tasks, assignments and alerts — even when the app isn't open."}
            </p>
            <button
              onClick={status === "on" ? disable : enable}
              disabled={busy}
              className={clsx("mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50", status === "on" ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-transparent bg-brand-600 text-white hover:bg-brand-700")}
            >
              <Smartphone size={15} />
              {busy ? "Working…" : status === "on" ? "Turn off on this device" : "Enable on this device"}
            </button>
          </>
        )}
        {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
      </div>
    </div>
  );
}
