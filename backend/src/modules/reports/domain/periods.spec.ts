import { daysBetween, periodsFor, todayIn } from "./periods";

describe("report periods", () => {
  it("compares the last 7 days with the 7 before", () => {
    expect(periodsFor("last_7d", "2026-10-09")).toEqual({
      current: { since: "2026-10-02", until: "2026-10-08" },
      previous: { since: "2026-09-25", until: "2026-10-01" },
    });
  });

  it("compares this month to date with the same days last month", () => {
    expect(periodsFor("this_month", "2026-10-09")).toEqual({
      current: { since: "2026-10-01", until: "2026-10-09" },
      previous: { since: "2026-09-01", until: "2026-09-09" },
    });
    expect(periodsFor("this_month", "2026-03-31").previous).toEqual({
      since: "2026-02-01",
      until: "2026-02-28",
    });
  });

  it("compares last month with the month before", () => {
    expect(periodsFor("last_month", "2026-01-15")).toEqual({
      current: { since: "2025-12-01", until: "2025-12-31" },
      previous: { since: "2025-11-01", until: "2025-11-30" },
    });
  });

  it("lists every day and uses the account time zone", () => {
    expect(daysBetween({ since: "2026-02-27", until: "2026-03-02" })).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
    expect(todayIn("Asia/Kolkata", new Date("2026-10-08T20:00:00Z"))).toBe(
      "2026-10-09",
    );
  });
});
