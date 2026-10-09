import { uuidv7 } from "./uuid";

describe("uuidv7", () => {
  it("produces RFC 9562 version 7 UUIDs", () => {
    const id = uuidv7();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("encodes the current time so ids sort by creation", () => {
    const before = Date.now();
    const id = uuidv7();
    const ms = parseInt(id.replace(/-/g, "").slice(0, 12), 16);
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(Date.now());
  });

  it("is unique across many calls", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7()));
    expect(ids.size).toBe(10_000);
  });
});
