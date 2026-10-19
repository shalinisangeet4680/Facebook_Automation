import { pickWinner } from "./variants";

const v = (
  id: string,
  spend: number,
  results: number,
  impressions = 5000,
  linkClicks = 50,
) => ({ id, spend, results, impressions, linkClicks });

describe("pickWinner", () => {
  it("picks the lowest cost per result among versions with enough results", () => {
    expect(
      pickWinner([v("a", 1000, 10), v("b", 1000, 5), v("c", 1000, 20)]),
    ).toEqual({ winnerId: "c", basis: "cost_per_result", note: null });
  });

  it("ignores cheap versions that haven't reached the minimum yet", () => {
    const pick = pickWinner([v("a", 1000, 5), v("b", 100, 4)]);
    expect(pick).toMatchObject({ winnerId: "a", basis: "cost_per_result" });
    expect(pick.note).toContain("fewer than 5 results");
  });

  it("falls back to the highest click-through rate without enough results", () => {
    const pick = pickWinner([
      v("a", 300, 1, 4000, 40),
      v("b", 300, 2, 4000, 90),
    ]);
    expect(pick).toMatchObject({ winnerId: "b", basis: "ctr" });
    expect(pick.note).toContain("No version has 5 results yet");
  });

  it("says when there isn't enough data yet", () => {
    expect(pickWinner([v("a", 10, 0, 300, 2), v("b", 10, 0, 200, 1)])).toEqual({
      winnerId: null,
      basis: null,
      note: "Not enough data yet. Give the versions a few days and some budget.",
    });
  });

  it("does not compare a single ad", () => {
    expect(pickWinner([v("a", 1000, 10)]).winnerId).toBeNull();
  });

  it("honours a custom minimum", () => {
    expect(pickWinner([v("a", 100, 2), v("b", 100, 3)], 2).winnerId).toBe("b");
  });
});
