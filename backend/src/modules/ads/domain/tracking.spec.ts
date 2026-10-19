import { buildTrackingReport, goalFit, TrackingInput } from "./tracking";

const now = new Date("2026-10-19T10:00:00Z");

const input = (overrides: Partial<TrackingInput> = {}): TrackingInput => ({
  dataset: {
    id: "2519233968487265",
    name: "Website",
    lastFiredTime: "2026-10-19T09:55:00Z",
  },
  businessId: "1101",
  last24Hours: [
    { event: "PageView", count: 400 },
    { event: "Lead", count: 6 },
  ],
  last7Days: [
    { event: "PageView", count: 2800 },
    { event: "Lead", count: 41 },
    { event: "Contact", count: 3 },
  ],
  now,
  ...overrides,
});

const fit = (report: ReturnType<typeof buildTrackingReport>, goal: string) =>
  report.goals.find((g) => g.goal === goal)!;

describe("buildTrackingReport", () => {
  it("is healthy when events and conversions arrive", () => {
    const report = buildTrackingReport(input());
    expect(report.status).toBe("healthy");
    expect(report.reasons).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.totals).toEqual({ last24Hours: 406, last7Days: 2844 });
    expect(report.events[0]).toEqual({
      event: "PageView",
      last24Hours: 400,
      last7Days: 2800,
    });
    expect(report.eventsManagerUrl).toBe(
      "https://business.facebook.com/events_manager2/list/pixel/2519233968487265/overview?business_id=1101",
    );
  });

  it("is missing when no dataset is selected", () => {
    const report = buildTrackingReport(input({ dataset: null }));
    expect(report.selected).toBe(false);
    expect(report.status).toBe("missing");
    expect(report.pixel).toBeNull();
    expect(report.fixes[0]).toContain("Choose one in Meta account");
    expect(report.events).toEqual([]);
    expect(fit(report, "leads").ready).toBe(false);
    expect(fit(report, "traffic").ready).toBe(true);
  });

  it("is missing when the Pixel sent nothing in 7 days", () => {
    const report = buildTrackingReport(
      input({
        last24Hours: [],
        last7Days: [],
        dataset: {
          id: "1",
          name: "Old",
          lastFiredTime: "2026-10-01T10:00:00Z",
        },
      }),
    );
    expect(report.status).toBe("missing");
    expect(report.reasons[0]).toContain("18 days ago");
  });

  it("warns when nothing arrived in 24 hours", () => {
    const report = buildTrackingReport(input({ last24Hours: [] }));
    expect(report.status).toBe("warning");
    expect(report.reasons).toEqual([
      "The Pixel hasn't received any events in the last 24 hours.",
    ]);
  });

  it("warns when there are no conversion events", () => {
    const report = buildTrackingReport(
      input({
        last24Hours: [{ event: "PageView", count: 10 }],
        last7Days: [{ event: "PageView", count: 70 }],
      }),
    );
    expect(report.status).toBe("warning");
    expect(report.reasons[0]).toContain("No conversion events");
    expect(fit(report, "leads")).toMatchObject({
      ready: false,
      message:
        "No Lead, CompleteRegistration or Contact events in the last 7 days.",
    });
    expect(fit(report, "leads").fix).toContain("thank-you page");
  });
});

describe("goalFit", () => {
  const week = [
    { event: "PageView", count: 100 },
    { event: "CompleteRegistration", count: 2 },
  ];

  it("needs nothing for traffic and awareness", () => {
    expect(goalFit("traffic", false, []).ready).toBe(true);
    expect(goalFit("awareness", false, []).ready).toBe(true);
  });

  it("accepts any lead-type event for leads", () => {
    expect(goalFit("leads", true, week)).toMatchObject({
      ready: true,
      fix: null,
    });
  });

  it("needs Purchase for sales", () => {
    const result = goalFit("sales", true, week);
    expect(result.ready).toBe(false);
    expect(result.message).toBe("No Purchase events in the last 7 days.");
    expect(
      goalFit("sales", true, [{ event: "Purchase", count: 1 }]).ready,
    ).toBe(true);
  });

  it("asks to choose a dataset when none is selected", () => {
    expect(goalFit("sales", false, []).fix).toContain("Choose one");
  });
});
