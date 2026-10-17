# Plan: Instagram Autopost and Facebook Autopost

Status: built against `META_MOCK` (see `backend/docs/18-social-autopost.md`); waiting for Meta Business Verification and App Review.

Two products, one shared Social engine, built the same way Play Reviews and Google Business share the review engine.

| Product | Path | Standalone host |
|---|---|---|
| Instagram Autopost | `/instagram` | `instagram.treevook.com` |
| Facebook Autopost | `/facebook` | `facebook.treevook.com` |

## What exists today (reuse)

- Organic publishing of one image or one Reel to the primary Facebook Page and Instagram account, now or scheduled (`backend/src/modules/social`, `meta/infrastructure/graph-publishing.client.ts`).
- Separate Facebook and Instagram captions with limits (`social/domain/post.rules.ts`), delayed BullMQ jobs, retries, cancel and per-platform status.
- Creatives library and SVG → PNG rendering (`creatives` module, `save_ad_creative` MCP tool).
- Two-step MCP confirmation and the `publish_post` tool.
- The review engine (`modules/engine`): per-rule auto/approval/manual decisions, safeguards, Claude drafting, Slack alerts. Comment replies reuse it.

## Connection (decided: Facebook and Instagram sign-in)

- Facebook Login for Business (OAuth) for Pages and Instagram accounts linked to a Page. Scopes: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `business_management`.
- Instagram API with Instagram Login for professional accounts without a Page: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights`.
- Long-lived tokens are encrypted; refresh before expiry; reconnect banner on failure.
- Multiple Pages and Instagram accounts per workspace (agencies).
- The system-user token stays as an advanced option for the Meta Ads product.
- Needs Meta App Review (advanced access) and Business Verification for TreeVook LLP. Build against `META_MOCK` until approved, like `GBP_MOCK`.

## V1 scope (decided: all four)

### 1. Brand kit
- Business type, audience, voice (friendly / professional / playful), topics, offers and products, hashtag sets, banned words, logo, colours, fonts, call to action and link.
- AI prefill from the website URL and the last 30 posts.

### 2. AI content calendar + approval
- A weekly plan generated each Sunday, or on demand: post mix (tips, offers, behind the scenes, testimonials with permission, Indian festivals and local events), per-day slots at the best times.
- Each post: format, caption per platform, hashtags, first comment, alt text, and visuals (brand templates rendered to PNG, user photo library, or user-uploaded video for Reels).
- Modes per content type, same as reviews: **Auto**, **Approval**, **Manual**.
- Safeguards: daily and weekly limits, quiet hours, never-auto words, an auto-pause if engagement drops sharply or a post gets reported.
- Calendar UI: week and month views, drag to reschedule, edit, regenerate caption or image, approve all.

### 3. Formats
- Instagram: single image, carousel (2–10), Reel, Story (image or video).
- Facebook: image, multi-image, video or Reel, text, link post.
- First comment, collaborator tags, location (where the API allows).

### 4. Analytics + best time
- Per-post reach, impressions, likes, comments, shares, saves and video plays; account follower growth and profile visits.
- Daily snapshots in our database, so trends work past the API's history window.
- Best time to post per account from the user's own engagement (fallback: category defaults), used by the calendar.
- Weekly digest by email or Slack: top post, what to do more of.

### 5. AI comment replies
- Sync comments on our posts; classify them (question, praise, complaint, spam); draft replies with the engine; auto / approval / manual per class.
- Hide spam (Facebook) and escalate complaints to Slack.
- DMs are out of V1; they need Messenger and Instagram messaging permissions.

### 6. Claude (MCP) tools
- `get_brand_kit`, `update_brand_kit` (two-step), `plan_social_week`, `list_social_calendar`, `create_social_post` (draft, or two-step for publish/schedule), `get_social_insights`, `list_social_comments`, `reply_to_social_comment` (two-step, respects "allow agents to post").

## Backend shape

`backend/src/modules/social-engine` (shared) plus thin `instagram` and `facebook` product modules if they diverge.

New tables:
- `social_accounts`: platform, external id, name, avatar, token ciphertext, expiry, status.
- `brand_kits`: one per workspace, optionally per account.
- `social_plans`: the weekly plan.
- `social_posts`: extended with account_id, format, media items, status `draft` / `pending_approval` / `scheduled` / …, mode, first_comment and alt_text.
- `social_post_metrics`: daily.
- `social_comments` and `social_comment_replies`.
- `social_account_metrics`: daily.

Worker ticks:
- Publish due posts.
- Sync comments every 15 minutes.
- Metrics daily.
- Weekly plan generation.
- Token refresh.

## Web shape

- Shared `ProductShell`. Navigation: Calendar, Posts, Comments, Insights, Brand kit, Accounts.
- Post composer with a live Instagram or Facebook preview (feed, Reel, Story).
- Calendar with week and month views, using the same themed controls as Play Reviews.

## Build order

1. Social engine data model, Facebook/Instagram OAuth with mock, accounts.
2. Brand kit and AI calendar generation, composer, approval, publishing (all formats).
3. Analytics and best time.
4. Comment replies.
5. MCP tools, landing page "Coming soon" badges removed, docs.

## Before launch

- Meta Business Verification for TreeVook LLP.
- App Review with screencasts for each permission; privacy policy and data deletion URL on treevook.com.
- Rate limits: Instagram allows 100 API-published posts per 24 hours per account; respect Page publishing limits.
