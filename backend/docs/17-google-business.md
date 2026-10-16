# Google Business Profile

TreeVook manages a business's Google Business Profile: review replies, posts, profile insights and business information. It runs on the shared reply engine in `src/modules/engine`, the same one Play Reviews uses.

## How it connects

The owner signs in with Google (OAuth, offline access) and grants the `business.manage` scope. The refresh token is encrypted with `TOKEN_ENCRYPTION_KEY` and stored in `gbp_connections`. Every location the account can manage is imported, and new ones are picked up daily.

| Area | Google API | What TreeVook does |
|---|---|---|
| Accounts | Account Management v1 | Lists accounts and location groups |
| Locations and info | Business Information v1 | Reads the name, description, phone, website, address, categories and hours, and edits the first five |
| Reviews | My Business v4 `accounts.locations.reviews` | Syncs every 30 minutes, then replies, edits replies and deletes replies |
| Posts | My Business v4 `localPosts` | Publishes updates, offers and events, now or on a schedule |
| Insights | Business Profile Performance v1 | Daily views (Search and Maps), calls, website clicks, direction requests, messages and bookings |

Replies follow the same rules as Play: a mode and template for each star rating, AI drafting with Claude, quiet hours, a daily limit, never-auto words, the safety pause, and Slack escalation for 1–2 star reviews. Replies can be up to 4096 characters.

## Getting API access from Google

The Business Profile APIs are gated, and a new Cloud project's quota is 0 until Google approves it.

1. Create or choose a Google Cloud project for TreeVook.
2. Request access with the [Business Profile API access form](https://developers.google.com/my-business/content/prereqs#request-access). Use a business email on `treevook.com`, describe TreeVook as a tool that helps businesses manage their own profiles, and give the project number. The owner of the project must also manage a verified Business Profile that is at least 60 days old.
3. After approval, enable these APIs in the project: My Business Account Management API, My Business Business Information API, Business Profile Performance API, and Google My Business API (v4, for reviews and posts).
4. In APIs & Services → OAuth consent screen, add the scope `https://www.googleapis.com/auth/business.manage` along with `openid` and `email`, and submit the app for verification. `business.manage` is a sensitive scope.
5. Create an OAuth client (Web application) and add this redirect URI: `https://treevook.com/api/v1/business/oauth/callback`. Locally, add `http://localhost:3200/api/v1/business/oauth/callback` as well.
6. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and set `GBP_MOCK=false`.

Until then, `GBP_MOCK=true` serves two sample dental clinic locations, with reviews, posts and insights, so the whole product can be used and tested.

## Background work

`BusinessProcessor` runs every 5 minutes on the `business` queue and does five things:

- Sends replies whose delay has passed.
- Publishes scheduled posts.
- Syncs locations that haven't synced for 30 minutes.
- Refreshes insights once a day.
- Discovers new locations once a day.

A location that Google says no longer exists, or that the account can't manage, is archived with its data and restored when it comes back.

## MCP tools

| Tool | Kind |
|---|---|
| `list_business_locations`, `list_business_reviews`, `get_business_profile`, `get_business_insights` | Read |
| `save_business_review_drafts`, `sync_business` | Write, no confirmation |
| `send_business_review_reply`, `create_business_post` (now or scheduled), `update_business_info`, `update_business_reply_settings` | Two-step, with `confirm_token` |

Posting a reply through Claude also needs the owner to turn on "Allow agents to post replies".
