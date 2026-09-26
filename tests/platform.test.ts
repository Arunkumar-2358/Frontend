import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { cn } from "@/lib/utils";
import { btnClass } from "@/components/ui";
import { scrubBreadcrumb, scrubEvent, sentryOptions, stripQuery } from "@/lib/sentry";

describe("cn()", () => {
  it("merges conditional classes with later Tailwind utilities winning", () => {
    expect(cn("px-4 py-2.5", false && "hidden", "py-1")).toBe("px-4 py-1");
    expect(cn("text-sm text-ink", "text-xs")).toBe("text-ink text-xs");
    expect(cn("bg-brand-600", { "bg-white": true })).toBe("bg-white");
  });

  it("legacy btnClass keeps its exact brand classes", () => {
    const c = btnClass("primary").split(" ");
    for (const k of ["bg-brand-600", "text-white", "hover:bg-brand-700", "px-4", "py-2.5", "text-sm", "rounded-lg"]) expect(c).toContain(k);
    expect(btnClass("secondary", "sm").split(" ")).toEqual(expect.arrayContaining(["bg-white", "border-slate-300", "px-2.5", "py-1", "text-xs"]));
  });
});

describe("Sentry scrubbing", () => {
  it("removes cookies, headers, bodies, query strings and user PII", () => {
    const e = scrubEvent({
      type: undefined,
      request: { url: "https://crm.test/leads?q=9876543210#x", query_string: "q=9876543210", cookies: { nt_session: "jwt" }, headers: { authorization: "Bearer x", cookie: "a=b" }, data: { mobile: "9876543210" } },
      user: { id: "u1", email: "a@b.c", ip_address: "1.2.3.4", username: "Asha" },
      transaction: "/leads?q=x",
      breadcrumbs: [
        { category: "fetch", data: { url: "/api/v1/leads?q=asha", method: "GET", request_body: "{}", status_code: 200 } },
        { category: "navigation", data: { from: "/a?x=1", to: "/b?y=2" } },
        { category: "console", message: "form values", data: { arguments: ["9876543210"] } },
      ],
    } as ErrorEvent);
    expect(e.request).toEqual({ url: "https://crm.test/leads" });
    expect(e.user).toEqual({ id: "u1" });
    expect(e.transaction).toBe("/leads");
    expect(e.breadcrumbs).toEqual([
      { category: "fetch", data: { url: "/api/v1/leads", method: "GET", status_code: 200 } },
      { category: "navigation", data: { from: "/a", to: "/b" } },
    ]);
  });

  it("helpers and options", () => {
    expect(stripQuery("/x?y=1")).toBe("/x");
    expect(stripQuery("/x")).toBe("/x");
    expect(scrubBreadcrumb({ category: "ui.click", message: "button" })).toEqual({ category: "ui.click", message: "button" });
    const o = sentryOptions("https://key@o0.ingest.sentry.io/0");
    expect(o.sendDefaultPii).toBe(false);
    expect(o.tracesSampleRate).toBe(0);
  });
});
