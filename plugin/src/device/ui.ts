export interface UiElement {
  i: number;
  text: string;
  desc: string;
  id: string;
  type: string;
  clickable: boolean;
  scrollable: boolean;
  focused: boolean;
  checked?: boolean;
  enabled: boolean;
  bounds: [number, number, number, number];
  center: [number, number];
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m);

function attributes(tag: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g))
    map.set(m[1]!, decode(m[2]!));
  return map;
}

export function parseHierarchy(
  xml: string,
  screen?: { width: number; height: number },
  limit = 150,
): UiElement[] {
  const elements: UiElement[] = [];
  for (const m of xml.matchAll(/<node\b([^>]*?)\/?>/g)) {
    const a = attributes(m[1]!);
    const b = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(
      a.get("bounds") ?? "",
    );
    if (!b) continue;
    let [x1, y1, x2, y2] = [b[1], b[2], b[3], b[4]].map(Number) as [
      number,
      number,
      number,
      number,
    ];
    if (screen) {
      x1 = Math.max(0, x1);
      y1 = Math.max(0, y1);
      x2 = Math.min(screen.width, x2);
      y2 = Math.min(screen.height, y2);
    }
    if (x2 - x1 < 2 || y2 - y1 < 2) continue;
    const text = (a.get("text") ?? "").trim();
    const desc = (a.get("content-desc") ?? "").trim();
    const clickable =
      a.get("clickable") === "true" || a.get("long-clickable") === "true";
    const scrollable = a.get("scrollable") === "true";
    const checkable = a.get("checkable") === "true";
    const isInput = (a.get("class") ?? "").endsWith("EditText");
    if (!text && !desc && !clickable && !scrollable && !checkable && !isInput)
      continue;
    const id = (a.get("resource-id") ?? "").replace(/^[\w.]+:id\//, "");
    elements.push({
      i: elements.length,
      text: a.get("password") === "true" ? "•".repeat(text.length) : text,
      desc,
      id,
      type: (a.get("class") ?? "").split(".").pop() ?? "",
      clickable,
      scrollable,
      focused: a.get("focused") === "true",
      ...(checkable ? { checked: a.get("checked") === "true" } : {}),
      enabled: a.get("enabled") !== "false",
      bounds: [x1, y1, x2, y2],
      center: [Math.round((x1 + x2) / 2), Math.round((y1 + y2) / 2)],
    });
    if (elements.length >= limit) break;
  }
  return elements;
}

export function findByText(
  elements: UiElement[],
  query: string,
): UiElement | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const label = (e: UiElement) =>
    [e.text, e.desc, e.id].map((s) => s.toLowerCase());
  const exact = elements.filter((e) => label(e).includes(q));
  const partial = exact.length
    ? exact
    : elements.filter((e) => label(e).some((s) => s.includes(q)));
  return partial.find((e) => e.clickable && e.enabled) ?? partial[0] ?? null;
}

export function compact(e: UiElement) {
  return {
    i: e.i,
    ...(e.text ? { text: e.text } : {}),
    ...(e.desc ? { desc: e.desc } : {}),
    ...(e.id ? { id: e.id } : {}),
    type: e.type,
    ...(e.clickable ? { clickable: true } : {}),
    ...(e.scrollable ? { scrollable: true } : {}),
    ...(e.focused ? { focused: true } : {}),
    ...(e.checked !== undefined ? { checked: e.checked } : {}),
    ...(e.enabled ? {} : { enabled: false }),
    center: e.center,
  };
}
