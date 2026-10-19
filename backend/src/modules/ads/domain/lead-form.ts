import { z } from "zod";

export const PREFILL_QUESTIONS = [
  "FULL_NAME",
  "EMAIL",
  "PHONE",
  "CITY",
] as const;
export type PrefillQuestion = (typeof PREFILL_QUESTIONS)[number];

export const DEFAULT_PREFILL_QUESTIONS: PrefillQuestion[] = [
  "FULL_NAME",
  "PHONE",
  "CITY",
];

export const LEAD_FORM_LOCALES = {
  EN_US: "English",
  EN_GB: "English (UK)",
  HI_IN: "Hindi",
  AR_AR: "Arabic",
  DE_DE: "German",
  ES_ES: "Spanish",
  ES_LA: "Spanish (Latin America)",
  FR_FR: "French",
  ID_ID: "Indonesian",
  IT_IT: "Italian",
  JA_JP: "Japanese",
  KO_KR: "Korean",
  NL_NL: "Dutch",
  PL_PL: "Polish",
  PT_BR: "Portuguese (Brazil)",
  PT_PT: "Portuguese",
  RU_RU: "Russian",
  TH_TH: "Thai",
  TR_TR: "Turkish",
  VI_VN: "Vietnamese",
  ZH_CN: "Chinese",
} as const;
export type LeadFormLocale = keyof typeof LEAD_FORM_LOCALES;
const LOCALE_KEYS = Object.keys(LEAD_FORM_LOCALES) as [
  LeadFormLocale,
  ...LeadFormLocale[],
];

export const MAX_CUSTOM_QUESTIONS = 3;
export const MAX_CHOICES = 6;

const https = z.string().trim().url().startsWith("https://");

export const customQuestionSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    type: z.enum(["short_answer", "multiple_choice"]),
    options: z
      .array(z.string().trim().min(1).max(40))
      .max(MAX_CHOICES)
      .default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type === "multiple_choice") {
      if (q.options.length < 2)
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "A multiple-choice question needs at least 2 answers",
        });
      const unique = new Set(q.options.map((o) => o.toLowerCase()));
      if (unique.size !== q.options.length)
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Answers must be different from each other",
        });
    } else if (q.options.length) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "A short-answer question can't have answers to choose from",
      });
    }
  });

const thankYouButton = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("website"),
    text: z.string().trim().min(1).max(30),
    url: https,
  }),
  z.object({
    type: z.literal("call"),
    text: z.string().trim().min(1).max(30),
    phone: z
      .string()
      .trim()
      .regex(
        /^\+[1-9]\d{6,14}$/,
        "Use the full phone number with country code, like +919876543210",
      ),
  }),
]);

export const leadFormSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    locale: z.enum(LOCALE_KEYS).default("EN_US"),
    intro: z.object({
      headline: z.string().trim().min(1).max(60),
      description: z.string().trim().max(500).nullable().optional(),
    }),
    questions: z.array(z.enum(PREFILL_QUESTIONS)).min(1).max(4),
    customQuestions: z
      .array(customQuestionSchema)
      .max(MAX_CUSTOM_QUESTIONS)
      .default([]),
    privacyPolicyUrl: https,
    thankYou: z.object({
      title: z.string().trim().min(1).max(60),
      body: z.string().trim().min(1).max(500),
      button: thankYouButton,
    }),
  })
  .superRefine((form, ctx) => {
    if (new Set(form.questions).size !== form.questions.length)
      ctx.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Each question can only be asked once",
      });
    if (!form.questions.includes("PHONE") && !form.questions.includes("EMAIL"))
      ctx.addIssue({
        code: "custom",
        path: ["questions"],
        message:
          "Ask for a phone number or an email so you can contact the lead",
      });
    const labels = form.customQuestions.map((q) => q.label.toLowerCase());
    if (new Set(labels).size !== labels.length)
      ctx.addIssue({
        code: "custom",
        path: ["customQuestions"],
        message: "Each custom question must be different",
      });
  });

export type LeadFormSpec = z.infer<typeof leadFormSchema>;
export type CustomQuestion = z.infer<typeof customQuestionSchema>;

export function parseLeadForm(
  input: unknown,
): { ok: true; form: LeadFormSpec } | { ok: false; message: string } {
  const result = leadFormSchema.safeParse(input);
  if (result.success) return { ok: true, form: result.data };
  return {
    ok: false,
    message: result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "leadForm"}: ${i.message}`)
      .join("; "),
  };
}

export function localeFor(language: string | null | undefined): LeadFormLocale {
  const wanted = language?.trim().toLowerCase();
  if (!wanted) return "EN_US";
  const exact = LOCALE_KEYS.find(
    (k) => LEAD_FORM_LOCALES[k].toLowerCase() === wanted,
  );
  if (exact) return exact;
  const partial = LOCALE_KEYS.find((k) =>
    wanted.startsWith(LEAD_FORM_LOCALES[k].toLowerCase().split(" ")[0]!),
  );
  return partial ?? "EN_US";
}

export function privacyPolicyFor(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;
  try {
    const url = new URL(websiteUrl);
    if (url.protocol !== "https:") return null;
    return `${url.origin}/privacy`;
  } catch {
    return null;
  }
}

export function customQuestionKey(index: number): string {
  return `custom_${index + 1}`;
}
