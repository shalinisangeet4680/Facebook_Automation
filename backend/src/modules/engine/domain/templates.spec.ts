import { PRESET_TEMPLATES } from "@modules/play/domain/presets";
import {
  checkTemplate,
  firstName,
  pickBody,
  pickVariant,
  placeholders,
  render,
} from "./templates";

describe("render", () => {
  it("fills placeholders, uses fallbacks and tidies spacing", () => {
    const out = render(
      "Hi {{first_name|there}}, call {{ support_phone }} or {{support_email|us}}. – {{team_name}}",
      { first_name: "", support_phone: "+91 98765 43210", team_name: "Acme" },
    );
    expect(out).toEqual({
      text: "Hi there, call +91 98765 43210 or us. – Acme",
      missing: [],
      tooLong: false,
    });
  });

  it("reports placeholders with no value and no fallback", () => {
    const out = render("Email {{support_email}} today, {{first_name|}}!", {});
    expect(out.missing).toEqual(["support_email"]);
    expect(out.text).toBe("Email today!");
  });

  it("flags replies over 350 characters, counting emoji as two to stay safe", () => {
    expect(render("a".repeat(350), {}).tooLong).toBe(false);
    expect(render("a".repeat(351), {}).tooLong).toBe(true);
    expect(render("😀".repeat(176), {}).tooLong).toBe(true);
  });

  it("allows longer replies on Google Business", () => {
    expect(render("a".repeat(4096), {}, "google_business").tooLong).toBe(false);
    expect(render("a".repeat(4097), {}, "google_business").tooLong).toBe(true);
    expect(
      checkTemplate(
        [{ language: "en", variants: ["a".repeat(500)] }],
        {},
        "google_business",
      ),
    ).toEqual([]);
  });

  it("lists placeholders with their fallbacks", () => {
    expect(placeholders("{{a}} {{b_2|x y}} {{Bad}} {user_name} {x}")).toEqual([
      { name: "a", fallback: null, raw: "{{a}}" },
      { name: "b_2", fallback: "x y", raw: "{{b_2}}" },
      { name: "user_name", fallback: "there", raw: "{user_name}" },
      { name: "x", fallback: null, raw: "{x}" },
    ]);
  });

  it("fills the design's single-brace placeholders with aliases and defaults", () => {
    expect(
      render(
        "Hi {user_name}, thanks for the {rating}-star review of {app_name}! Fixed in {version}. – {developer_name}",
        {
          first_name: "Maya",
          rating: "5",
          app_name: "Pulse",
          latest_version: "3.2",
        },
      ).text,
    ).toBe(
      "Hi Maya, thanks for the 5-star review of Pulse! Fixed in 3.2. – The team",
    );
    expect(
      render("Hi {user_name}, email {support_email}.", {}).missing,
    ).toEqual(["support_email"]);
    expect(render("Hi {user_name}!", {}).text).toBe("Hi there!");
    expect(render("JSON {{ Not }} and {Upper} stay", {}).text).toBe(
      "JSON {{ Not }} and {Upper} stay",
    );
  });
});

describe("firstName", () => {
  it("uses the first word of a real name only", () => {
    expect(firstName("Priya Sharma")).toBe("Priya");
    expect(firstName("A Google user")).toBe("");
    expect(firstName("  ")).toBe("");
    expect(firstName("12345 678")).toBe("");
    expect(firstName("राहुल कुमार")).toBe("राहुल");
  });
});

describe("pickBody and pickVariant", () => {
  const bodies = [
    { language: "en", variants: ["en"] },
    { language: "pt-BR", variants: ["br"] },
    { language: "hi", variants: ["hi"] },
  ];

  it("matches the reviewer's language exactly, then by base, then falls back", () => {
    expect(pickBody(bodies, "pt_BR")?.language).toBe("pt-BR");
    expect(pickBody(bodies, "pt-PT")?.language).toBe("pt-BR");
    expect(pickBody(bodies, "hi")?.language).toBe("hi");
    expect(pickBody(bodies, "fr")?.language).toBe("en");
    expect(pickBody(bodies, null)?.language).toBe("en");
    expect(pickBody([], "en")).toBeNull();
  });

  it("picks the same variant for the same review and spreads across reviews", () => {
    const variants = ["a", "b", "c"];
    expect(pickVariant(variants, "r1")).toBe(pickVariant(variants, "r1"));
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => pickVariant(variants, `r${i}`)),
    );
    expect(seen.size).toBe(3);
  });
});

describe("checkTemplate", () => {
  it("accepts every preset once the support email is set", () => {
    for (const preset of PRESET_TEMPLATES)
      expect(
        checkTemplate(preset.bodies, {
          app_name: "Acme Shop",
          rating: "5",
          support_email: "help@acme.app",
        }),
      ).toEqual([]);
  });

  it("explains broken placeholders, missing values, duplicates and length", () => {
    const problems = checkTemplate(
      [
        {
          language: "en",
          variants: [
            "Call {{support_phone}} or {{ Support }}",
            "",
            "{{first_name}} " + "x".repeat(340),
          ],
        },
        { language: "EN", variants: ["Hi"] },
      ],
      {},
    ).map((p) => p.problem);
    expect(problems).toEqual([
      "{{ Support }} is not a valid placeholder; use lowercase names like {{support_email}}",
      "{{support_phone}} has no value in this app's settings and no fallback",
      "This wording is empty",
      "Can reach 352 characters; Google Play allows 350",
      "EN is listed twice",
    ]);
  });
});
