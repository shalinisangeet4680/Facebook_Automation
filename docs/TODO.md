# TreeVook AI: pending tasks and upcoming features

In order. **You** marks tasks only the owner can do (accounts, approvals, payments); the rest are build tasks.

## 1. Before real users can sign up

- [ ] Send sign-in codes by SMS. Today codes are only written to the server log (`LogOtpSender`). Pick a provider (MSG91, Twilio or Firebase) and add its sender.
- [x] Privacy Policy page (`/privacy`): Google Limited Use sentence, Meta data use, AI processing, deletion.
- [x] Terms of Service page (`/terms`).
- [x] Data deletion page or URL (needed for Meta App Review).
- [x] Link Privacy, Terms and Contact from the landing page footer and the sign-in page.
- [ ] **You:** fill in the registered office address, Grievance Officer name and court city in `web/src/features/legal/legal-page.tsx` (`LEGAL`), and have a lawyer review the three pages.
- [ ] Check the landing page at phone width (the stacked layout below 1100px is untested).
- [ ] **You:** email on the domain (e.g. hello@treevook.com) and verify treevook.com in Google Search Console.
- [ ] Deploy to treevook.com:
  - web, API, worker, Postgres and Redis;
  - point treevook.com and the product subdomains at the web app;
  - environment: `ROOT_URL`, `APP_URL`, `COOKIE_DOMAIN=.treevook.com`, `WEB_ORIGINS`, `ANTHROPIC_API_KEY`, production secrets;
  - run migrations.
- [ ] **You:** push `main` to the remote (nothing is pushed yet).

## 2. Google Business: approval track (time-bound, start now)

- [ ] **You:** finish verification of the TreeVook AI Business Profile (treevookllp@gmail.com). The 60-day clock starts at verification.
- [ ] **You:** add a logo, cover and a few product screenshots to the profile; confirm the phone number Google filled in.
- [ ] **You:** create a Google Cloud project for TreeVook (not `clinic-management-e1892`) and note its project number.
- [ ] **You:** when the profile is 60+ days old, submit the Business Profile API access form ("Application for Basic API Access").
- [ ] After approval:
  - enable the four Business Profile APIs;
  - set up the OAuth consent screen with `business.manage`;
  - record the demo video and submit for verification;
  - set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GBP_MOCK=false`;
  - test against real data.
- [ ] Add each production origin's redirect URI (`/api/v1/business/oauth/callback`) to the OAuth client.

## 3. Meta: approval track (start in parallel)

- [ ] **You:** Meta Business Verification for TreeVook LLP.
- [ ] Meta app set up for Facebook Login for Business and Instagram Login.
- [ ] App Review screencasts for each permission in `docs/social-autopost-plan.md` (needs the privacy policy and data deletion URL from step 1).

## 4. Instagram Autopost + Facebook Autopost (plan: `docs/social-autopost-plan.md`)

- [ ] Step 1: Social engine data model, Facebook/Instagram sign-in with a mock, multiple accounts.
- [ ] Step 2:
  - brand kit;
  - AI weekly calendar;
  - composer with live preview;
  - Auto / Approval / Manual;
  - publishing of image, carousel, Reel and Story.
- [ ] Step 3: analytics and best time to post.
- [ ] Step 4: AI comment replies on the shared engine.
- [ ] Step 5:
  - MCP tools;
  - add `instagram` and `facebook` to the product registry and subdomains;
  - remove "Coming soon" from the landing page;
  - docs.

## 5. Play Console: next products

- [ ] Play Releases:
  - staged rollouts with auto-halt on crash or ANR spikes;
  - AI release notes in every language.
- [ ] App health:
  - vitals and crash clusters;
  - Claude explains crashes and proposes fixes through the Claude Code plugin.
- [ ] Store listing manager: listing text in every language, published with the store creatives.
- [ ] Growth and revenue dashboard: installs, revenue and Meta ad spend → cost per install and ROAS.
- [ ] Monetisation manager: subscriptions, regional pricing, refund watch.
- [ ] Testing hub: tester lists and the 12-testers-for-14-days tracker.
- [ ] **You:** give the Play service account "View app information and download bulk reports" so review history imports (the bucket currently returns 403).

## 6. Google Business: later features

- [ ] Create and verify new Business Profiles for users (search first, claim existing, verification flow).
- [ ] MCP end-to-end test for the Google Business tools.

## 7. Platform cleanup

- [ ] Move workspace AI and Slack settings from the Play Reviews MCP page into the main Settings page (shared by every product).
- [ ] Unify reply templates (`play_templates` and `gbp_templates`) in the shared engine.
- [ ] Rename internal `replyly` folders and route group to `play-reviews`.
- [ ] Compute hero card positions from live heights instead of measured constants.
- [ ] One AI draft quota across products (each product counts separately today).
- [ ] Pricing and billing before early access ends (30 days' notice promised on the site).
