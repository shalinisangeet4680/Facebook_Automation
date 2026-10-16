# Play Store creatives

Google Play screenshots and feature graphics for a customer's Android app. The heavy work runs on the developer's machine through the `store-creatives` Claude Code plugin (`plugin/`): their Claude reads the repo, captures screens from their emulator and renders the images. The platform stores the project, lets the owner choose the style, and keeps the final set.

## Flow

```
Claude Code (developer's machine)                      Autopilot
──────────────────────────────────                     ─────────
reads repo, writes .store-creatives/
store_save_project (connector) ───────────────────────► project + upload token
upload_to_platform screens   ──── POST /store-uploads ─► screens
render_preview + upload preview ───────────────────────► previews     status: choosing
                                                         owner picks style, languages, sizes at /store/:id
store_get_project ◄─────────────────────────────────────  choice       status: style_chosen
render_set + upload set      ──────────────────────────► screenshots + feature graphics  status: rendered
                                                         download, or add to Creatives for app-install ads
```

Images never pass through the conversation. `store_save_project` returns a two-hour upload token; the plugin's `upload_to_platform` tool posts the files straight to the upload endpoint with it.

## API

| Endpoint | Auth | Purpose |
| - | - | - |
| `GET /api/v1/store-projects` | session | Projects with status, choice, counts and a cover image |
| `POST /api/v1/store-projects` | session | Create or update a project by slug; returns an upload token |
| `GET /api/v1/store-projects/:id` | session | Project with every asset and the style, size options |
| `PUT /api/v1/store-projects/:id/choice` | session | Save style, languages and sizes |
| `POST /api/v1/store-projects/:id/creatives` | session | Copy up to 24 screenshots or feature graphics to Creatives |
| `DELETE /api/v1/store-projects/:id` | session | Delete the project and its files |
| `POST /api/v1/store-uploads` | `X-Upload-Token` | Multipart upload: `kind`, `name`, `style`, `lang`, `size` fields first, then `file` |

Upload rules (`store.rules.ts`):
- `screen`: name only. `preview` and `screenshot`: style (`callouts`, `light`, `bold`, `minimal`), lang and size (`phone`, `tablet7`, `tablet10`). `feature_graphic`: style `dark` or `bold`.
- PNG, JPEG or WebP, at most 15 MB, 100 to 8000 pixels per side, 800 images per project.
- An upload with the same kind, name, style, lang and size replaces the earlier file.

## MCP tools

| Tool | Scope | Does |
| - | - | - |
| `store_get_project` | read | One project with the owner's choice and the next step, or the list |
| `store_save_project` | write | Create or update by slug, return the project url and an upload token |
| `store_start_upload` | write | A fresh token for an existing project |

## Data

`store_projects`: workspace, slug (unique per workspace), name, languages, status (`draft`, `choosing`, `style_chosen`, `rendered`), chosen style, languages and sizes, the SHA-256 hash of the current upload token and its expiry.

`store_assets`: project, kind, name, style, lang, size (empty strings when unused, so the variant key is unique), storage key, mime, size and bytes. Files use the `MediaStorage` port and are served from `/media/:key` like creatives.

## Security

- Upload tokens are random, stored only as hashes, scoped to one project and expire after two hours. Issuing a new one invalidates the previous one.
- The upload endpoint is public and external-client, like `/mcp`; the token is the only credential and is sent in a header, not the URL.
- The plugin only uploads to an `https` URL ending in `/api/v1/store-uploads` (plain `http` only for localhost).
- Projects and assets are scoped by workspace; another workspace gets 404.
