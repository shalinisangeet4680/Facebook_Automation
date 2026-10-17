export const RELEASE_AI = Symbol("RELEASE_AI");

export interface ReleaseNotesInput {
  appName: string;
  versionName: string | null;
  changelog: string;
  languages: string[];
  maxLength: number;
}

export interface CrashInput {
  appName: string;
  packageName: string;
  type: "CRASH" | "ANR";
  cause: string;
  location: string;
  stackTraces: string[];
  devices: string[];
  androidVersions: number[];
  versionCodes: string[];
  files: string[];
}

export interface CrashExplanation {
  summary: string;
  cause: string;
  fix: string;
  files: string[];
}

export interface ReleaseAi {
  releaseNotes(
    apiKey: string,
    input: ReleaseNotesInput,
  ): Promise<{ language: string; text: string }[]>;
  explainCrash(apiKey: string, input: CrashInput): Promise<CrashExplanation>;
}
