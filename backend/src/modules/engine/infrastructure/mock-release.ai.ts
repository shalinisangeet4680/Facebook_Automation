import {
  CrashExplanation,
  CrashInput,
  ReleaseAi,
  ReleaseNotesInput,
} from "../domain/ports/release-ai";

const PREFIX: Record<string, string> = {
  en: "What's new",
  hi: "नया क्या है",
  es: "Novedades",
  pt: "O que há de novo",
  de: "Neuigkeiten",
  fr: "Nouveautés",
};

export class MockReleaseAi implements ReleaseAi {
  readonly calls: (ReleaseNotesInput | CrashInput)[] = [];

  async releaseNotes(_apiKey: string, input: ReleaseNotesInput) {
    this.calls.push(input);
    const lines = input.changelog
      .split("\n")
      .map((l) => l.replace(/^[-*•\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 5);
    return input.languages.map((language) => {
      const head = PREFIX[language.split("-")[0]!] ?? PREFIX.en!;
      const text = `${head}${input.versionName ? ` in ${input.versionName}` : ""}:\n${lines.map((l) => `• ${l}`).join("\n")}`;
      return { language, text: text.slice(0, input.maxLength) };
    });
  }

  async explainCrash(
    _apiKey: string,
    input: CrashInput,
  ): Promise<CrashExplanation> {
    this.calls.push(input);
    const where = input.files[0] ?? input.location;
    return {
      summary: `${input.type === "ANR" ? "The app stops responding" : "The app crashes"} in ${input.location} with ${input.cause}.`,
      cause: `${input.cause} is thrown at ${where}, most often on ${input.devices[0] ?? "several devices"}.`,
      fix: `Guard the code at ${where} against the failing state and add a test that reproduces it before shipping a new build.`,
      files: input.files,
    };
  }
}
