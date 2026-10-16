import { writeFile } from "node:fs/promises";
import path from "node:path";
import { inspect, loadProject, projectLanguages } from "../src/project.js";
import { measure } from "../src/render.js";
import { checkProject } from "../src/studio.js";
import { cards, makeProject } from "./helpers.js";

describe("loadProject", () => {
  it("loads product, cards and measured screenshots", async () => {
    const { root } = await makeProject();
    const project = await loadProject(root, "cards", measure);
    expect(project.product.name).toBe("Acme");
    expect(project.product.store).toBe("Google Play");
    expect(project.cards).toHaveLength(2);
    expect(project.screens.get("home")).toMatchObject({
      width: 1080,
      height: 2400,
    });
    expect(projectLanguages(project)).toEqual(["en", "hi"]);
    expect(inspect(project)).toEqual([]);
  });

  it("explains a missing project folder", async () => {
    const result = await checkProject("/definitely/not/here");
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain("does not exist");
  });

  it("reports schema problems with their path", async () => {
    const { root } = await makeProject({
      product: { name: "Acme", colors: { accent: "green" } },
    });
    const result = await checkProject(root);
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain(
      "product.json: colors.accent: must be a hex colour",
    );
  });

  it("reports invalid JSON", async () => {
    const { root, dir } = await makeProject();
    await writeFile(path.join(dir, "cards.json"), "{ nope");
    const result = await checkProject(root);
    expect(result.problems[0]).toBe("cards.json is not valid JSON");
  });
});

describe("inspect", () => {
  it("finds missing and landscape screenshots", async () => {
    const { root } = await makeProject({ screens: { home: [2400, 1080] } });
    const project = await loadProject(root, "cards", measure);
    const problems = inspect(project);
    expect(problems).toContain(
      'Screen "home" is landscape (2400x1080); use a portrait phone screenshot',
    );
    expect(
      problems.some((p) => p.includes('no screenshot named "orders"')),
    ).toBe(true);
  });

  it("finds untranslated callouts and callouts off the edge", async () => {
    const [first] = cards;
    const { root } = await makeProject({
      cards: [
        {
          ...first,
          callouts: [
            {
              tag: "X",
              tone: "red",
              x: 900,
              y: 10,
              text: { en: ["Only English"] },
            },
          ],
        },
      ],
    });
    const project = await loadProject(root, "cards", measure);
    const problems = inspect(project);
    expect(problems).toContain('Card "01_home" callout 1 has no text for hi');
    expect(problems).toContain(
      'Card "01_home" callout 1 runs off the right edge (x + width > 1080)',
    );
  });

  it("limits checks to the given cards", async () => {
    const { root } = await makeProject({ screens: { home: [1080, 2400] } });
    const project = await loadProject(root, "cards", measure);
    expect(inspect(project, project.cards.slice(0, 1))).toEqual([]);
  });
});
