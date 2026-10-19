type Named = { key?: unknown; id?: unknown; name?: unknown };

const names = (items: unknown): string[] =>
  Array.isArray(items)
    ? (items as Named[])
        .map((i) =>
          typeof i === "string"
            ? i
            : typeof i?.name === "string"
              ? i.name
              : typeof i?.key === "string" || typeof i?.key === "number"
                ? String(i.key)
                : null,
        )
        .filter((v): v is string => Boolean(v))
    : [];

const list = (items: string[], max = 3) =>
  items.length > max
    ? `${items.slice(0, max).join(", ")} +${items.length - max} more`
    : items.join(", ");

export function summarizeTargeting(targeting: Record<string, unknown>): {
  locations: string | null;
  age: string | null;
  gender: string | null;
  audience: string | null;
} {
  const geo = (targeting.geo_locations ?? {}) as Record<string, unknown>;
  const places = [
    ...names(geo.cities),
    ...names(geo.regions),
    ...names(geo.countries),
    ...names(geo.custom_locations),
  ];
  const min = typeof targeting.age_min === "number" ? targeting.age_min : null;
  const max = typeof targeting.age_max === "number" ? targeting.age_max : null;
  const genders = Array.isArray(targeting.genders)
    ? (targeting.genders as unknown[])
    : [];
  const flexible = Array.isArray(targeting.flexible_spec)
    ? (targeting.flexible_spec as Record<string, unknown>[])
    : [];
  const people = [
    ...flexible.flatMap((f) =>
      Object.values(f).flatMap((items) => names(items)),
    ),
    ...names(targeting.interests),
  ];
  return {
    locations: places.length ? list(places) : null,
    age:
      min !== null || max !== null
        ? `${min ?? 18}–${max === 65 ? "65+" : (max ?? "65+")}`
        : null,
    gender:
      genders.length === 1
        ? genders[0] === 1
          ? "Men"
          : genders[0] === 2
            ? "Women"
            : null
        : null,
    audience: people.length ? list(people) : null,
  };
}
