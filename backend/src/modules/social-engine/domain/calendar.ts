import { bestHourFor } from "./best-time";
import {
  BestTimes,
  BrandKit,
  ContentType,
  FORMATS_BY_PLATFORM,
  PostFormat,
  SocialPlatform,
} from "./social.types";
import { addDays, localParts, zonedTime } from "./time";

export interface Festival {
  day: string;
  name: string;
  idea: string;
}

const F = (day: string, name: string, idea: string): Festival => ({
  day,
  name,
  idea,
});

export const FESTIVALS: Festival[] = [
  F("2026-01-01", "New Year", "Wish followers a happy new year"),
  F("2026-01-14", "Makar Sankranti and Pongal", "Harvest festival wishes"),
  F("2026-01-26", "Republic Day", "Republic Day greetings"),
  F("2026-03-04", "Holi", "Colourful Holi wishes"),
  F("2026-03-19", "Ugadi and Gudi Padwa", "New year wishes for the region"),
  F("2026-03-21", "Eid al-Fitr", "Eid Mubarak greetings"),
  F("2026-03-26", "Ram Navami", "Ram Navami greetings"),
  F("2026-04-14", "Baisakhi and Ambedkar Jayanti", "Harvest festival wishes"),
  F("2026-08-15", "Independence Day", "Independence Day greetings"),
  F("2026-08-28", "Raksha Bandhan", "Celebrate siblings"),
  F("2026-09-04", "Janmashtami", "Janmashtami greetings"),
  F("2026-09-14", "Ganesh Chaturthi", "Ganpati Bappa Morya greetings"),
  F("2026-10-02", "Gandhi Jayanti", "Remember Gandhi ji"),
  F("2026-10-11", "Navratri begins", "Nine days of festivities"),
  F("2026-10-20", "Dussehra", "Victory of good over evil"),
  F("2026-11-08", "Diwali", "Diwali wishes and festive offers"),
  F("2026-11-11", "Bhai Dooj", "Bhai Dooj greetings"),
  F("2026-11-15", "Chhath Puja", "Chhath Puja greetings"),
  F("2026-11-24", "Guru Nanak Jayanti", "Gurpurab greetings"),
  F("2026-12-25", "Christmas", "Merry Christmas wishes"),
  F("2027-01-01", "New Year", "Wish followers a happy new year"),
  F("2027-01-14", "Makar Sankranti and Pongal", "Harvest festival wishes"),
  F("2027-01-26", "Republic Day", "Republic Day greetings"),
  F("2027-03-10", "Eid al-Fitr", "Eid Mubarak greetings"),
  F("2027-03-22", "Holi", "Colourful Holi wishes"),
  F("2027-04-07", "Ugadi and Gudi Padwa", "New year wishes for the region"),
  F("2027-04-14", "Baisakhi and Ambedkar Jayanti", "Harvest festival wishes"),
  F("2027-08-15", "Independence Day", "Independence Day greetings"),
  F("2027-08-17", "Raksha Bandhan", "Celebrate siblings"),
  F("2027-08-25", "Janmashtami", "Janmashtami greetings"),
  F("2027-09-04", "Ganesh Chaturthi", "Ganpati Bappa Morya greetings"),
  F("2027-09-30", "Navratri begins", "Nine days of festivities"),
  F("2027-10-09", "Dussehra", "Victory of good over evil"),
  F("2027-10-29", "Diwali", "Diwali wishes and festive offers"),
  F("2027-12-25", "Christmas", "Merry Christmas wishes"),
];

export function festivalsBetween(from: string, to: string): Festival[] {
  return FESTIVALS.filter((f) => f.day >= from && f.day <= to);
}

export interface PlannedSlot {
  day: string;
  at: Date;
  contentType: ContentType;
  format: PostFormat;
  idea: string;
  festival: string | null;
}

const MIX: ContentType[] = [
  "tip",
  "product",
  "behind_the_scenes",
  "offer",
  "testimonial",
  "tip",
  "announcement",
];

const pick = <T>(list: T[], i: number, fallback: T): T =>
  list.length ? list[i % list.length]! : fallback;

export function ideaFor(type: ContentType, brand: BrandKit, i: number): string {
  const name = brand.name || "your business";
  const topic = pick(brand.topics, i, brand.businessType || "what you do");
  switch (type) {
    case "tip":
      return `A practical tip about ${topic}`;
    case "product":
      return `Spotlight on ${pick(brand.offers, i, topic)}`;
    case "offer":
      return `Offer: ${pick(brand.offers, i, "a limited-time offer")}`;
    case "behind_the_scenes":
      return `Behind the scenes at ${name}`;
    case "testimonial":
      return "A happy customer's words, shared only with their permission";
    case "announcement":
      return `News from ${name}`;
    case "festival":
      return `Festive wishes from ${name}`;
  }
}

function formatFor(
  type: ContentType,
  platform: SocialPlatform,
  preferred: PostFormat[],
  i: number,
): PostFormat {
  const allowed = preferred.filter((f) =>
    FORMATS_BY_PLATFORM[platform].includes(f),
  );
  const list = allowed.length ? allowed : (["image"] as PostFormat[]);
  if (type === "festival" || type === "testimonial")
    return list.includes("image") ? "image" : list[0]!;
  if (type === "tip" && list.includes("carousel")) return "carousel";
  return list[i % list.length]!;
}

export function planWeek(input: {
  weekStart: string;
  timezone: string;
  platform: SocialPlatform;
  postsPerWeek: number;
  formats: PostFormat[];
  bestTimes: BestTimes;
  brand: BrandKit;
  now: Date;
}): PlannedSlot[] {
  const n = Math.max(1, Math.min(14, input.postsPerWeek));
  const weekEnd = addDays(input.weekStart, 6);
  const seed = Number(input.weekStart.replace(/-/g, "")) % MIX.length;
  const festivals = festivalsBetween(input.weekStart, weekEnd).slice(0, 2);
  const slots: Omit<PlannedSlot, "at">[] = festivals.map((f) => ({
    day: f.day,
    contentType: "festival",
    format: formatFor("festival", input.platform, input.formats, 0),
    idea: `${f.name}: ${f.idea}`,
    festival: f.name,
  }));
  const remaining = Math.max(0, n - slots.length);
  const used = new Set(slots.map((s) => s.day));
  for (let i = 0; i < remaining; i++) {
    let offset = Math.floor(((i + 0.5) * 7) / remaining) % 7;
    for (
      let tries = 0;
      tries < 7 && used.has(addDays(input.weekStart, offset));
      tries++
    )
      offset = (offset + 1) % 7;
    const day = addDays(input.weekStart, offset);
    used.add(day);
    const type = MIX[(i + seed) % MIX.length]!;
    slots.push({
      day,
      contentType: type,
      format: formatFor(type, input.platform, input.formats, i),
      idea: ideaFor(type, input.brand, i + seed),
      festival: null,
    });
  }
  const perDay = new Map<string, number>();
  return slots
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((s) => {
      const nth = perDay.get(s.day) ?? 0;
      perDay.set(s.day, nth + 1);
      const weekday = localParts(
        zonedTime(s.day, 12, 0, input.timezone),
        input.timezone,
      ).weekday;
      const daySlots = input.bestTimes.slots
        .filter((t) => t.weekday === weekday)
        .sort((a, b) => b.score - a.score);
      const hour =
        daySlots[nth]?.hour ??
        (bestHourFor(weekday, input.bestTimes) + nth * 3) % 24;
      return { ...s, at: zonedTime(s.day, hour, 0, input.timezone) };
    })
    .filter((s) => s.at.getTime() > input.now.getTime() + 15 * 60_000);
}
