const rupee = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatMinorAmount(minor: unknown, currency: unknown): string | null {
  const n = typeof minor === "string" ? Number(minor) : typeof minor === "number" ? minor : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const major = n / 100;
  return currency === "INR"
    ? rupee.format(major)
    : `${major.toLocaleString("en-IN")} ${typeof currency === "string" ? currency : ""}`.trim();
}

export function timeAgo(iso: unknown, now: number): string | null {
  if (typeof iso !== "string") return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const minutes = Math.max(0, Math.round((now - t) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
