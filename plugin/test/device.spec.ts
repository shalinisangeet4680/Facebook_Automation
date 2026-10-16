import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { DeviceController, Runner } from "../src/device/device.js";
import { inputTextArg, swipePath, textProblem } from "../src/device/input.js";
import { findByText, parseHierarchy } from "../src/device/ui.js";

const XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">
<node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.acme" content-desc="" clickable="false" enabled="true" focused="false" scrollable="false" password="false" checkable="false" checked="false" bounds="[0,0][1080,2400]">
<node index="0" text="Sign in &amp; continue" resource-id="com.acme:id/sign_in" class="android.widget.Button" package="com.acme" content-desc="" clickable="true" enabled="true" focused="false" scrollable="false" password="false" checkable="false" checked="false" bounds="[100,1800][980,1920]" />
<node index="1" text="secret" resource-id="com.acme:id/password" class="android.widget.EditText" package="com.acme" content-desc="" clickable="true" enabled="true" focused="true" scrollable="false" password="true" checkable="false" checked="false" bounds="[100,1500][980,1620]" />
<node index="2" text="" resource-id="" class="android.view.View" package="com.acme" content-desc="Open menu" clickable="true" enabled="true" focused="false" scrollable="false" password="false" checkable="false" checked="false" bounds="[0,-40][120,80]" />
<node index="3" text="Hidden" resource-id="" class="android.widget.TextView" package="com.acme" content-desc="" clickable="false" enabled="true" focused="false" scrollable="false" password="false" checkable="false" checked="false" bounds="[0,0][0,0]" />
<node index="4" text="" resource-id="com.acme:id/list" class="androidx.recyclerview.widget.RecyclerView" package="com.acme" content-desc="" clickable="false" enabled="true" focused="false" scrollable="true" password="false" checkable="false" checked="false" bounds="[0,200][1080,1400]" />
<node index="5" text="Notifications" resource-id="" class="android.widget.Switch" package="com.acme" content-desc="" clickable="true" enabled="false" focused="false" scrollable="false" password="false" checkable="true" checked="true" bounds="[0,1400][1080,1480]" />
<node index="6" text="Sign in with Google" resource-id="" class="android.widget.TextView" package="com.acme" content-desc="" clickable="false" enabled="true" focused="false" scrollable="false" password="false" checkable="false" checked="false" bounds="[100,1940][980,2000]" />
</node></hierarchy>`;

describe("parseHierarchy", () => {
  it("keeps labelled and interactive elements with clipped bounds", () => {
    const els = parseHierarchy(XML, { width: 1080, height: 2400 });
    expect(els.map((e) => e.text || e.desc || e.id)).toEqual([
      "Sign in & continue",
      "••••••",
      "Open menu",
      "list",
      "Notifications",
      "Sign in with Google",
    ]);
    expect(els[0]).toMatchObject({
      id: "sign_in",
      type: "Button",
      center: [540, 1860],
    });
    expect(els[1]).toMatchObject({ focused: true, type: "EditText" });
    expect(els[2]!.bounds).toEqual([0, 0, 120, 80]);
    expect(els[4]).toMatchObject({ checked: true, enabled: false });
  });

  it("finds exact labels before partial ones and prefers clickable", () => {
    const els = parseHierarchy(XML, { width: 1080, height: 2400 });
    expect(findByText(els, "sign in & continue")?.id).toBe("sign_in");
    expect(findByText(els, "sign in")?.id).toBe("sign_in");
    expect(findByText(els, "google")?.text).toBe("Sign in with Google");
    expect(findByText(els, "menu")?.desc).toBe("Open menu");
    expect(findByText(els, "nothing here")).toBeNull();
  });
});

describe("input helpers", () => {
  it("quotes text for adb input", () => {
    expect(inputTextArg("it's a test")).toBe(`'it'\\''s%sa%stest'`);
    expect(inputTextArg("a;b$(rm)")).toBe(`'a;b$(rm)'`);
  });

  it("rejects text adb can't type", () => {
    expect(textProblem("नमस्ते")).toContain("ASCII");
    expect(textProblem("50%sale")).toContain("%s");
    expect(textProblem("hello@example.com")).toBeNull();
  });

  it("scrolls down by moving the finger up", () => {
    expect(swipePath("down", { width: 1080, height: 2400 })).toEqual([
      540, 1920, 540, 480,
    ]);
  });
});

async function png(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
}

type Fake = {
  devices: string;
  avds?: string;
  handlers?: [RegExp, (args: string) => string | Buffer][];
};

