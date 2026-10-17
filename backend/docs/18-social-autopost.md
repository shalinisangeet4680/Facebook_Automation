# Instagram Autopost and Facebook Autopost

Two products on one social engine (`src/modules/social-engine`), built the way Play Reviews and Google Business share the review engine. Instagram Autopost lives at `/instagram` (`instagram.treevook.com`) and Facebook Autopost at `/facebook` (`facebook.treevook.com`). The API is under `/api/v1/autopost`.

## How it connects

| Sign-in | For | Scopes |
|---|---|---|
| Facebook Login for Business | Facebook Pages, and Instagram professional accounts linked to a Page | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `business_management` |
| Instagram API with Instagram Login | Instagram professional accounts without a Page | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights` |

`POST /autopost/oauth/start` returns the Meta dialog URL and sets an httpOnly `tv_autopost_state` cookie with a nonce. The `state` parameter is encrypted and carries the workspace, user, origin (allow-listed with `allowedOrigin`), product, sign-in type and expiry. `GET /autopost/oauth/callback` only accepts a state whose nonce matches the cookie, exchanges the code for a long-lived token, and imports every Page and Instagram account found. Several Pages and accounts per workspace are supported.

Tokens are encrypted with `TOKEN_ENCRYPTION_KEY` in `social_accounts.token_ciphertext`. Page tokens from a long-lived user token don't expire; Instagram Login tokens last 60 days and are refreshed when fewer than 10 days are left. An account whose token is revoked is marked `error`, and both apps show a reconnect banner.

The system-user token in Setup stays the way the Meta Ads product connects; it isn't used here.

### Mock mode

With `META_MOCK=true` the deterministic `MockSocialApi` replaces the Graph API: signing in with Facebook gives two Pages (one with a linked Instagram account), signing in with Instagram gives a third account, each with 12 past posts, comments of every class, daily insights and follower counts. A caption containing `#fail` is rejected, `#reported` marks the post as reported, and a reply containing `FAIL_ON_META` fails. `AI_MOCK=true` swaps Claude for deterministic captions, brand kits and replies.

## Data

| Table | What |
|---|---|
| `social_accounts` | Platform, sign-in type, external id, name, username, Page id, token ciphertext and expiry, status, followers, settings, best times, sync times, safety pause |
| `brand_kits` | One per workspace, optionally one per account |
| `social_plans` | One weekly plan per account and week |
| `social_autoposts` | Posts: account, plan, format, content type, caption, hashtags, first comment, alt text, media, link, status (`draft`, `pending_approval`, `scheduled`, `publishing`, `published`, `failed`, `cancelled`), mode, held reason, external id |
| `social_post_metrics` | Daily snapshot per post: reach, impressions, likes, comments, shares, saves, video plays |
| `social_account_metrics` | Daily snapshot per account: followers, profile visits, reach, impressions |
| `social_comments`, `social_comment_replies` | Synced comments with their class, and reply drafts with the engine's reply statuses |

The plan proposed extending `social_posts`; that table belongs to the Meta Ads organic posting flow, so autopost posts have their own table.

## Brand kit

Business type, audience, voice, topics, offers, hashtag sets, banned words, logo, colours, fonts, call to action, link, website, city and language. `POST /autopost/brand-kit/prefill` reads the website (https only, private addresses refused) and the account's recent captions and asks Claude for a kit. Banned words never auto-publish.

## Calendar, modes and safeguards

`POST /autopost/plans` plans a week for an account: festivals in that week first (an Indian festival list for 2026 and 2027 lives in `domain/calendar.ts`), then a rotating mix of tips, products, behind the scenes, offers, testimonials and announcements, one post a day at the account's best hour. Each post gets a caption, hashtags, first comment and alt text from the engine's post writer (`POST_AI`, Claude or the mock), and image formats get brand-template PNGs rendered from SVG through the creatives module. Reels wait for an uploaded video. Planning the same week again replaces its unpublished posts. Each Sunday the worker plans the next week for accounts with the weekly plan on.

Each content type has a mode:

- Auto: scheduled straight away, unless a safeguard holds it for approval.
- Approval: waits in the calendar until the owner approves it.
- Manual: saved as a draft idea for the owner to finish.

Safeguards: a daily and weekly limit on posts, quiet hours (posts move to the end of them), never-auto words, banned words, and a safety pause of three days when engagement on the latest posts drops below 40% of the baseline or a post is reported. A pause moves scheduled automatic posts and replies back to approval. Instagram's 100 API posts per 24 hours is enforced at publish time.

## Formats

| Instagram | Facebook |
|---|---|
| Image, carousel (2–10 images or videos), Reel, Story (image or video up to 60 s) | Image, multi-image (2–10 images), video or Reel, text, link |

First comment, alt text, collaborators (Instagram, up to 3) and location id are passed where the API supports them. The worker tick (`autopost` queue, every minute) publishes due posts, retries Meta outages up to three times, and records failures on the post.

## Analytics and best time

Every day the worker snapshots post metrics for posts from the last 30 days and account metrics for the last week, so trends keep working past Meta's history window. Best time to post is learned from engagement rate by weekday and hour once 6 posts have metrics; until then category defaults are used (clinics 10 am and 6 pm, restaurants noon and 7 pm, and so on). The calendar schedules into those hours. `GET /autopost/insights` returns totals against the previous period, follower growth, top posts, results by format and content type, comment reply rate and recommendations. On Monday mornings a weekly digest goes to the workspace Slack webhook.

## Comment replies

Comments on the last 14 days of posts sync every 15 minutes. Each is classified as question, praise, complaint, spam or other, and the engine's `decide()` runs on it with the class mapped to a rating, so modes, quiet hours, the daily automatic limit, never-auto words and the safety pause behave as they do for reviews. Drafts come from the engine's `REPLY_AI` on the `social` channel, with templates as a fallback. Spam is hidden on Facebook and never answered. Complaints go to Slack. Comments found when an account is connected always wait for approval.

## MCP tools

Read tools (any grant): `list_social_accounts`, `get_brand_kit`, `list_social_calendar`, `get_social_insights`, `list_social_comments`.

Write tools (changes allowed): `update_brand_kit` (two-step), `plan_social_week`, `create_social_post` (draft or approval saved directly; publish now or schedule two-step) and `reply_to_social_comment` (two-step; saved for approval when the owner hasn't allowed agents to post).

## Before launch

1. Meta Business Verification for TreeVook LLP.
2. App Review for advanced access to every scope above, with a screencast per permission; the privacy policy and data deletion URL are on treevook.com.
3. Add an Instagram product (Instagram API with Instagram Login) to the Meta app.
4. Add `https://<each web origin>/api/v1/autopost/oauth/callback` as a valid OAuth redirect URI in both Facebook Login for Business and Instagram Login.
5. Set `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` and `META_MOCK=false`. Media URLs must be public https (`APP_URL`), because Meta downloads images and videos from them.
