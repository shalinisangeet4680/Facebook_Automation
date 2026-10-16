import path from "node:path";
import {
  FEATURE_STYLES,
  STYLES,
  SIZES,
  Size,
  Style,
  plan,
  selectCards,
} from "./jobs.js";
import {
  Project,
  ProjectError,
  cardLanguages,
  inspect,
  loadProject,
  projectLanguages,
} from "./project.js";
import {
  Progress,
  contactSheet,
  ensureGitignore,
  measure,
  previewPage,
  renderJobs,
} from "./render.js";

export const DEFAULT_CARDS = "cards";

const outputDir = (project: Project) =>
  path.join(project.dir, "output", project.cardsId);

const publicDir = (project: Project) =>
  path.join(project.dir, ".cache", "public");

export function listStyles() {
  return {
    styles: Object.entries(STYLES).map(([name, description]) => ({
      name,
      description,
    })),
    featureGraphicStyles: Object.entries(FEATURE_STYLES).map(
      ([name, description]) => ({ name, description }),
    ),
    sizes: Object.entries(SIZES).map(([name, s]) => ({
      name,
      description: s.label,
    })),
  };
}

export async function checkProject(root: string, cardsId = DEFAULT_CARDS) {
  try {
    const project = await loadProject(root, cardsId, measure);
    const problems = inspect(project);
    return {
      ok: problems.length === 0,
      folder: project.dir,
      product: project.product.name,
      languages: projectLanguages(project),
      logo: project.logo ? path.relative(project.dir, project.logo) : null,
      screens: [...project.screens.values()].map((s) => ({
        name: s.name,
        size: `${s.width}x${s.height}`,
      })),
      cards: project.cards.map((c) => ({
        file: c.file,
        screen: c.screen,
        languages: cardLanguages(c),
        callouts: c.callouts.length,
      })),
      problems,
    };
  } catch (e) {
    if (e instanceof ProjectError)
      return { ok: false, problems: [e.message, ...e.problems] };
    throw e;
  }
}

async function load(root: string, cardsId: string, only?: string[]) {
  const project = await loadProject(root, cardsId, measure);
  const problems = inspect(project, selectCards(project, only));
  if (problems.length)
    throw new ProjectError("Fix these before rendering", problems);
  await ensureGitignore(project.dir);
  return project;
}

export interface PreviewInput {
  cardsId?: string;
  card?: string;
  lang?: string;
  size?: Size;
}

export async function renderPreview(
  root: string,
  input: PreviewInput,
  onProgress?: Progress,
) {
  const cardsId = input.cardsId ?? DEFAULT_CARDS;
  const project = await load(
    root,
    cardsId,
    input.card ? [input.card] : undefined,
  );
  const card = selectCards(project, input.card ? [input.card] : undefined)[0];
  if (!card) throw new ProjectError("The cards file has no cards");
  const lang = input.lang ?? cardLanguages(card)[0] ?? "en";
  const size = input.size ?? "phone";
  const out = path.join(outputDir(project), "preview", size);
  const styles = Object.keys(STYLES) as Style[];
  const { jobs, staged } = plan(project, {
    outDir: out,
    styles,
    sizes: [size],
    langs: [lang],
    only: [card.file],
    feature: false,
  });
  await renderJobs(jobs, staged, publicDir(project), onProgress);
  const images = jobs.map((j, i) => ({
    style: styles[i] as Style,
    file: j.out,
  }));
  const sheet = path.join(out, "styles.jpg");
  await contactSheet(
    images.map((i) => i.file),
    sheet,
  );
  const page = path.join(out, "index.html");
  await previewPage(
    page,
    `${project.product.name}: choose a style`,
    images.map((i) => ({
      style: i.style,
      description: STYLES[i.style],
      image: path.relative(out, i.file),
    })),
  );
  return {
    card: card.file,
    language: lang,
    size,
    page,
    sheet,
    images: images.map((i) => ({
      style: i.style,
      description: STYLES[i.style],
      file: i.file,
    })),
  };
}

export interface SetInput {
  cardsId?: string;
  styles?: Style[];
  langs?: string[];
  sizes?: Size[];
  only?: string[];
  feature?: boolean;
}

export async function renderSet(
  root: string,
  input: SetInput,
  onProgress?: Progress,
) {
  const project = await load(root, input.cardsId ?? DEFAULT_CARDS, input.only);
  const out = outputDir(project);
  const styles = input.styles?.length
    ? input.styles
    : (Object.keys(STYLES) as Style[]);
  const sizes = input.sizes?.length
    ? input.sizes
    : (Object.keys(SIZES) as Size[]);
  const { jobs, groups, staged } = plan(project, {
    outDir: out,
    styles,
    sizes,
    langs: input.langs,
    only: input.only,
    feature: input.feature ?? true,
  });
  await renderJobs(jobs, staged, publicDir(project), onProgress);
  const sheets: string[] = [];
  for (const [key, files] of groups) {
    const sheet = path.join(out, `sheet_${key.replaceAll("/", "_")}.jpg`);
    await contactSheet(files, sheet);
    sheets.push(sheet);
  }
  return {
    folder: out,
    images: jobs.length,
    screenshots: [...groups.entries()].map(([key, files]) => ({
      set: key,
      folder: path.dirname(files[0] ?? out),
      count: files.length,
    })),
    featureGraphics: jobs
      .filter((j) => j.composition === "FeatureGraphic")
      .map((j) => j.out),
    sheets,
  };
}
