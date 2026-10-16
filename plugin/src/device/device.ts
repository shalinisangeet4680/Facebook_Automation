import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PROJECT_DIR, SCREEN_EXTENSIONS } from "../project.js";
import {
  DEMO_COMMANDS,
  KEYS,
  KeyName,
  inputTextArg,
  swipePath,
  textProblem,
} from "./input.js";
import { findTool } from "./sdk.js";
import { UiElement, findByText, parseHierarchy } from "./ui.js";

export type Runner = (
  file: string,
  args: string[],
  timeoutMs: number,
) => Promise<Buffer>;

export type Spawner = (file: string, args: string[]) => void;

export class DeviceError extends Error {}

const defaultRun: Runner = (file, args, timeoutMs) =>
  new Promise((resolve, reject) =>
    execFile(
      file,
      args,
      { encoding: "buffer", timeout: timeoutMs, maxBuffer: 128 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = Buffer.from(stderr).toString().trim() || err.message;
          reject(new DeviceError(detail.split("\n").slice(-3).join(" ")));
        } else resolve(Buffer.from(stdout));
      },
    ),
  );

const defaultSpawn: Spawner = (file, args) =>
  spawn(file, args, { detached: true, stdio: "ignore" }).unref();

const PACKAGE = /^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/;
const AVD = /^[\w.-]+$/;
const NAME = /^[A-Za-z0-9_-]+$/;

export interface DeviceInfo {
  serial: string;
  state: string;
  model: string;
  emulator: boolean;
}

export interface Screen {
  serial: string;
  png: Buffer;
  width: number;
  height: number;
  elements: UiElement[];
  focus: string | null;
  keyboard: boolean;
  locked: boolean;
}

export type TapTarget = {
  element?: number;
  text?: string;
  x?: number;
  y?: number;
};

export class DeviceController {
  private readonly run: Runner;
  private readonly spawnDetached: Spawner;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly elements = new Map<string, UiElement[]>();
  private readonly sizes = new Map<string, { width: number; height: number }>();

  constructor(
    private readonly tools: { adb: string | null; emulator: string | null } = {
      adb: findTool("adb"),
      emulator: findTool("emulator"),
    },
    deps: {
      run?: Runner;
      spawn?: Spawner;
      sleep?: (ms: number) => Promise<void>;
      now?: () => number;
    } = {},
  ) {
    this.run = deps.run ?? defaultRun;
    this.spawnDetached = deps.spawn ?? defaultSpawn;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = deps.now ?? Date.now;
  }

  private adbPath(): string {
    if (!this.tools.adb)
      throw new DeviceError(
        "adb not found. Install Android SDK platform-tools or set ANDROID_HOME.",
      );
    return this.tools.adb;
  }

  private async adb(serial: string | null, args: string[], timeoutMs = 20_000) {
    return this.run(
      this.adbPath(),
      serial ? ["-s", serial, ...args] : args,
      timeoutMs,
    );
  }

  private async shell(serial: string, command: string, timeoutMs = 20_000) {
    return (await this.adb(serial, ["shell", command], timeoutMs)).toString();
  }

