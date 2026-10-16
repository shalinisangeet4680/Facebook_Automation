import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import sharp from "sharp";
import { z } from "zod";
import { ProjectError } from "../project.js";
import { DeviceController, DeviceError, Screen } from "./device.js";
import { KEYS, KeyName } from "./input.js";
import { compact } from "./ui.js";

const serial = z
  .string()
  .regex(/^[\w.:-]+$/)
  .optional()
  .describe(
    "Device serial from device_list; needed when several devices are connected",
  );
const observe = z
  .boolean()
  .describe("Return the screen after the action")
  .optional();
const settle = z.number().int().min(0).max(10_000).optional();

async function screenContent(
  screen: Screen,
  previewWidth: number,
  extra: Record<string, unknown> = {},
): Promise<CallToolResult["content"]> {
  const width = Math.min(previewWidth, screen.width);
  const preview = await sharp(screen.png)
    .resize({ width })
    .flatten({ background: "#000000" })
    .jpeg({ quality: 70 })
    .toBuffer();
  return [
    { type: "image", data: preview.toString("base64"), mimeType: "image/jpeg" },
    {
      type: "text",
      text: JSON.stringify({
        ...extra,
        serial: screen.serial,
        app: screen.focus,
        keyboard: screen.keyboard,
        ...(screen.locked
          ? {
              locked:
                "The lock screen is showing. If it asks for a PIN, pattern or password, ask the user to unlock the emulator or tell you the PIN.",
            }
          : {}),
        screen: { width: screen.width, height: screen.height },
        preview: { width, scale: Number((width / screen.width).toFixed(4)) },
        coordinates:
          "Element centers and x, y are device pixels. From the preview, divide by scale.",
        elements: screen.elements.map(compact),
      }),
    },
  ];
}

async function run(work: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const result = await work();
    if (Array.isArray(result))
      return { content: result as CallToolResult["content"] };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (e) {
    const known = e instanceof DeviceError || e instanceof ProjectError;
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: known
            ? (e as Error).message
            : `adb failed: ${(e as Error).message}`,
        },
      ],
    };
  }
}

