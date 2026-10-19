export const MIN_WINNER_RESULTS = 5;
export const MIN_WINNER_IMPRESSIONS = 1000;
export const VARIANT_LABELS = ["A", "B", "C"] as const;

export interface VariantStats {
  id: string;
  spend: number;
  results: number;
  impressions: number;
  linkClicks: number;
}

export type WinnerBasis = "cost_per_result" | "ctr";

export interface WinnerPick {
  winnerId: string | null;
  basis: WinnerBasis | null;
  note: string | null;
}

const ctr = (v: VariantStats) =>
  v.impressions ? (v.linkClicks / v.impressions) * 100 : 0;

export function pickWinner(
  variants: VariantStats[],
  minResults = MIN_WINNER_RESULTS,
): WinnerPick {
  if (variants.length < 2) return { winnerId: null, basis: null, note: null };
  const proven = variants.filter((v) => v.results >= minResults);
  if (proven.length) {
    const best = proven.reduce((a, b) =>
      b.spend / b.results < a.spend / a.results ? b : a,
    );
    return {
      winnerId: best.id,
      basis: "cost_per_result",
      note:
        proven.length < variants.length
          ? `The other versions have fewer than ${minResults} results so far.`
          : null,
    };
  }
  const seen = variants.filter(
    (v) => v.impressions >= MIN_WINNER_IMPRESSIONS && v.linkClicks > 0,
  );
  if (seen.length) {
    const best = seen.reduce((a, b) => (ctr(b) > ctr(a) ? b : a));
    return {
      winnerId: best.id,
      basis: "ctr",
      note: `No version has ${minResults} results yet, so this is the one people click most.`,
    };
  }
  return {
    winnerId: null,
    basis: null,
    note: "Not enough data yet. Give the versions a few days and some budget.",
  };
}

export function variantLabel(index: number): string {
  return VARIANT_LABELS[index] ?? String(index + 1);
}
