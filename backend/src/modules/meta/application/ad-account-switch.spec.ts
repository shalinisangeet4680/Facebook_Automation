import { datasetBelongs, datasetFor } from "./meta-connection.service";

const dataset = (
  externalId: string,
  adAccountIds: string[] | undefined,
  isPrimary = false,
) => ({
  kind: "dataset" as const,
  externalId,
  isPrimary,
  data: adAccountIds ? { adAccountIds } : {},
});

describe("switching ad accounts", () => {
  it("keeps a dataset shared with the new ad account", () => {
    expect(
      datasetFor([dataset("d1", ["act_1", "act_2"], true)], "act_2"),
    ).toEqual({ action: "keep" });
  });

  it("moves to the only dataset of the new ad account", () => {
    expect(
      datasetFor(
        [dataset("d1", ["act_1"], true), dataset("d2", ["act_2"])],
        "act_2",
      ),
    ).toEqual({ action: "select", datasetId: "d2" });
  });

  it("asks to re-pick when several or none fit", () => {
    expect(
      datasetFor(
        [
          dataset("d1", ["act_1"], true),
          dataset("d2", ["act_2"]),
          dataset("d3", ["act_2"]),
        ],
        "act_2",
      ),
    ).toEqual({ action: "clear" });
    expect(datasetFor([dataset("d1", ["act_1"], true)], "act_2")).toEqual({
      action: "clear",
    });
    expect(datasetFor([dataset("d1", ["act_1"])], "act_2")).toEqual({
      action: "keep",
    });
  });

  it("trusts datasets discovered before ad accounts were recorded", () => {
    expect(datasetBelongs(dataset("d1", undefined), "act_9")).toBe(true);
    expect(datasetBelongs({ data: { adAccountId: "act_1" } }, "act_9")).toBe(
      false,
    );
  });
});
