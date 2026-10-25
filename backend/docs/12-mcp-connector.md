# Claude connector (MCP)

A customer adds Autopilot to their own Claude (claude.ai, Desktop, mobile, Claude Code) as a custom connector. Claude then reads their Meta ads data and prepares changes through our tools, while the customer's Claude subscription pays for the AI. Our backend holds the Meta token, enforces guardrails and records every change.

This is "mode 3" of AI access. Platform AI (our key) and BYOK (customer's Anthropic key) come later and reuse the same `ads` application services.

## Requirements from Claude

Source: claude.com/docs/connectors/building/authentication (checked October 2026).

- Remote MCP over Streamable HTTP at one URL that users paste into Claude.
- OAuth 2.x authorization code flow with PKCE `S256` on every request.
- An unauthenticated call must get `401` with `WWW-Authenticate: Bearer resource_metadata="…"`.
- Protected resource metadata (RFC 9728): `resource` equals the MCP URL exactly; Claude uses only the first entry of `authorization_servers`.
- Authorization server metadata (RFC 8414) at the issuer's `/.well-known/oauth-authorization-server`.
- Client identity: Claude prefers a Client ID Metadata Document (CIMD) when the metadata advertises `client_id_metadata_document_supported: true` and `none` in `token_endpoint_auth_methods_supported`; otherwise it uses Dynamic Client Registration (RFC 7591). We support both.
- Redirect URIs: `https://claude.ai/api/mcp/auth_callback` for hosted apps; Claude Code uses `http://localhost:<any>/callback` and `http://127.0.0.1:<any>/callback`, matched with the port ignored.
- Token endpoint accepts `application/x-www-form-urlencoded`; registration accepts JSON.
- Refresh tokens rotate; invalid refresh returns `invalid_grant`. Claude refreshes on `401` and up to five minutes before expiry.
- Discovery, registration and token endpoints answer within 10 seconds, refresh within 30.
- Traffic comes from `160.79.104.0/21`.

## URLs

Everything is served on the web origin (`APP_URL`), so one domain covers the consent page and the API. Next.js rewrites the machine endpoints to the backend.

| URL | Served by | Purpose |
| - | - | - |
| `{APP_URL}/mcp` | backend | MCP endpoint (the URL users add to Claude) |
| `{APP_URL}/.well-known/oauth-protected-resource[/mcp]` | backend | RFC 9728 metadata |
| `{APP_URL}/.well-known/oauth-authorization-server` | backend | RFC 8414 metadata |
| `{APP_URL}/oauth/authorize` | web | Sign-in and consent screen |
| `{APP_URL}/oauth/token` | backend | Code exchange and refresh |
| `{APP_URL}/oauth/register` | backend | Dynamic client registration |
| `{APP_URL}/oauth/revoke` | backend | RFC 7009 token revocation |
| `/api/v1/oauth/authorization` (GET, POST) | backend | Consent screen data and decision, used by the web app |
| `/api/v1/connected-apps` (GET, DELETE `/:id`) | backend | List and disconnect Claude connections |

Locally `APP_URL` is a Cloudflare quick tunnel to the web dev server on port 3200. In production it is the app domain.

## Authorization server (`modules/oauth`)

### Clients

`oauth_clients` stores every client Claude uses.

- DCR: `POST /oauth/register` with `redirect_uris`, `client_name`, `token_endpoint_auth_method`. Public clients (`none`) get no secret; `client_secret_post` and `client_secret_basic` get a secret stored as a SHA-256 hash. Redirect URIs must be `https`, or `http` on `localhost` / `127.0.0.1`. The one custom scheme allowed is Cursor's exact `cursor://anysphere.cursor-mcp/oauth/callback`.
- CIMD: when `client_id` is an `https` URL we fetch the document (5 s timeout, 64 KB limit, no redirects, public hosts only), require its `client_id` to equal the URL, and cache it in the table for 24 hours. The document must support `none`: ChatGPT's (`https://chatgpt.com/oauth/client.json`) prefers `private_key_jwt` but also lists `none` in `token_endpoint_auth_methods_supported`, so it is stored as a public client and secured by PKCE. A token request that carries only a `client_assertion` (jwt-bearer) is matched to its client by the assertion's `iss`, for public clients only.

### Authorization

1. Claude opens `{APP_URL}/oauth/authorize?response_type=code&client_id&redirect_uri&code_challenge&code_challenge_method=S256&state&scope&resource`.
2. The web proxy sends signed-out users to `/login?next=…` and back.
3. The page calls `GET /api/v1/oauth/authorization?…`. The backend validates the client, redirect URI, PKCE, scope and resource, and returns the client name, redirect host, workspace and the requested permissions. If the client or redirect URI is invalid the page shows an error and never redirects.
4. The user chooses Allow or Cancel. `POST /api/v1/oauth/authorization` returns `redirectTo`, either with `code` and `state` or with `error=access_denied`.
5. The code is 32 random bytes, stored in Redis by hash for 60 seconds and consumed with `GETDEL`.

### Grants and tokens

- `oauth_grants`: one row per user, workspace and client, with scopes, `last_used_at` and `revoked_at`. Approving again reuses the active grant and widens its scopes.
- Access token: HS256 JWT, 1 hour, claims `{sub, typ: "mcp", wid, gid, cid, scope, aud: MCP URL}`. Every MCP request also checks that the grant is active, so disconnecting takes effect at once.
- Refresh token: 32 random bytes, stored hashed in `oauth_refresh_tokens`, 30 days, rotated on every use. Reusing a replaced token within 30 seconds returns `invalid_grant`; after that it revokes the grant.
- Scopes: `ads:read`, `ads:write`, `offline_access`. `ads:write` is optional on the consent screen.

## MCP server (`modules/mcp`)

- `POST /mcp`: stateless Streamable HTTP. A new `McpServer` and transport are created per request with `enableJsonResponse`; `GET` and `DELETE` return `405`.
- Bearer token checked before the SDK runs. Missing or invalid gives `401` with `WWW-Authenticate: Bearer resource_metadata="{APP_URL}/.well-known/oauth-protected-resource/mcp"`. A missing scope gives `403` with `error="insufficient_scope"`.
- Tools are registered only for the scopes the token carries, and every tool calls the `ads` application service, never Meta directly.
- Tool errors return `isError: true` with a plain message Claude can relay. They are never thrown as protocol errors.
- Rate limits: 120 MCP requests a minute per grant.

### Tools

| Tool | Scope | Effect |
| - | - | - |
| `get_account_overview` | read | Business, ad account (currency, time zone, status, spend cap), Page, Instagram, Pixel, connection health |
| `get_performance` | read | Insights by account, campaign, ad set or ad; presets or a date range; optional daily rows; spend, reach, impressions, frequency, clicks, CTR, CPC, CPM, results and cost per result |
| `list_campaigns` | read | Campaigns with objective, status, budgets and dates |
| `get_campaign` | read | One campaign with its ad sets (targeting, optimisation, budget) and ads (creative text, link, image, status) |
| `check_tracking` | read | Pixel last fire time and event counts for the last 24 hours and 7 days, with warnings |
| `search_targeting` | read | Look up city, region and interest keys for targeting |
| `create_campaign_draft` | write | Campaign, ad set, creative and ad created in Meta, all `PAUSED` |
| `pause` | write | Pause a campaign, ad set or ad immediately |
| `activate` | write | Two-step: returns a summary and `confirm_token`; runs only when called again with that token |
| `update_daily_budget` | write | Two-step, like `activate` |

### Guardrails

- Nothing Claude creates spends money until the user activates it with a confirmation token.
- A confirmation token is bound to the workspace, action and arguments; it lasts 10 minutes and can be used once.
- The daily budget per campaign or ad set is capped at `ADS_MAX_DAILY_BUDGET` in the account currency (default 10,000).
- Drafts with identical arguments within 10 minutes return the first result instead of creating a duplicate.
- Every write is audited as the user, with `data.via = "claude"` and the client name.
- Meta validation errors are returned to Claude as text so it can fix its request.

## Ads application (`modules/ads`)

`AdsService` resolves the workspace's Meta token and primary assets and calls the `MetaAds` port. The real implementation shares the Graph transport (retry, throttling, usage headers) with the connection client. The mock (`META_MOCK=true`) keeps an in-memory account with campaigns, insights and pixel stats so the whole flow works without Meta.

Money in Meta budgets is in the currency's minor unit. Tools take and return major units and convert using the currency offset.

## Web

- `/oauth/authorize`: a consent screen in the auth layout. It shows the client name and redirect host, the workspace and its Meta business, the permissions (read always, changes optional) and the Allow and Cancel buttons.
- `/settings/claude`: how to connect (copy the MCP URL, steps for claude.ai and Claude Code), plus the connected apps list with last use and Disconnect.
- `/business/mcp` (Google Business) and `/reviews/mcp` (Play Reviews) share one setup component: server URL, the workspace access token (`rk_live_…`, reveal, rotate), the posting switch and connected clients, with steps per client:
  - ChatGPT: Settings → Apps & Connectors → Advanced → Developer mode, then a connector with the MCP URL and OAuth. ChatGPT registers with DCR or CIMD and redirects to `https://chatgpt.com/connector/oauth/{id}`.
  - Claude (claude.ai, Desktop, mobile): Settings → Connectors → Add custom connector with the MCP URL (OAuth).
  - Claude Code: `claude mcp add --transport http <name> <url>`, then `/mcp` to sign in (OAuth).
  - Cursor (`~/.cursor/mcp.json`), VS Code (`.vscode/mcp.json`) and other clients (`mcp-remote` over stdio): the URL with an `Authorization: Bearer rk_live_…` header.
- Every client reaches the same server and tool set; the token or grant decides the workspace.
- The proxy keeps the query string in `next`, and its matcher excludes `mcp`, `.well-known` and `oauth/token|register|revoke`.

## Testing

- Unit tests: PKCE verification, redirect URI matching, scope parsing, confirmation tokens, money conversion.
- e2e (mock Meta): metadata documents, DCR, CIMD with a stubbed fetch, the full code flow with PKCE, refresh rotation and reuse, the `401` challenge, tool listing by scope, read tools, a draft that ends up paused, activate refused without a token and accepted with it, and disconnect blocking further calls.
- Manual: Cloudflare tunnel, add the connector in claude.ai, run a real conversation.
