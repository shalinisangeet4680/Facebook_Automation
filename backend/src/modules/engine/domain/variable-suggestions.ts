export type SuggestionSource = "play_listing" | "past_replies";

export interface VariableSuggestion {
  key: string;
  value: string;
  source: SuggestionSource;
  count: number;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const SIGN_OFF = [
  /[—–]\s*([A-Z][^\n—–]{1,39}?)\s*[.!]?\s*$/,
  /\s-\s+([A-Z][^\n-]{1,38}?)\s*[.!]?\s*$/,
  /(?:[Ww]arm [Rr]egards|[Kk]ind [Rr]egards|[Bb]est [Rr]egards|[Rr]egards|[Cc]heers|[Ss]incerely|[Bb]est wishes)[,!]?\s+(?:from\s+)?([A-Z][\w .&']{1,38}?)\s*[.!]?\s*$/,
];

const NOT_NAMES =
  /^(?:the|for|and|we|you|your|our|please|thanks|thank|happy|glad|hope|keep|stay)\b/i;

function top(values: string[]) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
}

const cleanUrl = (u: string) => u.replace(/[.,;:!?]+$/, "");
const digits = (p: string) => p.replace(/\D/g, "");

export function suggestFromReplies(replies: string[]): VariableSuggestion[] {
  const texts = replies.map((r) => r.trim()).filter(Boolean);
  if (!texts.length) return [];
  const out: VariableSuggestion[] = [];
  const add = (key: string, best: [string, number] | null, min = 1) => {
    if (best && best[1] >= min)
      out.push({ key, value: best[0], source: "past_replies", count: best[1] });
  };
  add(
    "support_email",
    top(
      texts.flatMap((t) => (t.match(EMAIL) ?? []).map((e) => e.toLowerCase())),
    ),
  );
  add(
    "support_url",
    top(
      texts.flatMap((t) =>
        (t.match(URL_RE) ?? [])
          .map(cleanUrl)
          .filter((u) => !/play\.google\.com|\{|\}/.test(u)),
      ),
    ),
  );
  add(
    "support_phone",
    top(
      texts.flatMap((t) =>
        (t.match(PHONE) ?? [])
          .map((p) => p.trim())
          .filter((p) => digits(p).length >= 8 && digits(p).length <= 15),
      ),
    ),
  );
  const names: string[] = [];
  for (const t of texts) {
    const line = t.split("\n").pop()!.trim();
    for (const re of SIGN_OFF) {
      const m = re.exec(line);
      const name = m?.[1]?.trim();
      if (
        name &&
        !NOT_NAMES.test(name) &&
        !/[@{}]|https?:|www\./i.test(name) &&
        name.split(/\s+/).length <= 5
      ) {
        names.push(name);
        break;
      }
    }
  }
  add("developer_name", top(names), texts.length > 2 ? 2 : 1);
  return out;
}

export function suggestFromListing(contact: {
  email: string | null;
  phone: string | null;
  website: string | null;
}): VariableSuggestion[] {
  return [
    ["support_email", contact.email],
    ["support_phone", contact.phone],
    ["support_url", contact.website],
  ]
    .filter((e): e is [string, string] => Boolean(e[1]?.trim()))
    .map(([key, value]) => ({
      key,
      value: value.trim(),
      source: "play_listing",
      count: 1,
    }));
}
