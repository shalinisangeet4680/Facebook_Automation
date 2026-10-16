import {
  assetProblem,
  creativeName,
  slugify,
  statusAfterUpload,
} from "./store.rules";

const meta = (kind: string, extra: Partial<Record<string, string>> = {}) =>
  ({
    kind,
    name: "01_home",
    style: "",
    lang: "",
    size: "",
    ...extra,
  }) as Parameters<typeof assetProblem>[0];

describe("assetProblem", () => {
  it("accepts each kind with the fields it needs", () => {
    expect(assetProblem(meta("screen"))).toBeNull();
    expect(
      assetProblem(
        meta("preview", { style: "bold", lang: "en", size: "phone" }),
      ),
    ).toBeNull();
    expect(
      assetProblem(
        meta("screenshot", {
          style: "callouts",
          lang: "pt-BR",
          size: "tablet10",
        }),
      ),
    ).toBeNull();
    expect(
      assetProblem(meta("feature_graphic", { name: "feature", style: "dark" })),
    ).toBeNull();
  });

  it("rejects missing or unknown fields", () => {
    expect(assetProblem(meta("screen", { style: "bold" }))).toBe(
      "screens take only a name",
    );
    expect(
      assetProblem(
        meta("screenshot", { style: "fancy", lang: "en", size: "phone" }),
      ),
    ).toContain("style must be one of");
    expect(
      assetProblem(
        meta("screenshot", { style: "bold", lang: "en", size: "tv" }),
      ),
    ).toContain("size must be one of");
    expect(
      assetProblem(meta("preview", { style: "bold", size: "phone" })),
    ).toBe("lang is required");
    expect(assetProblem(meta("feature_graphic", { style: "light" }))).toContain(
      "feature graphics need style",
    );
    expect(assetProblem(meta("screen", { name: "../etc" }))).toContain(
      "name must be",
    );
    expect(
      assetProblem(
        meta("preview", { style: "bold", lang: "english", size: "phone" }),
      ),
    ).toContain("lang must be");
  });
});

describe("statusAfterUpload", () => {
  it("moves forward with the uploads", () => {
    expect(statusAfterUpload("draft", "screen")).toBe("draft");
    expect(statusAfterUpload("draft", "preview")).toBe("choosing");
    expect(statusAfterUpload("style_chosen", "preview")).toBe("style_chosen");
    expect(statusAfterUpload("style_chosen", "screenshot")).toBe("rendered");
    expect(statusAfterUpload("choosing", "feature_graphic")).toBe("rendered");
  });
});

describe("slugify", () => {
  it("makes a stable project key", () => {
    expect(slugify("  My Shop App (Android) ")).toBe("my-shop-app-android");
    expect(slugify("Café")).toBe("cafe");
  });
});

describe("creativeName", () => {
  it("names a screenshot after the project and its variant", () => {
    expect(
      creativeName("Acme", {
        name: "01_home",
        style: "bold",
        lang: "en",
        size: "phone",
      }),
    ).toBe("Acme · 01_home (bold, en, phone)");
  });
});
