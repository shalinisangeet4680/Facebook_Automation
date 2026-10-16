import path from "node:path";
import { cardProps, paletteProps, plan } from "../src/jobs.js";
import { loadProject } from "../src/project.js";
import { measure } from "../src/render.js";
import { makeProject } from "./helpers.js";

const load = async () => {
  const { root } = await makeProject();
  return loadProject(root, "cards", measure);
};

describe("plan", () => {
  it("expands cards x languages x styles x sizes plus feature graphics", async () => {
    const project = await load();
    const result = plan(project, {
      outDir: "/out",
      styles: ["callouts", "bold"],
      sizes: ["phone", "tablet10"],
      feature: true,
    });
    const cards = result.jobs.filter((j) => j.composition === "StoreCard");
    expect(cards).toHaveLength((2 + 1) * 2 * 2);
    expect(
      result.jobs.filter((j) => j.composition === "FeatureGraphic"),
    ).toHaveLength(2);
    expect(result.jobs.map((j) => j.out)).toContain(
      path.join("/out", "bold", "hi", "tablet10", "01_home.png"),
    );
    const tablet = cards.find((j) => j.out.includes("tablet10"));
    expect(tablet?.scale).toBe(2);
    expect(tablet?.props).toMatchObject({ width: 1920, height: 1080 });
    expect([...result.staged.keys()].sort()).toEqual([
      "screens/home.png",
      "screens/orders.png",
    ]);
  });

  it("filters by language and card", async () => {
    const project = await load();
    const result = plan(project, {
      outDir: "/out",
      styles: ["light"],
      sizes: ["phone"],
      langs: ["en"],
      only: ["orders"],
      feature: false,
    });
    expect(result.jobs.map((j) => j.out)).toEqual([
      path.join("/out", "light", "en", "phone", "02_orders.png"),
    ]);
  });

  it("rejects languages the cards don't have", async () => {
    const project = await load();
    expect(() =>
      plan(project, {
        outDir: "/out",
        styles: ["light"],
        sizes: ["phone"],
        langs: ["fr"],
        feature: false,
      }),
    ).toThrow("Unknown language fr. The cards have: en, hi");
  });
});

describe("cardProps", () => {
  it("localizes text, keeps the screenshot ratio and the drawn status bar", async () => {
    const project = await load();
    const [home] = project.cards;
    const props = cardProps(project, home!, "hi");
    expect(props).toMatchObject({
      headline: ["Aapki dukaan,", "ek nazar mein"],
      sub: "Sales aur stock ek jagah",
      screen: "screens/home.png",
      statusBar: { bg: "#1f2f3f", dark: true },
      callouts: [{ tag: "SALES", text: ["Aaj ki sales"] }],
    });
    expect(props.screenRatio).toBeCloseTo(2400 / 1080);
  });

  it("falls back to the first language", async () => {
    const project = await load();
    const orders = project.cards[1]!;
    expect(cardProps(project, orders, "hi").headline).toEqual([
      "Orders",
      "in one tap",
    ]);
  });
});

describe("paletteProps", () => {
  it("derives the store palette from brand colours", async () => {
    const project = await load();
    expect(paletteProps(project)).toEqual({ ink: "#1B2536" });
  });
});
