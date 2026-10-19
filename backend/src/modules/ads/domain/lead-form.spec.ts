import { parsePlan } from "@modules/plans/domain/plan.schema";

import { localeFor, parseLeadForm, privacyPolicyFor } from "./lead-form";

const form = {
  name: "Free demo – Instant form",
  locale: "EN_US",
  intro: { headline: "Free demo", description: "We'll call you back." },
  questions: ["FULL_NAME", "PHONE", "CITY"],
  customQuestions: [
    {
      label: "Best time to call?",
      type: "multiple_choice",
      options: ["Morning", "Evening"],
    },
  ],
  privacyPolicyUrl: "https://example.com/privacy",
  thankYou: {
    title: "Thanks!",
    body: "We'll be in touch soon.",
    button: {
      type: "website",
      text: "Visit website",
      url: "https://example.com",
    },
  },
};

const problem = (input: unknown) => {
  const parsed = parseLeadForm(input);
  return parsed.ok ? null : parsed.message;
};

describe("lead form spec", () => {
  it("accepts a complete form and fills defaults", () => {
    const parsed = parseLeadForm({ ...form, locale: undefined });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.form.locale).toBe("EN_US");
  });

  it("needs a way to contact the lead", () => {
    expect(problem({ ...form, questions: ["FULL_NAME", "CITY"] })).toContain(
      "phone number or an email",
    );
    expect(problem({ ...form, questions: ["PHONE", "PHONE"] })).toContain(
      "only be asked once",
    );
    expect(problem({ ...form, questions: [] })).toContain("questions");
  });

  it("limits custom questions to three with valid answers", () => {
    const q = { label: "Clinic name", type: "short_answer", options: [] };
    expect(
      problem({
        ...form,
        customQuestions: [
          q,
          { ...q, label: "A" },
          { ...q, label: "B" },
          { ...q, label: "C" },
        ],
      }),
    ).toContain("customQuestions");
    expect(
      problem({
        ...form,
        customQuestions: [{ ...q, type: "multiple_choice", options: ["Yes"] }],
      }),
    ).toContain("at least 2 answers");
    expect(
      problem({ ...form, customQuestions: [{ ...q, options: ["Yes", "No"] }] }),
    ).toContain("short-answer");
    expect(
      problem({
        ...form,
        customQuestions: [
          { ...q, type: "multiple_choice", options: ["Yes", "yes"] },
        ],
      }),
    ).toContain("different");
    expect(problem({ ...form, customQuestions: [q, q] })).toContain(
      "must be different",
    );
  });

  it("requires an https privacy policy and a valid thank-you button", () => {
    expect(problem({ ...form, privacyPolicyUrl: undefined })).toContain(
      "privacyPolicyUrl",
    );
    expect(
      problem({ ...form, privacyPolicyUrl: "http://example.com/privacy" }),
    ).toContain("privacyPolicyUrl");
    expect(
      problem({
        ...form,
        thankYou: {
          ...form.thankYou,
          button: { type: "call", text: "Call us", phone: "98765 43210" },
        },
      }),
    ).toContain("country code");
    expect(
      problem({
        ...form,
        thankYou: {
          ...form.thankYou,
          button: { type: "call", text: "Call us", phone: "+919876543210" },
        },
      }),
    ).toBeNull();
    expect(problem({ ...form, locale: "XX_YY" })).toContain("locale");
  });

  it("maps languages to Meta form locales and guesses the privacy page", () => {
    expect(localeFor("Hindi")).toBe("HI_IN");
    expect(localeFor("english")).toBe("EN_US");
    expect(localeFor("Hinglish")).toBe("EN_US");
    expect(localeFor(null)).toBe("EN_US");
    expect(privacyPolicyFor("https://glow.example.com/book?x=1")).toBe(
      "https://glow.example.com/privacy",
    );
    expect(privacyPolicyFor("http://glow.example.com")).toBeNull();
    expect(privacyPolicyFor("not a url")).toBeNull();
    expect(privacyPolicyFor(null)).toBeNull();
  });
});

describe("instant form plans", () => {
  const plan = {
    name: "Free demo – Patna",
    summary: "Instant form leads.",
    goal: "instant_leads",
    conversionEvent: null,
    dailyBudget: 500,
    targeting: { ageMin: 25, ageMax: 55 },
    creative: {
      primaryText: "Book a free demo.",
      headline: "Free demo",
      linkUrl: "https://example.com/",
      imageUrl: "https://example.com/a.png",
      callToAction: "SIGN_UP",
    },
    reasons: { goal: "g", audience: "a", budget: "b", creative: "c" },
    leadForm: form,
  };
  const message = (input: unknown) => {
    const parsed = parsePlan(input);
    return parsed.ok ? null : parsed.message;
  };

  it("needs a form, an image and a form-friendly button", () => {
    expect(message(plan)).toBeNull();
    expect(message({ ...plan, leadForm: null })).toContain("need a lead form");
    expect(
      message({
        ...plan,
        creative: { ...plan.creative, callToAction: "SHOP_NOW" },
      }),
    ).toContain("Instant forms use one of these buttons");
    expect(
      message({
        ...plan,
        creative: {
          ...plan.creative,
          post: { platform: "facebook", id: "1_2" },
        },
      }),
    ).toContain("not an existing post");
    expect(message({ ...plan, goal: "traffic", leadForm: null })).toBeNull();
  });
});
