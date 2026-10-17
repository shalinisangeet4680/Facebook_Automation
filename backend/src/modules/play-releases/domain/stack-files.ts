const FRAME = /^\s*at\s+([\w$.<>]+)\.([\w$<>-]+)\(([^:()]+)(?::(\d+))?\)/;

export interface StackFrame {
  className: string;
  method: string;
  file: string;
  line: number | null;
}

export function frames(trace: string): StackFrame[] {
  const out: StackFrame[] = [];
  for (const line of trace.split("\n")) {
    const m = FRAME.exec(line);
    if (!m) continue;
    out.push({
      className: m[1]!,
      method: m[2]!,
      file: m[3]!,
      line: m[4] ? Number(m[4]) : null,
    });
  }
  return out;
}

const pathOf = (f: StackFrame) => {
  const outer = f.className.split("$")[0]!;
  const pkg = outer.split(".").slice(0, -1);
  return [...pkg, f.file].join("/");
};

export function likelyFiles(
  traces: string[],
  packageName: string,
  limit = 6,
): string[] {
  const root = packageName.split(".").slice(0, 2).join(".");
  const counts = new Map<string, { n: number; first: number }>();
  let order = 0;
  for (const trace of traces)
    for (const f of frames(trace)) {
      if (!f.className.startsWith(`${root}.`) || !/\.\w+$/.test(f.file))
        continue;
      const path = `${pathOf(f)}${f.line ? `:${f.line}` : ""}`;
      const current = counts.get(path);
      counts.set(path, {
        n: (current?.n ?? 0) + 1,
        first: current?.first ?? order++,
      });
    }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b.n - a.n || a.first - b.first)
    .slice(0, limit)
    .map(([path]) => path);
}
