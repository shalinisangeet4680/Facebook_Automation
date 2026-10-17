import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import {
  CrashExplanation,
  CrashInput,
  ReleaseAi,
  ReleaseNotesInput,
} from "../domain/ports/release-ai";
import { ReplyAiError } from "../domain/ports/reply-ai";
import { REPLY_MODEL } from "./anthropic-reply.ai";

const notesSchema = z.object({
  notes: z.array(z.object({ language: z.string(), text: z.string() })),
});

const crashSchema = z.object({
  summary: z.string(),
  cause: z.string(),
  fix: z.string(),
  files: z.array(z.string()),
});

function notesPrompt(input: ReleaseNotesInput) {
  return {
    system: [
      `You write Google Play "What's new" release notes for the Android app "${input.appName}".`,
      "Write for users, not developers: say what changed for them, skip internal refactors, ticket ids and library bumps.",
      `Plain text, short lines starting with "• " when there are several changes, no markdown headings, at most ${input.maxLength} characters per language.`,
      "Translate naturally for each language; keep product names untranslated.",
      `Return one entry for each of these language codes, exactly as given: ${input.languages.join(", ")}.`,
    ].join("\n"),
    user: [
      input.versionName ? `Version: ${input.versionName}` : "",
      "<changelog>",
      input.changelog,
      "</changelog>",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function crashPrompt(input: CrashInput) {
  return {
    system: [
      `You are a senior Android engineer explaining a ${input.type === "ANR" ? "freeze (ANR)" : "crash"} cluster from Google Play vitals for "${input.appName}" (${input.packageName}).`,
      "summary: one or two plain-language sentences a product owner understands.",
      "cause: the most likely technical cause, grounded in the stack traces; say when you are unsure.",
      "fix: concrete steps or a short code change a developer can apply.",
      "files: source paths from the app's own package that are most likely involved, most likely first. Prefer the candidates given.",
    ].join("\n"),
    user: [
      `<issue type="${input.type}" location="${input.location}">${input.cause}</issue>`,
      `Versions: ${input.versionCodes.join(", ") || "unknown"}`,
      `Devices: ${input.devices.join(", ") || "unknown"}`,
      `Android API levels: ${input.androidVersions.join(", ") || "unknown"}`,
      `Candidate files: ${input.files.join(", ") || "none found"}`,
      ...input.stackTraces
        .slice(0, 3)
        .map(
          (t, i) =>
            `<stack_trace n="${i + 1}">\n${t.slice(0, 6000)}\n</stack_trace>`,
        ),
    ].join("\n"),
  };
}

export class AnthropicReleaseAi implements ReleaseAi {
  private async parse<T extends z.ZodType>(
    apiKey: string,
    prompt: { system: string; user: string },
    schema: T,
  ): Promise<z.infer<T>> {
    const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
    let response;
    try {
      response = await client.beta.messages.parse({
        model: REPLY_MODEL,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
        output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      });
    } catch (err) {
      if (
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError
      )
        throw new ReplyAiError("auth", "The Anthropic API key was rejected.");
      if (err instanceof Anthropic.RateLimitError)
        throw new ReplyAiError(
          "quota",
          "Claude is rate limited right now. Try again in a minute.",
        );
      if (err instanceof Anthropic.APIError)
        throw new ReplyAiError(
          "unavailable",
          `Claude couldn't answer (${err.status ?? "network"}).`,
        );
      throw err;
    }
    if (response.stop_reason === "refusal")
      throw new ReplyAiError("refused", "Claude declined this request.");
    if (!response.parsed_output)
      throw new ReplyAiError("unavailable", "Claude returned an empty answer.");
    return response.parsed_output as z.infer<T>;
  }

  async releaseNotes(apiKey: string, input: ReleaseNotesInput) {
    const out = await this.parse(apiKey, notesPrompt(input), notesSchema);
    const byLanguage = new Map(out.notes.map((n) => [n.language, n.text]));
    return input.languages.map((language) => ({
      language,
      text: (byLanguage.get(language) ?? "").trim().slice(0, input.maxLength),
    }));
  }

  async explainCrash(
    apiKey: string,
    input: CrashInput,
  ): Promise<CrashExplanation> {
    return this.parse(apiKey, crashPrompt(input), crashSchema);
  }
}
