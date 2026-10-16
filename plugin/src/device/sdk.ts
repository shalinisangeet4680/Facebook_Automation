import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const exe = (name: string) =>
  process.platform === "win32" ? `${name}.exe` : name;

export function sdkRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  const home = homedir();
  return [
    env.ANDROID_HOME,
    env.ANDROID_SDK_ROOT,
    path.join(home, "Library", "Android", "sdk"),
    path.join(home, "Android", "Sdk"),
    env.LOCALAPPDATA
      ? path.join(env.LOCALAPPDATA, "Android", "Sdk")
      : undefined,
  ].filter((p): p is string => Boolean(p));
}

function onPath(name: string, env: NodeJS.ProcessEnv): string | null {
  for (const dir of (env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const file = path.join(dir, exe(name));
    if (existsSync(file)) return file;
  }
  return null;
}

export function findTool(
  tool: "adb" | "emulator",
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const sub = tool === "adb" ? "platform-tools" : "emulator";
  for (const root of sdkRoots(env)) {
    const file = path.join(root, sub, exe(tool));
    if (existsSync(file)) return file;
  }
  return onPath(tool, env);
}
