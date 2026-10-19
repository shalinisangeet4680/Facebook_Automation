export interface LeadField {
  name: string;
  values: string[];
}

export interface FormQuestion {
  key: string;
  label: string;
}

export interface LeadAnswer {
  key: string;
  label: string;
  value: string;
}

export interface LeadContact {
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  answers: LeadAnswer[];
}

const NAME_KEYS = ["full_name", "name"];
const PHONE_KEYS = ["phone_number", "phone", "mobile_number"];
const EMAIL_KEYS = ["email", "work_email"];
const CITY_KEYS = ["city"];
const KNOWN = new Set([
  ...NAME_KEYS,
  ...PHONE_KEYS,
  ...EMAIL_KEYS,
  ...CITY_KEYS,
  "first_name",
  "last_name",
]);

const first = (fields: LeadField[], keys: string[]): string | null => {
  for (const key of keys) {
    const value = fields
      .find((f) => f.name.toLowerCase() === key)
      ?.values.find((v) => v.trim());
    if (value) return value.trim();
  }
  return null;
};

export function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : key;
}

export function contactOf(
  fields: LeadField[],
  questions: FormQuestion[] = [],
): LeadContact {
  const split = [first(fields, ["first_name"]), first(fields, ["last_name"])]
    .filter(Boolean)
    .join(" ");
  const labels = new Map(questions.map((q) => [q.key, q.label]));
  return {
    name: first(fields, NAME_KEYS) ?? (split || null),
    phone: first(fields, PHONE_KEYS),
    email: first(fields, EMAIL_KEYS),
    city: first(fields, CITY_KEYS),
    answers: fields
      .filter((f) => !KNOWN.has(f.name.toLowerCase()))
      .map((f) => ({
        key: f.name,
        label: labels.get(f.name) || humanize(f.name),
        value: f.values.join(", "),
      }))
      .filter((a) => a.value.trim()),
  };
}
