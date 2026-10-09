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

## 6. States everywhere

Loading uses skeletons shaped like the content. Errors show the backend message with a Retry action. Empty states explain what to do next.
