import { describe, expect, it } from "vitest";

import { formatIndianPhone } from "./phone-input";

describe("formatIndianPhone", () => {
  it.each([
    ["8434230999", "84342 30999"],
    ["84342", "84342"],
    ["843423", "84342 3"],
    ["843-423-0999", "84342 30999"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatIndianPhone(input)).toBe(expected);
  });
});
