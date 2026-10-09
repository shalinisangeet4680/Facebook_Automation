import { captionProblem, scheduleProblem } from "./post.rules";

describe("post rules", () => {
  it("requires captions within the platform limits", () => {
    expect(captionProblem("facebook", "Hello")).toBeNull();
    expect(captionProblem("instagram", " ")).toContain("Instagram caption");
    expect(captionProblem("instagram", "x".repeat(2201))).toContain("2200");
    expect(
      captionProblem(
        "instagram",
        Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" "),
      ),
    ).toContain("30 hashtags");
    expect(
      captionProblem(
        "facebook",
        Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" "),
      ),
    ).toBeNull();
  });

  it("keeps schedules between 2 minutes and 60 days ahead", () => {
    const now = Date.parse("2026-10-09T10:00:00Z");
    expect(scheduleProblem(null, now)).toBeNull();
    expect(scheduleProblem(new Date(now + 60_000), now)).toContain("2 minutes");
    expect(scheduleProblem(new Date(now + 3_600_000), now)).toBeNull();
    expect(scheduleProblem(new Date(now + 61 * 86_400_000), now)).toContain(
      "60 days",
    );
  });
});
