export const KEYS = {
  back: 4,
  home: 3,
  enter: 66,
  tab: 61,
  delete: 67,
  forward_delete: 112,
  escape: 111,
  app_switch: 187,
  search: 84,
  move_end: 123,
  page_up: 92,
  page_down: 93,
  wakeup: 224,
} as const;

export type KeyName = keyof typeof KEYS;

export function textProblem(text: string): string | null {
  if (!text) return "text is empty";
  if (text.length > 500) return "text is longer than 500 characters";
  if (!/^[\x20-\x7e]*$/.test(text))
    return "adb can only type ASCII characters. Ask the user to type other characters on the emulator, or paste them in the app.";
  if (text.includes("%s"))
    return 'adb types "%s" as a space; leave it out or ask the user to type it';
  return null;
}

export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function inputTextArg(text: string): string {
  return shellQuote(text.replace(/ /g, "%s"));
}

export function swipePath(
  scroll: "up" | "down" | "left" | "right",
  screen: { width: number; height: number },
): [number, number, number, number] {
  const cx = Math.round(screen.width / 2);
  const cy = Math.round(screen.height / 2);
  const dy = Math.round(screen.height * 0.3);
  const dx = Math.round(screen.width * 0.35);
  switch (scroll) {
    case "down":
      return [cx, cy + dy, cx, cy - dy];
    case "up":
      return [cx, cy - dy, cx, cy + dy];
    case "right":
      return [cx + dx, cy, cx - dx, cy];
    case "left":
      return [cx - dx, cy, cx + dx, cy];
  }
}

export const DEMO_COMMANDS: string[][] = [
  ["clock", "-e", "hhmm", "0941"],
  ["battery", "-e", "level", "100", "-e", "plugged", "false"],
  ["network", "-e", "wifi", "show", "-e", "level", "4"],
  [
    "network",
    "-e",
    "mobile",
    "show",
    "-e",
    "level",
    "4",
    "-e",
    "datatype",
    "none",
  ],
  ["notifications", "-e", "visible", "false"],
  [
    "status",
    "-e",
    "bluetooth",
    "hide",
    "-e",
    "location",
    "hide",
    "-e",
    "alarm",
    "hide",
    "-e",
    "volume",
    "hide",
  ],
];