export function registerDeviceTools(
  server: McpServer,
  device = new DeviceController(),
) {
  const after = async (
    result: { serial: string } & Record<string, unknown>,
    wantScreen: boolean | undefined,
    waitMs: number,
  ) => {
    if (!wantScreen) return result;
    const screen = await device.screen(result.serial, { waitMs });
    return screenContent(screen, 480, result);
  };

  server.registerTool(
    "device_list",
    {
      title: "List devices",
      description:
        "Connected Android devices and running emulators (serial, state, model, AVD) and the AVDs that can be started.",
      annotations: { readOnlyHint: true },
    },
    () => run(() => device.list()),
  );

  server.registerTool(
    "device_start_emulator",
    {
      title: "Start an emulator",
      description:
        "Boots an Android Virtual Device and waits until it is ready (up to 5 minutes on a cold boot). Returns its serial. If the AVD is already running, returns that emulator.",
      inputSchema: {
        avd: z.string().regex(/^[\w.-]+$/),
        headless: z.boolean().default(false).describe("Run without a window"),
      },
    },
    (a) => run(() => device.startEmulator(a.avd, { headless: a.headless })),
  );

  server.registerTool(
    "device_stop_emulator",
    {
      title: "Stop an emulator",
      description:
        "Shuts down a running emulator. Physical devices are never touched.",
      inputSchema: { serial: z.string().regex(/^emulator-\d+$/) },
      annotations: { destructiveHint: true },
    },
    (a) => run(() => device.stopEmulator(a.serial)),
  );

  server.registerTool(
    "device_install",
    {
      title: "Install an APK",
      description:
        "Installs or updates an APK on the device, granting its runtime permissions. Build it first, for example ./gradlew assembleDebug.",
      inputSchema: { serial, apk_path: z.string().min(1) },
    },
    (a) => run(() => device.install(a.serial, a.apk_path)),
  );

  server.registerTool(
    "device_launch",
    {
      title: "Launch the app",
      description:
        "Opens an installed app by package name (applicationId), optionally force-stopping it first.",
      inputSchema: {
        serial,
        package: z.string().regex(/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/),
        restart: z.boolean().default(false),
        observe: observe.default(true),
        wait_ms: settle.default(2_000),
      },
    },
    (a) =>
      run(async () =>
        after(
          await device.launch(a.serial, a.package, a.restart),
          a.observe,
          a.wait_ms,
        ),
      ),
  );

  server.registerTool(
    "device_demo_mode",
    {
      title: "Clean status bar",
      description:
        "Turns Android demo mode on (clock 9:41, full battery and signal, no notification icons) for store screenshots, or off when done.",
      inputSchema: { serial, on: z.boolean().default(true) },
    },
    (a) => run(() => device.demoMode(a.serial, a.on)),
  );

  server.registerTool(
    "device_screen",
    {
      title: "Look at the screen",
      description:
        "A preview image of the device screen plus its tappable and labelled elements (index, text, description, id, center in device pixels), the foreground app and whether the keyboard is open. Use wait_for to wait until some text appears, for example after a login.",
      inputSchema: {
        serial,
        wait_ms: settle.default(0),
        wait_for: z.string().min(1).max(100).optional(),
        timeout_ms: z.number().int().min(500).max(60_000).default(10_000),
        preview_width: z.number().int().min(240).max(1080).default(480),
      },
      annotations: { readOnlyHint: true },
    },
    (a) =>
      run(async () =>
        screenContent(
          await device.screen(a.serial, {
            waitMs: a.wait_ms,
            waitFor: a.wait_for,
            timeoutMs: a.timeout_ms,
          }),
          a.preview_width,
        ),
      ),
  );

  server.registerTool(
    "device_tap",
    {
      title: "Tap",
      description:
        "Taps an element from the last device_screen by index, the first element whose text, description or id matches text, or x, y in device pixels. Returns the new screen unless observe is false.",
      inputSchema: {
        serial,
        element: z.number().int().min(0).optional(),
        text: z.string().min(1).max(100).optional(),
        x: z.number().min(0).optional(),
        y: z.number().min(0).optional(),
        observe: observe.default(true),
        wait_ms: settle.default(800),
      },
    },
    (a) =>
      run(async () =>
        after(
          await device.tap(a.serial, {
            element: a.element,
            text: a.text,
            x: a.x,
            y: a.y,
          }),
          a.observe,
          a.wait_ms,
        ),
      ),
  );

  server.registerTool(
    "device_type",
    {
      title: "Type text",
      description:
        "Types ASCII text into the focused field (tap the field first). clear empties the field first; submit presses Enter.",
      inputSchema: {
        serial,
        text: z.string().min(1).max(500),
        clear: z.boolean().default(false),
        submit: z.boolean().default(false),
        observe: observe.default(false),
        wait_ms: settle.default(600),
      },
    },
    (a) =>
      run(async () =>
        after(
          await device.type(a.serial, a.text, {
            clear: a.clear,
            submit: a.submit,
          }),
          a.observe,
          a.wait_ms,
        ),
      ),
  );

  server.registerTool(
    "device_key",
    {
      title: "Press a key",
      description: `Presses a key: ${Object.keys(KEYS).join(", ")}. back also closes the keyboard.`,
      inputSchema: {
        serial,
        key: z.enum(Object.keys(KEYS) as [KeyName, ...KeyName[]]),
        observe: observe.default(true),
        wait_ms: settle.default(700),
      },
    },
    (a) =>
      run(async () =>
        after(await device.key(a.serial, a.key), a.observe, a.wait_ms),
      ),
  );

  server.registerTool(
    "device_swipe",
    {
      title: "Swipe or scroll",
      description:
        "scroll down shows content further down the page (the finger moves up); up, left and right likewise. Or pass from and to in device pixels.",
      inputSchema: {
        serial,
        scroll: z.enum(["up", "down", "left", "right"]).optional(),
        from: z.tuple([z.number(), z.number()]).optional(),
        to: z.tuple([z.number(), z.number()]).optional(),
        duration_ms: z.number().int().min(50).max(5_000).optional(),
        observe: observe.default(true),
        wait_ms: settle.default(700),
      },
    },
    (a) =>
      run(async () =>
        after(
          await device.swipe(a.serial, {
            scroll: a.scroll,
            from: a.from,
            to: a.to,
            durationMs: a.duration_ms,
          }),
          a.observe,
          a.wait_ms,
        ),
      ),
  );

  server.registerTool(
    "device_capture",
    {
      title: "Capture a store screen",
      description:
        "Saves the full-resolution screen as .store-creatives/screens/<name>.png for the card whose screen is name, closing the keyboard first. Returns a preview to check it.",
      inputSchema: {
        serial,
        project_path: z.string().min(1),
        name: z.string().regex(/^[A-Za-z0-9_-]+$/),
        hide_keyboard: z.boolean().default(true),
      },
    },
    (a) =>
      run(async () => {
        const shot = await device.capture(a.serial, a.project_path, a.name, {
          hideKeyboard: a.hide_keyboard,
        });
        const preview = await sharp(shot.png)
          .resize({ width: 360 })
          .flatten({ background: "#000000" })
          .jpeg({ quality: 70 })
          .toBuffer();
        return [
          {
            type: "image",
            data: preview.toString("base64"),
            mimeType: "image/jpeg",
          },
          {
            type: "text",
            text: JSON.stringify({
              serial: shot.serial,
              file: shot.file,
              size: `${shot.width}x${shot.height}`,
              ...(shot.portrait
                ? {}
                : {
                    warning:
                      "This screen is landscape; store cards need portrait screens.",
                  }),
            }),
          },
        ];
      }),
  );
}