function fakeAdb(state: Fake) {
  const calls: string[] = [];
  const run: Runner = async (file, args) => {
    const joined = args.join(" ");
    calls.push(`${path.basename(file)} ${joined}`);
    if (path.basename(file) === "emulator")
      return Buffer.from(state.avds ?? "");
    if (joined === "devices -l")
      return Buffer.from(`List of devices attached\n${state.devices}\n`);
    for (const [pattern, reply] of state.handlers ?? [])
      if (pattern.test(joined)) {
        const out = reply(joined);
        return typeof out === "string" ? Buffer.from(out) : out;
      }
    return Buffer.from("");
  };
  return { run, calls };
}

const tools = {
  adb: "/sdk/platform-tools/adb",
  emulator: "/sdk/emulator/emulator",
};
const PHONE =
  "R9ZY610W45N\tdevice usb:1-1 product:a05 model:SM_E055F device:a05m";
const EMU = "emulator-5554\tdevice product:sdk model:sdk_gphone64_arm64";

describe("DeviceController", () => {
  it("never guesses between several devices", async () => {
    const { run } = fakeAdb({ devices: `${PHONE}\n${EMU}` });
    const device = new DeviceController(tools, { run });
    await expect(device.resolve()).rejects.toThrow(
      "Several devices are connected (R9ZY610W45N SM E055F, emulator-5554 sdk gphone64 arm64). Pass serial.",
    );
    expect(await device.resolve("emulator-5554")).toBe("emulator-5554");
  });

  it("explains missing and unauthorized devices", async () => {
    const none = new DeviceController(tools, {
      run: fakeAdb({ devices: "" }).run,
    });
    await expect(none.resolve()).rejects.toThrow("device_start_emulator");
    const locked = new DeviceController(tools, {
      run: fakeAdb({ devices: "R9ZY610W45N\tunauthorized usb:1-1" }).run,
    });
    await expect(locked.resolve("R9ZY610W45N")).rejects.toThrow(
      "USB debugging",
    );
  });

  it("boots an AVD and waits for it to finish", async () => {
    let polls = 0;
    let spawned: string[] = [];
    const state: Fake = {
      devices: PHONE,
      avds: "Pixel_10\nSmall_Phone\n",
      handlers: [
        [/emu avd name/, () => "Pixel_10\r\nOK\r\n"],
        [
          /getprop sys.boot_completed/,
          () => (++polls < 3 ? "1\nrunning\n" : "1\nstopped\n"),
        ],
      ],
    };
    const { run, calls } = fakeAdb(state);
    let clock = 0;
    const device = new DeviceController(tools, {
      run,
      spawn: (_file, args) => {
        spawned = args;
        state.devices = `${PHONE}\n${EMU}`;
      },
      sleep: async () => {
        clock += 2_000;
      },
      now: () => clock,
    });
    const started = await device.startEmulator("Pixel_10", { headless: true });
    expect(started).toEqual({
      serial: "emulator-5554",
      avd: "Pixel_10",
      alreadyRunning: false,
    });
    expect(spawned).toEqual(
      expect.arrayContaining(["-avd", "Pixel_10", "-no-window"]),
    );
    expect(
      calls.some((c) => c.includes("input keyevent 224; wm dismiss-keyguard")),
    ).toBe(true);

    const again = await device.startEmulator("Pixel_10");
    expect(again.alreadyRunning).toBe(true);
    await expect(device.startEmulator("Nope")).rejects.toThrow(
      "Available: Pixel_10, Small_Phone",
    );
  });

  it("waits for an emulator that is briefly offline", async () => {
    const state: Fake = { devices: "emulator-5554\toffline" };
    const { run } = fakeAdb(state);
    let naps = 0;
    const device = new DeviceController(tools, {
      run,
      sleep: async () => {
        if (++naps === 3) state.devices = EMU;
      },
    });
    expect(await device.resolve("emulator-5554")).toBe("emulator-5554");
    expect(naps).toBe(3);
  });

  it("refuses to stop a physical device", async () => {
    const device = new DeviceController(tools, {
      run: fakeAdb({ devices: PHONE }).run,
    });
    await expect(device.stopEmulator("R9ZY610W45N")).rejects.toThrow(
      "Only emulators",
    );
  });

  it("reads the screen and taps elements by index, text or coordinates", async () => {
    const shot = await png(1080, 2400);
    const { run, calls } = fakeAdb({
      devices: EMU,
      handlers: [
        [/screencap/, () => shot],
        [
          /uiautomator dump/,
          () => "UI hierchary dumped to: /data/local/tmp/sc_window.xml",
        ],
        [/cat .*sc_window.xml/, () => XML],
        [
          /mCurrentFocus/,
          () =>
            "  mCurrentFocus=Window{1f u0 com.acme/com.acme.MainActivity}\n    isKeyguardShowing=false",
        ],
        [/input_method/, () => "  mInputShown=true"],
      ],
    });
    const device = new DeviceController(tools, {
      run,
      sleep: async () => undefined,
    });
    const screen = await device.screen();
    expect(screen).toMatchObject({
      serial: "emulator-5554",
      width: 1080,
      height: 2400,
      focus: "com.acme/com.acme.MainActivity",
      keyboard: true,
      locked: false,
    });
    expect(screen.elements).toHaveLength(6);

    expect(await device.tap(undefined, { element: 0 })).toMatchObject({
      tapped: "Sign in & continue",
      at: [540, 1860],
    });
    expect(await device.tap(undefined, { text: "open menu" })).toMatchObject({
      at: [60, 40],
    });
    await device.tap(undefined, { x: 10.4, y: 20.6 });
    expect(calls.filter((c) => c.includes("input tap"))).toEqual([
      "adb -s emulator-5554 shell input tap 540 1860",
      "adb -s emulator-5554 shell input tap 60 40",
      "adb -s emulator-5554 shell input tap 10 21",
    ]);
    await expect(device.tap(undefined, { x: 2000, y: 10 })).rejects.toThrow(
      "off screen",
    );
    await expect(device.tap(undefined, { element: 99 })).rejects.toThrow(
      "No element 99",
    );
  });

  it("waits for text and reports when it never appears", async () => {
    const shot = await png(1080, 2400);
    let dumps = 0;
    const { run } = fakeAdb({
      devices: EMU,
      handlers: [
        [/screencap/, () => shot],
        [/uiautomator dump/, () => "dumped"],
        [
          /cat .*sc_window.xml/,
          () => (++dumps < 3 ? "<hierarchy></hierarchy>" : XML),
        ],
      ],
    });
    let clock = 0;
    const device = new DeviceController(tools, {
      run,
      sleep: async (ms) => {
        clock += ms;
      },
      now: () => clock,
    });
    const screen = await device.screen(undefined, { waitFor: "Notifications" });
    expect(screen.elements.length).toBeGreaterThan(0);
    await expect(
      device.screen(undefined, { waitFor: "Dashboard", timeoutMs: 2_000 }),
    ).rejects.toThrow('"Dashboard" did not appear');
  });

  it("clears the focused field before typing and quotes the text", async () => {
    const { run, calls } = fakeAdb({
      devices: EMU,
      handlers: [
        [/wm size/, () => "Physical size: 1080x2400"],
        [/uiautomator dump/, () => "dumped"],
        [/cat .*sc_window.xml/, () => XML],
      ],
    });
    const device = new DeviceController(tools, {
      run,
      sleep: async () => undefined,
    });
    await device.type(undefined, "o'neil shop", { clear: true, submit: true });
    const input = calls.filter((c) => c.includes("input "));
    expect(input).toEqual([
      "adb -s emulator-5554 shell input keyevent 123 67 67 67 67 67 67",
      "adb -s emulator-5554 shell input text 'o'\\''neil%sshop'",
      "adb -s emulator-5554 shell input keyevent 66",
    ]);
  });

  it("captures a full-resolution screen into the project and replaces an older copy", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "device-capture-"));
    const screens = path.join(root, ".store-creatives", "screens");
    await mkdir(screens, { recursive: true });
    await writeFile(path.join(screens, "home.jpg"), "old");
    const shot = await png(1080, 2400);
    const { run, calls } = fakeAdb({
      devices: EMU,
      handlers: [
        [/screencap/, () => shot],
        [/input_method/, () => "mInputShown=true"],
      ],
    });
    const device = new DeviceController(tools, {
      run,
      sleep: async () => undefined,
    });
    const result = await device.capture(undefined, root, "home");
    expect(result).toMatchObject({ width: 1080, height: 2400, portrait: true });
    expect(existsSync(path.join(screens, "home.png"))).toBe(true);
    expect(existsSync(path.join(screens, "home.jpg"))).toBe(false);
    expect(calls).toContain("adb -s emulator-5554 shell input keyevent 4");
    await expect(device.capture(undefined, root, "../x")).rejects.toThrow(
      "name must be",
    );
  });

  it("turns demo mode on with a clean status bar", async () => {
    const { run, calls } = fakeAdb({ devices: EMU });
    const device = new DeviceController(tools, { run });
    await device.demoMode(undefined, true);
    const shell = calls.filter((c) => c.includes(" shell "));
    expect(shell[0]).toContain("settings put global sysui_demo_allowed 1");
    expect(shell.some((c) => c.includes("command clock -e hhmm 0941"))).toBe(
      true,
    );
    expect(shell).toHaveLength(8);
  });
});
