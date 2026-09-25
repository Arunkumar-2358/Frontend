/**
 * Minimal service worker for the Nextenti Recruit CRM PWA.
 * - Push: shows a native OS notification, even when the app isn't open.
 * - notificationclick: focuses an existing tab on that URL, or opens one.
 * - fetch: network-first passthrough (no offline caching of app data — leads
 *   and tasks must always be fresh; caching here would risk stale/incorrect data).
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "Nextenti Recruit CRM", body: "You have a new notification.", url: "/notifications", tag: "system" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* keep the default */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || undefined,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const target = new URL(url, self.location.origin).href;
      for (const client of clientsList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "notification-click", url });
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
