import { describe, it, expect } from "vitest";
import type { Role } from "@contracts";
import { navFor, canAccessPath } from "@contracts/shared/access";

const menu = (roles: Role[]) => navFor(roles).map((n) => n.href);

describe("role menus and route gating", () => {
  it("each role sees only its menu", () => {
    expect(menu(["telecaller"])).toEqual(["/dashboard", "/tasks", "/notifications", "/leads", "/queue", "/missed-calls", "/kpi", "/profile"]);
    expect(menu(["ta_lead"])).toEqual(["/dashboard", "/tasks", "/notifications", "/leads", "/queue", "/vacancies", "/kpi", "/profile"]);
    expect(menu(["data_analyst"])).toEqual(["/dashboard", "/tasks", "/notifications", "/leads", "/import", "/kpi", "/profile"]);
    expect(menu(["sourcer"])).toEqual(["/dashboard", "/tasks", "/notifications", "/leads", "/scrutiny", "/availability", "/engagement", "/cold-calls", "/vacancies", "/kpi", "/profile"]);
    expect(menu(["recruiter"])).toEqual(["/dashboard", "/tasks", "/notifications", "/leads", "/engagement", "/vacancies", "/allocation", "/recruitment", "/evaluations", "/kpi", "/profile"]);
    expect(menu(["team3_leader"])).toContain("/allocation");
    expect(menu(["team2_leader"])).toContain("/allocation");
    expect(menu(["ta_coordinator"])).toEqual(["/dashboard", "/tasks", "/notifications", "/leads", "/vacancies", "/red-flags", "/kpi", "/profile"]);
    expect(menu(["admin"])).toContain("/admin");
    expect(menu(["team2_leader"])).toContain("/red-flags");
  });

  it("route gating matches the menu", () => {
    expect(canAccessPath("/import", ["telecaller"])).toBe(false);
    expect(canAccessPath("/import/abc", ["data_analyst"])).toBe(true);
    expect(canAccessPath("/admin/users", ["team1_leader"])).toBe(false);
    expect(canAccessPath("/admin/users", ["admin"])).toBe(true);
    expect(canAccessPath("/leads/xyz", ["recruiter"])).toBe(true);
    expect(canAccessPath("/allocation", ["sourcer"])).toBe(false);
    expect(canAccessPath("/engagement", ["ta_lead"])).toBe(false);
    expect(canAccessPath("/cold-calls", ["recruiter"])).toBe(false);
    expect(canAccessPath("/kpi/daily", ["telecaller"])).toBe(true);
  });
});
