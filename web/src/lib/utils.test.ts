import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps custom font sizes next to colour utilities", () => {
    expect(cn("text-caption", "text-muted")).toBe("text-caption text-muted");
  });

  it("still resolves conflicts within the same group", () => {
    expect(cn("text-small", "text-caption")).toBe("text-caption");
    expect(cn("text-muted", "text-danger")).toBe("text-danger");
  });
});
