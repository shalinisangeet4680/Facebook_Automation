# Screens and flows

## 1. Login (`/login`)

Split layout on desktop: a brand panel on the left with an animated product preview (approval cards sliding in: "Launch 6 ads · ₹1,000/day", "Ad B cost per lead ↓ 32%", "Paused Ad D · no results"), the form on the right. On phones, the form only.

**Phone step:** +91 prefix, 10-digit input with live formatting, Continue button. Errors from the backend show under the field.

**Code step:** six boxes with auto-advance, backspace navigation, paste of the full code, `autocomplete="one-time-code"`, auto-submit on the sixth digit, resend countdown (30 s), "Change number" link, attempts-left message on wrong code.

## 2. App shell

Sidebar: logo, navigation (Setup, Campaigns, Creatives, Inbox, Reports, Settings; future items show a "Soon" badge and are disabled), workspace name at the bottom. Top bar: page title, theme toggle, user menu (phone number, sign out). Collapses to a drawer on small screens.

## 3. Setup overview (`/setup`)

A progress ring (completed / total), the step list from `GET /onboarding` with status icons (done, current, upcoming, coming soon), and a large card for the current step with its primary action.

## 4. Connect Meta (`/setup/connect-meta`)

Two columns on desktop.

**Left — animated guide.** A browser-frame illustration that replays each step from `GET /meta/requirements`: Business settings opening, the app creation dialog, adding a system user with the Admin role, ticking assets, generating the token with the permissions list ticking, and copying the token. A moving cursor and highlight rings point at each click. Step chips below the frame let users jump between steps; it auto-advances every 5 s and pauses on hover. Reduced motion shows static frames.

**Right — instructions and token.**
- The current step's title and description, with an "Open in Meta" button where the step has a link.
- A permissions card listing required and recommended permissions with a "Copy all" button.
- The token field (masked, paste button, character count) and Connect button.
- On submit, a verification panel animates through the checks from the response (Token, System user, Permissions, Ad accounts, Facebook Pages, Instagram, Datasets) with passed, warning, and failed states and the backend's messages. On failure, the failed rows explain the fix and the form stays editable. On success, a confirmation with the system user name and discovered assets, and a Continue button.

## 5. Choose accounts (`/setup/accounts`)

One section per asset kind (ad account, Page, Instagram, dataset) with radio cards showing name, ID, and key details (currency and spend cap, Page category, Instagram username, dataset last activity). Pre-selected primaries come from the API. Save calls `PUT /meta/assets/selection`, then returns to `/setup`. A "Refresh from Meta" action starts the background job and shows its progress.

## 6. Use with Claude (`/claude`)

This page explains how to use Autopilot from your own Claude plan:
- the connector URL with a copy button
- steps for the Claude apps, and the `claude mcp add` command for Claude Code
- example prompts
- connected apps with their access level, when each was last used, and Disconnect
- the built-in guardrails, including the daily budget limit

## 7. Consent (`/oauth/authorize`)

Claude sends people here during OAuth. If they are signed out, the proxy sends them to `/login?next=…` and back.

The card shows:
- the app name and the host it will return to
- the workspace and ad account
- read access, which is always included
- an optional "Prepare and manage campaigns" permission

The person chooses Allow or Cancel, and the app sends them back to Claude with a full-page redirect. If the request is invalid, the card shows an error and never redirects. If the redirect goes to a loopback address, a warning appears.

## 8. Campaigns (`/campaigns`, `/campaigns/plans/:id`)

The list shows plans proposed by Claude, with their status and a prompt to copy for asking Claude for a new plan.

The review page shows the name, summary and expected results, then a section each for Goal, Audience, Budget and Ad, each with Claude's "Why". Every setting can be edited:
- locations and interests through targeting search
- alternative ad texts swap in with "Use this"
- a live ad preview
- the image link, with Claude's image idea as a hint

A sticky footer holds Discard, Save, Create in Meta (paused) and Launch. Launch opens a confirmation dialog that shows the daily and monthly spend. After a plan is created, its fields are read-only and the page links to Ads Manager.

## 9. Inbox (`/inbox`)

The Inbox has three parts:
- **Waiting for you:** plans to review and failed posts.
- **Suggestions:** grouped by severity (urgent, needs attention, opportunity). Each shows its evidence and Apply, Snooze or Dismiss. The page explains the 7:30 daily check.
- **Check now:** runs the rules immediately.

## 10. Creatives (`/creatives`)

The **Images** tab:
- grid of uploaded and Claude-designed images
- drag and drop upload
- Post, copy link and delete on each image

**Post** opens a dialog:
- choose Facebook and/or Instagram (an unavailable platform says why)
- write a caption per platform, with counters
- post now or schedule
- a review step before anything goes public

The **Posts** tab shows posts from Autopilot with their status, links and errors, and lets you cancel scheduled posts. It also lists recent posts from the Page and Instagram with likes and comments.

## 11. Reports (`/reports`)

