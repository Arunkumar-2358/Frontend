import { describe, it, expect } from "vitest";
import { parseJson } from "@/lib/api/json";
import { ApiError } from "@/lib/api/errors";
import { actionError, FormError, run } from "@/lib/action";

describe("API JSON parsing", () => {
  it("revives ISO UTC timestamps into Dates and leaves other strings alone", () => {
    const v = parseJson(JSON.stringify({ at: new Date("2026-09-25T10:00:00.000Z"), day: "2026-09-25", note: "2026-09-25T10:00 call", nested: [{ due: "2026-01-01T00:00:00Z" }] }));
    expect(v.at).toBeInstanceOf(Date);
    expect(v.at.toISOString()).toBe("2026-09-25T10:00:00.000Z");
    expect(v.day).toBe("2026-09-25");
    expect(v.note).toBe("2026-09-25T10:00 call");
    expect(v.nested[0].due).toBeInstanceOf(Date);
  });
});

describe("server action error mapping", () => {
  it("renders gate failures, domain messages and hides internal errors", () => {
    expect(actionError(new ApiError(422, { code: "GATE", message: "Gate not met", failures: ["No CV", "No consent"] }))).toBe("Gate not met — No CV; No consent");
    expect(actionError(new ApiError(403, { code: "FORBIDDEN", message: "Only leaders can do that" }))).toBe("Only leaders can do that");
    expect(actionError(new ApiError(500, { code: "INTERNAL", message: "db exploded" }))).toBe("Something went wrong saving that. Please try again.");
    expect(actionError(new FormError("Pick a date"))).toBe("Pick a date");
  });

  it("run() returns ok state with the handler's message", async () => {
    const s = await run(async () => "Saved lead");
    expect(s).toMatchObject({ ok: true, message: "Saved lead" });
    const f = await run(async () => {
      throw new ApiError(422, { code: "VALIDATION", message: "Mobile must be 10 digits" });
    });
    expect(f).toMatchObject({ ok: false, error: "Mobile must be 10 digits" });
  });
});
