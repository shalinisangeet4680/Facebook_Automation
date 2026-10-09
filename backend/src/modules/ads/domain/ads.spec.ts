import { resultFor } from "./goals";
import { formatMoney, toMajor, toMinor } from "./money";

describe("money", () => {
  it("converts between major and minor units", () => {
    expect(toMinor(800, "INR")).toBe(80_000);
    expect(toMinor(12.345, "USD")).toBe(1235);
    expect(toMinor(1000, "JPY")).toBe(1000);
    expect(toMajor(80_000, "INR")).toBe(800);
    expect(toMajor(null, "INR")).toBeNull();
  });

  it("formats rupees", () => {
    expect(formatMoney(1500, "INR")).toBe("₹1,500");
  });
});

describe("results", () => {
  it("picks the result action for the objective", () => {
    expect(resultFor("OUTCOME_LEADS", { link_click: 40, lead: 3 })).toEqual({
      action: "lead",
      count: 3,
    });
    expect(resultFor("OUTCOME_TRAFFIC", { link_click: 40 })).toEqual({
      action: "link_click",
      count: 40,
    });
    expect(resultFor(null, { lead: 3 })).toBeNull();
  });
});
