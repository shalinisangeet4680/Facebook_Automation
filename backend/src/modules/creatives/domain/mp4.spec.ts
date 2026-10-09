import { execFileSync } from "child_process";
import { existsSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { readMp4 } from "./mp4";

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("readMp4", () => {
  it("rejects non-video data", () => {
    expect(readMp4(Buffer.from("definitely not a video"))).toBeNull();
  });

  it.runIf(hasFfmpeg())("reads size and duration of a vertical video", () => {
    const file = join(tmpdir(), `reel-${Date.now()}.mp4`);
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=green:s=1080x1920:d=4",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        file,
      ],
      { stdio: "ignore" },
    );
    try {
      expect(readMp4(readFileSync(file))).toEqual({
        width: 1080,
        height: 1920,
        durationSeconds: 4,
      });
    } finally {
      if (existsSync(file)) rmSync(file);
    }
  });
});