The page shows:
- **Period selector:** 7, 14 or 30 days, this month or last month.
- **KPI tiles:** spend, results, cost per result with the target badge, and link CTR, each with the change against the previous period.
- **Secondary metrics:** reach, impressions, clicks and CPM.
- **Charts:** daily spend and daily results, as bar charts with tooltips and a table for screen readers.
- **Tables:** campaigns, with an "above / within target" mark, and the five best ads.

## 12. Settings (`/settings`)

Settings has four sections:
- **Workspace name, daily limit and targets:** the daily limit per campaign (capped by the platform limit), the monthly budget and the target cost per result.
- **Profile:** name and email.
- **Connections:** Meta and Claude.
- **Sign out everywhere.**

## 13. Store listing (`/store`, `/store/:id`)

The list shows each app's store listing project with its cover, status and languages. With no projects it explains how to start: connect Claude, install the store-creatives plugin and run `/store-creatives:store-creatives` in the app's folder.

A project page has:
- **Choose a style:** one preview per style as large radio tiles, language and size toggles, and a save button. After saving, a card tells the user to go back to Claude Code, with a request to copy.
- **Your store set:** screenshots filtered by style, language and size, in upload order, each with a download link and a checkbox; selected images go to Creatives. Feature graphics below.
- **Screens:** the captured screens.

The page polls every 4 seconds until the set is uploaded, so images appear while the plugin uploads them.

## 14. Review replies — Replyly (`/reviews/*`)

The Autopilot sidebar's Review replies link opens Replyly, a full-screen section with its own look: warm off-white background, Instrument Serif headings, Geist and Geist Mono, a 220px sidebar (Dashboard with a pending count, Apps, Templates, MCP), and at the bottom Back to Autopilot and the workspace with its app count. On phones the sidebar becomes a scrolling top bar. Toasts are a dark pill at the bottom centre. Code lives in `src/features/replyly`; styles are in `replyly.css`, scoped to `.rp`.

- **Connect (`/reviews/connect`):** three steps (create a service account, invite it in Play Console, upload the key and verify). Verifying animates key → API → Play Console access, and stops at the step that failed with the fix (`invalid_key`, `api_disabled`, `no_permission` from the API's error details). The illustration on the right follows the step. When an account is already connected it opens on step 2, with a card to add one app by package name. Without a connection, the dashboard and apps redirect here and the other sections are disabled.
- **Dashboard (`/reviews`):** an app dropdown (All apps or one app, a themed Radix select) and a period picker — 7d / 30d / 90d, All (since the first review, no comparison) or Custom (a from–to popover with This month, Last month and This year shortcuts, dates in the app's time zone) — that scope everything below; ranges over 92 days chart weekly, over two years monthly; a greeting with how many reviews need a reply and how many drafts are ready; five stats for the period (needs reply, replies and time saved, reply rate, average rating, median response) with changes against the period before; reviews vs replies with the average rating; Needs you (apps with waiting reviews or problems such as missing permission, lost connection, safety pause or failed posts); the latest reviews waiting; the rating mix; and topics with their change. It replaces the old Inbox and Analytics pages.
- **Apps (`/reviews/apps`):** summary line, Sync now (syncs each app in turn with a striped progress bar and review count) and Add app, then a table: app tile, package, rating, awaiting, mode chip (Auto, Approval, Manual, Mixed, Needs access, plus Safety pause), 14-day replies sparkline, and the auto-reply switch.
- **App (`/reviews/:id`):** opens on Reviews — this app's reviews with Needs reply / Replied / All, review cards (reviewer, stars, topic, translation, draft editor with Skip / Rewrite / Approve & post, Retry for failed posts, who replied, Undo for skips), Approve all, and an All caught up state. Overview (`?tab=overview`) has the 30-day stats, reviews vs replies chart (hover tooltip, table for screen readers), rating mix, See reviews for this app, then rating by version, languages and Import older reviews (paste the Play Console reports URI once, then Import from Play Console; a CSV upload stays as a fallback). Settings (`?tab=settings`) has Reply mode cards, Rules by rating (mode and template per star, or AI-written), Behavior switches, posting delay and voice, then an Advanced divider with keyword rules (run first), placeholder values, safeguards, AI & integrations (AI drafting mode and own key, Slack webhook and channel) and Remove app. An app without reply permission shows the 403 state with Check again and Copy service account email. Banners show a safety pause (Resume now) and lost connections.
- **Templates (`/reviews/templates`):** Yours and Pre-built lists with their ratings; the editor has the name, Use for rating chips, language and wording switches, the body with placeholder chips, a 350-character count and a Google Play preview. Pre-built templates are read-only and can be duplicated; your templates save as you type.
- **MCP (`/reviews/mcp`):** server URL, the workspace access token (reveal, rotate with a 10-minute grace period), the Allow agents to post replies switch, config snippets for Claude Desktop, Cursor and Claude Code, the tools, and connected clients with Revoke.

## 15. States everywhere

Loading uses skeletons shaped like the content. Errors show the backend message with a Retry action. Empty states explain what to do next.