  async devices(): Promise<DeviceInfo[]> {
    const out = (await this.adb(null, ["devices", "-l"])).toString();
    return out
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [serial = "", state = "", ...rest] = line.split(/\s+/);
        const model =
          rest
            .find((r) => r.startsWith("model:"))
            ?.slice(6)
            .replace(/_/g, " ") ?? "";
        return {
          serial,
          state,
          model,
          emulator: serial.startsWith("emulator-"),
        };
      });
  }

  async avds(): Promise<string[]> {
    if (!this.tools.emulator) return [];
    const out = (
      await this.run(this.tools.emulator, ["-list-avds"], 20_000)
    ).toString();
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => AVD.test(l));
  }

  async list() {
    const [devices, avds] = await Promise.all([this.devices(), this.avds()]);
    const running = await Promise.all(
      devices
        .filter((d) => d.emulator && d.state === "device")
        .map(async (d) => ({
          serial: d.serial,
          avd: await this.avdName(d.serial),
        })),
    );
    return {
      devices: devices.map((d) => ({
        ...d,
        ...(d.emulator
          ? { avd: running.find((r) => r.serial === d.serial)?.avd ?? null }
          : {}),
      })),
      avds,
      emulatorAvailable: Boolean(this.tools.emulator),
    };
  }

  async resolve(serial?: string): Promise<string> {
    let devices = await this.devices();
    if (serial) {
      for (
        let waited = 0;
        waited < 15_000 &&
        devices.find((x) => x.serial === serial)?.state === "offline";
        waited += 1_000
      ) {
        await this.sleep(1_000);
        devices = await this.devices();
      }
      const d = devices.find((x) => x.serial === serial);
      if (!d) throw new DeviceError(`No device ${serial}. Call device_list.`);
      if (d.state === "unauthorized")
        throw new DeviceError(
          `${serial} is not authorized. Ask the user to accept the USB debugging prompt on the phone.`,
        );
      if (d.state !== "device")
        throw new DeviceError(`${serial} is ${d.state}.`);
      return serial;
    }
    const online = devices.filter((d) => d.state === "device");
    if (online.length === 1) return online[0]!.serial;
    if (!online.length)
      throw new DeviceError(
        "No device is running. Start an emulator with device_start_emulator (device_list shows the AVDs).",
      );
    throw new DeviceError(
      `Several devices are connected (${online.map((d) => `${d.serial} ${d.model}`.trim()).join(", ")}). Pass serial.`,
    );
  }

  private async avdName(serial: string): Promise<string | null> {
    try {
      const out = (
        await this.adb(serial, ["emu", "avd", "name"], 5_000)
      ).toString();
      return out.split(/\r?\n/)[0]?.trim() || null;
    } catch {
      return null;
    }
  }

  async startEmulator(
    avd: string,
    options: { headless?: boolean; timeoutMs?: number } = {},
  ) {
    if (!AVD.test(avd)) throw new DeviceError("Invalid AVD name.");
    if (!this.tools.emulator)
      throw new DeviceError(
        "The Android emulator was not found. Install it with the SDK Manager or set ANDROID_HOME.",
      );
    const avds = await this.avds();
    if (!avds.includes(avd))
      throw new DeviceError(
        `No AVD named ${avd}. Available: ${avds.join(", ") || "none; create one in Android Studio"}.`,
      );
    const before = await this.devices();
    for (const d of before.filter((x) => x.emulator && x.state === "device"))
      if ((await this.avdName(d.serial)) === avd) {
        await this.wake(d.serial);
        return { serial: d.serial, avd, alreadyRunning: true };
      }
    const known = new Set(before.map((d) => d.serial));
    this.spawnDetached(this.tools.emulator, [
      "-avd",
      avd,
      "-netdelay",
      "none",
      "-netspeed",
      "full",
      ...(options.headless ? ["-no-window", "-no-audio"] : []),
    ]);
    const deadline = this.now() + (options.timeoutMs ?? 300_000);
    let serial: string | null = null;
    let stable = 0;
    while (this.now() < deadline) {
      await this.sleep(2_000);
      if (!serial) {
        const fresh = (await this.devices()).filter(
          (d) => d.emulator && !known.has(d.serial),
        );
        for (const d of fresh)
          if (d.state === "device" && (await this.avdName(d.serial)) === avd)
            serial = d.serial;
        if (!serial) continue;
      }
      const ready = await this.shell(
        serial,
        "getprop sys.boot_completed; getprop init.svc.bootanim",
        5_000,
      ).catch(() => "");
      const [booted, animation] = ready.trim().split(/\s+/);
      if (booted === "1" && animation === "stopped") {
        if (++stable < 2) continue;
        await this.wake(serial);
        return { serial, avd, alreadyRunning: false };
      }
      stable = 0;
    }
    throw new DeviceError(
      `${avd} did not finish booting in time. It may still be starting; call device_list in a minute.`,
    );
  }

  async stopEmulator(serial: string) {
    if (!serial.startsWith("emulator-"))
      throw new DeviceError(
        "Only emulators can be stopped, not physical devices.",
      );
    await this.resolve(serial);
    await this.adb(serial, ["emu", "kill"]);
    return { stopped: serial };
  }

  async install(serialArg: string | undefined, apk: string) {
    const serial = await this.resolve(serialArg);
    const file = path.resolve(apk);
    if (!file.endsWith(".apk") || !existsSync(file))
      throw new DeviceError(
        `No APK at ${file}. Build it first, for example ./gradlew assembleDebug.`,
      );
    const out = (
      await this.adb(serial, ["install", "-r", "-t", "-g", file], 300_000)
    ).toString();
    if (!out.includes("Success"))
      throw new DeviceError(out.trim() || "Install failed.");
    return { serial, installed: file };
  }

  async launch(serialArg: string | undefined, pkg: string, restart = false) {
    if (!PACKAGE.test(pkg)) throw new DeviceError("Invalid package name.");
    const serial = await this.resolve(serialArg);
    await this.wake(serial);
    if (restart) await this.shell(serial, `am force-stop ${pkg}`);
    const out = await this.shell(
      serial,
      `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`,
    );
    if (/No activities found|monkey aborted/i.test(out))
      throw new DeviceError(
        `${pkg} is not installed or has no launcher activity.`,
      );
    return { serial, launched: pkg };
  }

  private async wake(serial: string) {
    await this.shell(
      serial,
      `input keyevent ${KEYS.wakeup}; wm dismiss-keyguard`,
    ).catch(() => "");
  }

  async demoMode(serialArg: string | undefined, on: boolean) {
    const serial = await this.resolve(serialArg);
    const broadcast = (args: string[]) =>
      this.shell(
        serial,
        [
          "am",
          "broadcast",
          "-a",
          "com.android.systemui.demo",
          "-e",
          "command",
          ...args,
        ].join(" "),
      );
    if (on) {
      await this.shell(serial, "settings put global sysui_demo_allowed 1");
      await broadcast(["enter"]);
      for (const c of DEMO_COMMANDS) await broadcast(c);
    } else await broadcast(["exit"]);
    return { serial, demoMode: on };
  }

  private async screenshot(serial: string) {
    const png = await this.adb(serial, ["exec-out", "screencap", "-p"], 30_000);
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height)
      throw new DeviceError(
        "The screenshot could not be read. Is the screen on?",
      );
    return { png, width: meta.width, height: meta.height };
  }

  private async dumpXml(serial: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const out = await this.shell(
        serial,
        "uiautomator dump /data/local/tmp/sc_window.xml",
        30_000,
      ).catch((e: Error) => `ERROR ${e.message}`);
      if (!/ERROR/i.test(out))
        return (
          await this.adb(serial, [
            "exec-out",
            "cat",
            "/data/local/tmp/sc_window.xml",
          ])
        ).toString();
      await this.sleep(600);
    }
    return "";
  }

  private async hierarchy(
    serial: string,
    size: { width: number; height: number },
  ) {
    return parseHierarchy(await this.dumpXml(serial), size);
  }

  private async windowState(serial: string) {
    const out = await this.shell(
      serial,
      "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp|isKeyguardShowing'",
    ).catch(() => "");
    const m = /(?:mCurrentFocus|mFocusedApp)=.*?\s([\w.]+\/[\w.$]+)/.exec(out);
    return {
      focus: m?.[1] ?? null,
      locked: /isKeyguardShowing=true/.test(out),
    };
  }

  private async keyboardShown(serial: string) {
    const out = await this.shell(
      serial,
      "dumpsys input_method | grep -E 'mInputShown|isInputViewShown'",
    ).catch(() => "");
    return /mInputShown=true|isInputViewShown=true/.test(out);
  }

  async screen(
    serialArg?: string,
    options: { waitMs?: number; waitFor?: string; timeoutMs?: number } = {},
  ): Promise<Screen> {
    const serial = await this.resolve(serialArg);
    await this.wake(serial);
    if (options.waitMs) await this.sleep(options.waitMs);
    const deadline = this.now() + (options.timeoutMs ?? 10_000);
    for (;;) {
      const [shot, xml] = await Promise.all([
        this.screenshot(serial),
        this.dumpXml(serial),
      ]);
      const elements = parseHierarchy(xml, shot);
      const found = !options.waitFor || findByText(elements, options.waitFor);
      if (found || this.now() >= deadline) {
        this.elements.set(serial, elements);
        this.sizes.set(serial, { width: shot.width, height: shot.height });
        const [{ focus, locked }, keyboard] = await Promise.all([
          this.windowState(serial),
          this.keyboardShown(serial),
        ]);
        if (!found)
          throw new DeviceError(
            `"${options.waitFor}" did not appear within ${Math.round((options.timeoutMs ?? 10_000) / 1000)} s. Call device_screen to see what is showing.`,
          );
        return { serial, ...shot, elements, focus, keyboard, locked };
      }
      await this.sleep(700);
    }
  }

  private async size(serial: string) {
    const known = this.sizes.get(serial);
    if (known) return known;
    const out = await this.shell(serial, "wm size");
    const m = /(?:Override|Physical) size: (\d+)x(\d+)/.exec(
      out.split("\n").reverse().join("\n"),
    );
    if (!m) throw new DeviceError("Could not read the screen size.");
    const size = { width: Number(m[1]), height: Number(m[2]) };
    this.sizes.set(serial, size);
    return size;
  }

  async tap(serialArg: string | undefined, target: TapTarget) {
    const serial = await this.resolve(serialArg);
    let x: number;
    let y: number;
    let label: string;
    if (target.element !== undefined) {
      const el = this.elements.get(serial)?.[target.element];
      if (!el)
        throw new DeviceError(
          `No element ${target.element} on the last screen. Call device_screen first.`,
        );
      [x, y] = el.center;
      label = el.text || el.desc || el.id || el.type;
    } else if (target.text) {
      let el = findByText(this.elements.get(serial) ?? [], target.text);
      if (!el) {
        const size = await this.size(serial);
        const fresh = await this.hierarchy(serial, size);
        this.elements.set(serial, fresh);
        el = findByText(fresh, target.text);
      }
      if (!el)
        throw new DeviceError(
          `Nothing labelled "${target.text}" is on screen. Call device_screen and tap by element or coordinates.`,
        );
      [x, y] = el.center;
      label = el.text || el.desc || el.id;
    } else if (target.x !== undefined && target.y !== undefined) {
      const size = await this.size(serial);
      if (
        target.x < 0 ||
        target.y < 0 ||
        target.x >= size.width ||
        target.y >= size.height
      )
        throw new DeviceError(
          `(${target.x}, ${target.y}) is off screen; the screen is ${size.width}x${size.height} device pixels.`,
        );
      [x, y] = [Math.round(target.x), Math.round(target.y)];
      label = `(${x}, ${y})`;
    } else throw new DeviceError("Pass element, text, or x and y.");
    await this.shell(serial, `input tap ${x} ${y}`);
    return { serial, tapped: label, at: [x, y] as [number, number] };
  }

  async type(
    serialArg: string | undefined,
    text: string,
    options: { clear?: boolean; submit?: boolean } = {},
  ) {
    const problem = textProblem(text);
    if (problem) throw new DeviceError(problem);
    const serial = await this.resolve(serialArg);
    if (options.clear) {
      const size = await this.size(serial);
      const focused = (await this.hierarchy(serial, size)).find(
        (e) => e.focused,
      );
      const length = Math.min(focused?.text.length ?? 0, 200);
      if (length)
        await this.shell(
          serial,
          `input keyevent ${KEYS.move_end} ${Array(length).fill(KEYS.delete).join(" ")}`,
        );
    }
    await this.shell(serial, `input text ${inputTextArg(text)}`);
    if (options.submit)
      await this.shell(serial, `input keyevent ${KEYS.enter}`);
    return { serial, typed: text.length };
  }

  async key(serialArg: string | undefined, key: KeyName) {
    const serial = await this.resolve(serialArg);
    await this.shell(serial, `input keyevent ${KEYS[key]}`);
    return { serial, key };
  }

  async swipe(
    serialArg: string | undefined,
    input: {
      scroll?: "up" | "down" | "left" | "right";
      from?: [number, number];
      to?: [number, number];
      durationMs?: number;
    },
  ) {
    const serial = await this.resolve(serialArg);
    const size = await this.size(serial);
    const coords = input.scroll
      ? swipePath(input.scroll, size)
      : input.from && input.to
        ? ([...input.from, ...input.to] as [number, number, number, number])
        : null;
    if (!coords) throw new DeviceError("Pass scroll, or from and to.");
    const duration = Math.min(Math.max(input.durationMs ?? 350, 50), 5_000);
    await this.shell(
      serial,
      `input swipe ${coords.map(Math.round).join(" ")} ${duration}`,
    );
    return { serial, swiped: coords };
  }

  async capture(
    serialArg: string | undefined,
    projectPath: string,
    name: string,
    options: { hideKeyboard?: boolean } = {},
  ) {
    if (!NAME.test(name))
      throw new DeviceError(
        "name must be letters, digits, - or _ (the card's screen name).",
      );
    const root = path.resolve(projectPath);
    if (!existsSync(root))
      throw new DeviceError(`Project path ${root} does not exist.`);
    const serial = await this.resolve(serialArg);
    if ((options.hideKeyboard ?? true) && (await this.keyboardShown(serial))) {
      await this.shell(serial, `input keyevent ${KEYS.back}`);
      await this.sleep(600);
    }
    const shot = await this.screenshot(serial);
    const dir = path.join(root, PROJECT_DIR, "screens");
    await mkdir(dir, { recursive: true });
    for (const ext of SCREEN_EXTENSIONS)
      if (ext !== ".png")
        await rm(path.join(dir, `${name}${ext}`), { force: true });
    const file = path.join(dir, `${name}.png`);
    await writeFile(file, shot.png);
    return { serial, file, ...shot, portrait: shot.height > shot.width };
  }
}
