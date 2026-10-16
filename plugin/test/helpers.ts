import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

export const product = {
  name: "Acme",
  wordmark: ["Ac", "me"],
  tagline: "Run your shop from your phone",
  colors: { accent: "#4CC46A", bg: "#1B2536" },
  screens: { home: { statusBar: { bg: "#1f2f3f", dark: true } } },
};

export const cards = [
  {
    file: "01_home",
    screen: "home",
    headline: {
      en: ["Your shop,", "at a glance"],
      hi: ["Aapki dukaan,", "ek nazar mein"],
    },
    sub: { en: "Sales and stock in one place", hi: "Sales aur stock ek jagah" },
    callouts: [
      {
        tag: "SALES",
        tone: "green",
        x: 24,
        y: 640,
        text: { en: ["Today's sales"], hi: ["Aaj ki sales"] },
      },
    ],
  },
  {
    file: "02_orders",
    screen: "orders",
    headline: { en: ["Orders", "in one tap"] },
    callouts: [],
  },
];

export async function screenshot(file: string, width = 1080, height = 2400) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp({
    create: { width, height, channels: 3, background: "#e8eef5" },
  })
    .composite([
      {
        input: {
          create: { width, height: 300, channels: 3, background: "#2f5ba8" },
        },
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(file);
}

export async function makeProject(
  options: {
    product?: unknown;
    cards?: unknown;
    screens?: Record<string, [number, number]>;
  } = {},
) {
  const root = await mkdtemp(path.join(tmpdir(), "store-creatives-"));
  const dir = path.join(root, ".store-creatives");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "product.json"),
    JSON.stringify(options.product ?? product),
  );
  await writeFile(
    path.join(dir, "cards.json"),
    JSON.stringify(options.cards ?? cards),
  );
  const screens = options.screens ?? {
    home: [1080, 2400],
    orders: [1080, 2400],
  };
  for (const [name, [w, h]] of Object.entries(screens))
    await screenshot(path.join(dir, "screens", `${name}.png`), w, h);
  return { root, dir };
}
