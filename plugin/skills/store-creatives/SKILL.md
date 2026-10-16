---
name: store-creatives
description: Make Google Play screenshots and feature graphics for the user's Android app. Reads the app's repo to write the store copy, captures or collects the app's screens, previews every style so the user can choose, then renders the full set in every language and size. Use when the user wants Play Store or app store screenshots, a feature graphic, or store listing creatives.
---

# Store creatives

You turn the user's app into a Google Play screenshot set with the `store-creatives` MCP tools: `list_styles`, `check_project`, `render_preview`, `render_set` and `upload_to_platform`. Reading code, capturing and rendering run on the user's machine.

If the Autopilot connector is available (its tools include `store_save_project`), the project also lives in Autopilot: the user chooses the style there, downloads the set, and can reuse the screenshots in ads. Without the connector, do everything locally and skip the Autopilot steps; mention once that connecting Autopilot lets them choose styles and keep the set in their workspace.

Project path: use the path the user gave ($ARGUMENTS), otherwise the current working directory. Always pass it as an absolute `project_path`.

All inputs live in `<project>/.store-creatives/`:

```
.store-creatives/
  product.json      brand: name, colours, tagline, screens that need a drawn status bar
  cards.json        one entry per store screenshot: headline, callouts, which screen
  screens/          portrait screenshots, named <screen>.png|jpg|webp
  logo.png          optional app icon (square)
  output/           rendered images (gitignored)
```

## 1. Check what exists

Call `check_project`. If it reports problems, fix them and check again. If the folder is missing, go to step 2; otherwise skip to step 3 when the screenshots are already there.

## 2. Understand the app and write the files

Read the repo before asking the user anything:
- App name: `android:label` in `AndroidManifest.xml`, resolved through `res/values/strings.xml`.
- Languages: the `res/values-<lang>/strings.xml` folders. Offer those languages; English first.
- Brand colours: `res/values/colors.xml`, `themes.xml`, or the Compose theme (`Color.kt`, `Theme.kt`). Pick a dark background, a mid tone, a deep tone, a glow, and the main accent.
- Logo: the largest `mipmap-*/ic_launcher*.png` or `.webp`, copied to `.store-creatives/logo.png`. If the icon is only an adaptive XML icon, leave the logo out; a letter mark is drawn instead.
- Features and screens: navigation graphs, Compose `NavHost` routes, activities and fragments, and the README. Choose the 5 to 8 screens that sell the app best, most important first.

Write `product.json`:

```json
{
  "name": "Acme",
  "wordmark": ["Ac", "me"],
  "tagline": "Run your shop from your phone",
  "store": "Google Play",
  "colors": { "bg": "#1B2536", "bg2": "#2A3A55", "bgDeep": "#141C2A", "glow": "#6C8EC4", "accent": "#4CC46A", "onAccent": "#1B2536", "text": "#FFFFFF", "muted": "#DDE6EE", "danger": "#FF5A5F" },
  "screens": {}
}
```

`wordmark` has one or two parts; the second part is drawn in the accent colour. Colours are `#RRGGBB`. Add `"screens": { "<screen>": { "statusBar": { "bg": "#ffffff", "dark": false } } }` only for screenshots cropped without a status bar; full device screenshots already have one.

Write `cards.json`:

```json
[
  {
    "file": "01_home",
    "screen": "home",
    "headline": { "en": ["Your shop,", "at a glance"], "hi": ["Aapki dukaan,", "ek nazar mein"] },
    "sub": { "en": "Sales and stock in one place" },
    "callouts": [
      { "tag": "SALES", "tone": "green", "x": 24, "y": 640, "text": { "en": ["Today's sales", "& orders"], "hi": ["Aaj ki sales", "aur orders"] } },
      { "tag": "ALERTS", "tone": "red", "x": 616, "y": 980, "text": { "en": ["Low stock", "warnings"], "hi": ["Kam stock", "ki chetavni"] } }
    ]
  }
]
```

Copy rules:
- Headline: 2 lines, about 16 characters per line. Say what the user gets, not what the screen is.
- Callouts: 2 to 4 per card, a 1-word uppercase `tag` and 2 short lines of text, each about 18 characters.
- Tones: `blue`, `red`, `teal`, `green`, `amber`, `purple`. Vary them within a card.
- Callout positions are on a 1080x1920 canvas; the phone covers x 200 to 880 from y 400 down. Alternate left (`x: 24`) and right (`x: 616`) and spread `y` between 560 and 1700 so cards don't cover the most important part of the screen.
- Every language in `headline` needs the same language in each callout's `text` and in `sub`.
- Google Play rejects rankings, awards, prices, promotions and "download now" style calls to action in screenshots. Only claim what the app does.

Show the user the card list (screen, headline, callouts) and adjust it before capturing anything.

**Autopilot:** call `store_save_project` with the app name and the card languages. Keep `projectId`, `url`, `upload_url` and `upload_token` for the next steps. Tokens last two hours; if an upload says the token expired, call `store_start_upload` with the project id and retry.

## 3. Get the screenshots

Each card's `screen` needs `.store-creatives/screens/<screen>.png`. Ask the user which way they prefer:

**They provide them.** They drop the files into `screens/` with the right names.

**Capture from an emulator or device.** Check `adb devices`. If none is running, list AVDs with `emulator -list-avds` and start one in the background with `emulator -avd <name>`, then `adb wait-for-device`. Install the app the way the project builds it, usually `./gradlew installDebug`, and ask for any test login. Make the status bar clean:

```bash
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e mobile show -e level 4 -e datatype none
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
```

For each screen, get there (ask the user to navigate, or tap yourself: `adb exec-out uiautomator dump /dev/tty` shows element bounds, `adb shell input tap <x> <y>` taps, `adb shell input text` types). Capture with `adb exec-out screencap -p > .store-creatives/screens/<screen>.png`, then look at the image. Retake it if it shows a loading state, an empty list, an error, a keyboard, personal data, or a different screen. Empty screens sell badly, so ask the user to add sample data when needed. When done, exit demo mode with `adb shell am broadcast -a com.android.systemui.demo -e command exit`.

**Autopilot:** upload the screens with `upload_to_platform` and `parts: ["screens"]`.

## 4. Let the user choose a style

Run `check_project` until it has no problems. Call `render_preview` (it renders the first card in every style; pass `card` or `lang` to preview another).

**Autopilot:** upload the previews with `upload_to_platform` and `parts: ["preview"]`, give the user the project `url`, and ask them to choose the style, languages and sizes there and tell you when they're done. Then read the choice with `store_get_project` and go to step 5.

**Locally:** open the returned `page` for the user (`open <page>` on macOS, `xdg-open <page>` on Linux), describe the styles in one line each from `list_styles`, and ask which style they want (recommend `callouts` when the cards have good callouts), plus which languages and sizes (`phone`, `tablet7`, `tablet10`). Preview the tablet sizes with `size: "tablet7"` if they want tablets.

## 5. Render the set

Call `render_set` with the chosen `styles`, `langs` and `sizes`. It also renders two feature graphics (`dark` and `bold`, 1024x500).

**Autopilot:** upload with `upload_to_platform`, `parts: ["set"]` and the same `styles`, `langs` and `sizes`. Report any `failed` files. Tell the user the set is in Autopilot at the project `url`, where they can download it or add screenshots to Creatives for app-install ads.

Show the user a contact sheet from the result, give them the output folder, and remind them:
- Play needs 2 to 8 phone screenshots per language; upload them in card order.
- Tablet screenshots are needed only if the app supports tablets.
- Pick one feature graphic.

Edit `cards.json` and re-render only what changed with `only` when the user wants a change.
