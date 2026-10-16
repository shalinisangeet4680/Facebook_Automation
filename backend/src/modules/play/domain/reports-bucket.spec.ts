import {
  parseReportsBucket,
  reportMonth,
  reviewReportPrefix,
} from "./reports-bucket";

describe("reports bucket", () => {
  it("reads the Cloud Storage URI Play Console shows", () => {
    expect(
      parseReportsBucket("gs://pubsite_prod_8366263714187534872/reviews/"),
    ).toBe("pubsite_prod_8366263714187534872");
    expect(parseReportsBucket(" pubsite_prod_rev_0123456789 ")).toBe(
      "pubsite_prod_rev_0123456789",
    );
    expect(parseReportsBucket("gs://my-bucket/reviews")).toBeNull();
    expect(parseReportsBucket("")).toBeNull();
  });

  it("names a package's monthly review files", () => {
    expect(reviewReportPrefix("com.acme.shop")).toBe(
      "reviews/reviews_com.acme.shop_",
    );
    expect(reportMonth("reviews/reviews_com.acme.shop_202609.csv")).toBe(
      "202609",
    );
    expect(reportMonth("reviews/notes.txt")).toBeNull();
  });
});
