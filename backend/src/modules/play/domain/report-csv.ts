import { createHash } from "crypto";

export interface ReportRow {
  reviewId: string;
  replyable: boolean;
  packageName: string;
  stars: number;
  text: string;
  language: string | null;
  appVersionName: string | null;
  appVersionCode: number | null;
  device: string | null;
  reviewedAt: Date;
  replyText: string | null;
  repliedAt: Date | null;
}

export function decodeReport(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe)
    return buffer.subarray(2).toString("utf16le");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  const text = buffer.toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const millis = (value: string | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n) : null;
};

const date = (value: string | undefined) => {
  if (!value?.trim()) return null;
  const d = new Date(value.trim().replace(" ", "T").replace(/Z?$/, "Z"));
  return Number.isNaN(d.getTime()) ? null : d;
};

export interface ParsedReport {
  rows: ReportRow[];
  skipped: number;
  packages: string[];
}

export function parseReport(buffer: Buffer): ParsedReport | string {
  const table = parseCsv(decodeReport(buffer));
  const header = table[0]?.map((h) => h.trim().toLowerCase());
  if (!header) return "The file is empty.";
  const col = (name: string) => header.indexOf(name);
  const idx = {
    pkg: col("package name"),
    code: col("app version code"),
    name: col("app version name"),
    lang: col("reviewer language"),
    device: col("device"),
    submitted: col("review submit millis since epoch"),
    submittedAt: col("review submit date and time"),
    updated: col("review last update millis since epoch"),
    updatedAt: col("review last update date and time"),
    stars: col("star rating"),
    title: col("review title"),
    text: col("review text"),
    replied: col("developer reply millis since epoch"),
    repliedAt: col("developer reply date and time"),
    reply: col("developer reply text"),
    link: col("review link"),
  };
  if (idx.pkg < 0 || idx.stars < 0)
    return "This isn't a Play Console reviews report. In Play Console, open Download reports, choose Reviews, and upload a reviews_<package>_<month>.csv file.";
  const rows: ReportRow[] = [];
  let skipped = 0;
  const packages = new Set<string>();
  for (const r of table.slice(1)) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const stars = Number(get(idx.stars));
    const reviewedAt =
      millis(get(idx.updated)) ??
      date(get(idx.updatedAt)) ??
      millis(get(idx.submitted)) ??
      date(get(idx.submittedAt));
    const packageName = get(idx.pkg);
    if (
      !packageName ||
      !Number.isInteger(stars) ||
      stars < 1 ||
      stars > 5 ||
      !reviewedAt
    ) {
      skipped++;
      continue;
    }
    packages.add(packageName);
    const text = [get(idx.title), get(idx.text)].filter(Boolean).join("\n");
    const link = get(idx.link);
    const fromLink = /[?&]reviewId=([^&#\s]+)/.exec(link)?.[1];
    const reviewId = fromLink
      ? decodeURIComponent(fromLink)
      : `csv:${createHash("sha256")
          .update(
            `${packageName}|${get(idx.submitted) || get(idx.submittedAt)}|${get(idx.device)}|${text}`,
          )
          .digest("hex")
          .slice(0, 32)}`;
    const code = Number(get(idx.code));
    rows.push({
      reviewId,
      replyable: Boolean(fromLink),
      packageName,
      stars,
      text,
      language: get(idx.lang) || null,
      appVersionName: get(idx.name) || null,
      appVersionCode: Number.isInteger(code) && code > 0 ? code : null,
      device: get(idx.device) || null,
      reviewedAt,
      replyText: get(idx.reply) || null,
      repliedAt: millis(get(idx.replied)) ?? date(get(idx.repliedAt)),
    });
  }
  return { rows, skipped, packages: [...packages] };
}
