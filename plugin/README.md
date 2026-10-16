# Store creatives plugin

A Claude Code plugin that turns a developer's Android app into Google Play screenshots and feature graphics. It runs entirely on the developer's machine: their Claude Code reads the repo and writes the store copy, their emulator provides the screens, and this package renders the images. The developer's own Claude subscription pays for the AI; we run nothing.

## How it works

```
/store-creatives:store-creatives [repo path]
  1. Claude reads the repo        → .store-creatives/product.json, cards.json, logo.png
  2. Claude captures the screens  → .store-creatives/screens/<screen>.png   (adb, or the user supplies them)
  3. render_preview               → one card in every style, index.html gallery; the user picks a style
  4. render_set                   → every card × language × size + feature graphics in .store-creatives/output/
```

The skill (`skills/store-creatives/SKILL.md`) is the workflow Claude follows, including the file formats and copy rules. The MCP server (`src/server.ts`) exposes the rendering tools. Claude does everything else (reading code, running Gradle and adb) with its own tools.

## MCP tools

| Tool | Does |
|---|---|
| `list_styles` | Screenshot styles, feature graphic styles and sizes |
| `check_project` | Validates `product.json`, the cards file, screenshots and logo; lists every problem |
| `render_preview` | One card in every style, a contact sheet and an `index.html` gallery |
| `render_set` | Chosen styles × languages × sizes, feature graphics and a contact sheet per set |

Styles: `callouts`, `light`, `bold`, `minimal`. Feature graphics: `dark`, `bold`. Sizes: `phone` 1080x1920, `tablet7` 1920x1080, `tablet10` 3840x2160. PNGs are flattened to RGB because Google Play rejects screenshots with alpha.

## Layout

| Path | Contents |
|---|---|
| `src/project.ts` | Loads and validates `.store-creatives` (zod), finds screenshots, lists problems |
| `src/jobs.ts` | Style and size catalog; expands cards into render jobs |
| `src/render.ts` | Remotion bundle and still rendering, flattening, contact sheets, preview page |
| `src/studio.ts` | `checkProject`, `renderPreview`, `renderSet` |
| `src/server.ts` | stdio MCP server |
| `templates/` | Remotion compositions `StoreCard` and `FeatureGraphic` (moved from money-shorts) with the bundled Montserrat font |
| `skills/store-creatives/` | The skill |
| `.claude-plugin/plugin.json`, `.mcp.json` | Plugin manifest and MCP server declaration |

Templates are React rendered by Remotion in headless Chrome. Remotion downloads Chrome Headless Shell on the first render.

## Develop

```bash
npm install
npm run build
npm test                 # unit tests
npm run test:render      # renders a real preview and set (about 30 s)
npm run studio           # Remotion Studio to edit templates
claude --plugin-dir .    # try the plugin in Claude Code
```

## Release

The repo stays private; only this folder is published.

1. CI publishes the package to npm (remove `"private": true` and choose the package name first). The package contains `dist`, `templates`, `skills`, `.claude-plugin` and `.mcp.json`.
2. A small public marketplace repo holds only `.claude-plugin/marketplace.json` pointing at the npm package:

```json
{
  "name": "<marketplace>",
  "owner": { "name": "<owner>" },
  "plugins": [
    { "name": "store-creatives", "source": { "source": "npm", "package": "<package>", "version": "^0.1.0" } }
  ]
}
```

3. Developers install with `/plugin marketplace add <owner>/<marketplace-repo>` and `/plugin install store-creatives@<marketplace>`.

Claude Code does not run install scripts for plugins. Our native dependencies (`sharp`, Remotion's compositor) ship prebuilt platform packages, so they work without them.

## Next steps

1. Platform link: a `store-creatives` backend module and `/store` web screens; the plugin uploads screens, previews and the final set through the existing MCP connector so the user picks the style in the web app and reuses the set in Meta app-install ads.
2. Device tools: emulator control as MCP tools (`device_screenshot`, `device_tap`, `ui_dump`) instead of raw adb in the skill.
3. Upload to Play Console through the Google Play Developer API with the developer's service account.

## Open questions

- Remotion license: Remotion is free for individuals and small companies, and larger companies need a company license. Each developer who installs the plugin runs Remotion, so check the current terms before release.
