import { displayPhone, normalizeIndianPhone } from "./phone";

describe("normalizeIndianPhone", () => {
  it.each([
    ["8434230999", "+918434230999"],
    ["+91 84342 30999", "+918434230999"],
    ["918434230999", "+918434230999"],
    ["08434230999", "+918434230999"],
    ["84342-30999", "+918434230999"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeIndianPhone(input)).toBe(expected);
  });

  it.each(["12345", "5434230999", "84342309991", "abcdefghij", ""])(
    "rejects %s",
    (input) => {
      expect(() => normalizeIndianPhone(input)).toThrow(
        "Enter a valid 10-digit Indian mobile number.",
      );
    },
  );

  it("formats for display", () => {
    expect(displayPhone("+918434230999")).toBe("+91 84342 30999");
  });
});
