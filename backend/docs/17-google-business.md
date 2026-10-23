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
| Photos | My Business v4 `accounts.locations.media` | Shows the owner's photos (logo and cover first) on the Photos tab and the logo in the location header. `GET /business/locations/:id/photos` reads them live from Google, cached for an hour; Sync clears the cache |
| Insights | Business Profile Performance v1 | Daily views (Search and Maps), calls, website clicks, direction requests, messages and bookings |

| Categories, search and creation | Business Information v1 `categories.list`, `googleLocations.search`, `accounts.locations.create` | Finds a business already on Maps, looks up categories and creates new profiles |
| Business groups | Account Management v1 `accounts.create` | Creates a `LOCATION_GROUP` so an agency can keep clients' profiles apart |
| Verification | My Business Verifications v1 | Lists the ways Google offers, sends a code, submits it and reads the verification state |

Replies follow the same rules as Play: a mode and template for each star rating, AI drafting with Claude, quiet hours, a daily limit, never-auto words, the safety pause, and Slack escalation for 1–2 star reviews. Replies can be up to 4096 characters.

## Creating and verifying a profile

A business that isn't on Google yet can be added from TreeVook (`/business/create`, linked from the Google account and Locations pages). The owner first connects the Google account that should own it.

1. **Search first.** `POST /business/google/search` calls `googleLocations.search` with the name, and optionally the address or phone. A match that someone else manages comes with Google's `requestAdminRightsUri`; TreeVook shows it as "Claim this business", which opens Google's request-access flow. A match that is already connected links to its location page. Creating a second profile for a business that is already on Maps gets both suspended, so the flow always searches before it lets the owner continue.
2. **Details.** Name, a category from `categories.list` (`GET /business/google/categories?q=`, region `IN`, language `en`), then either a storefront address or service areas (cities or areas served; the address stays hidden, `serviceArea.businessType` is `CUSTOMER_LOCATION_ONLY`), phone, an `https` website, hours and a description. The same rules as editing apply (`checkInfo`), plus a category, a valid postal code, a phone number in digits and at least one way to reach the business.
3. **Review.** `POST /business/profiles/validate` checks the draft locally and then calls `accounts.locations.create` with `validateOnly=true`, so Google's own objections show next to the summary before anything is created.
4. **Create.** `POST /business/profiles` creates the location with a `requestId`, so a retried request returns the same profile instead of a duplicate. The new location is imported like any other (templates, reply rules, reviews, posts and insights) with `verification_state = unverified` and `created_in_app = true`. When the Google account has several Business Profile accounts (for example a business group made with `POST /business/accounts/groups`), the owner picks one; `GET /business/accounts` lists them.
5. **Verify.** New profiles stay hidden on Google until they are verified.
   - `GET /business/locations/:id/verification/options` calls `fetchVerificationOptions`: text message, phone call, email at the website's domain, postcard, and sometimes instant verification.
   - `POST /business/locations/:id/verification` calls `locations.verify` with the chosen method. The state becomes `pending`, with the method and where the code went.
   - `POST /business/locations/:id/verification/complete` sends the code to `verifications.complete`. A wrong code is reported and audited (`business.verification_code_rejected`); the owner can try again or ask for a new code.
   - `GET /business/locations/:id/verification` reads `getVoiceOfMerchantState` and `verifications.list` and keeps `gbp_locations` in step: `verified`, `pending`, `failed` or `unverified`, plus whether Google is reviewing the business, someone else owns it, or it breaks a guideline.
   - Some businesses can only be verified another way, such as a video. When Google offers no option through the API, TreeVook links to Business Profile to finish there.

Unverified locations show an "Unverified — finish verification" banner on their page and a badge in the list. Sync keeps working: reviews that Google won't return for an unverified location don't archive it.

Audit events: `business.location_created`, `business.group_created`, `business.verification_started`, `business.verification_code_rejected`, `business.verified`.

## Getting API access from Google

The Business Profile APIs are gated, and a new Cloud project's quota is 0 until Google approves it.

1. Create or choose a Google Cloud project for TreeVook.
2. Request access with the [Business Profile API access form](https://developers.google.com/my-business/content/prereqs#request-access). Use a business email on `treevook.com`, describe TreeVook as a tool that helps businesses manage their own profiles, and give the project number. The owner of the project must also manage a verified Business Profile that is at least 60 days old.
3. After approval, enable these APIs in the project: My Business Account Management API, My Business Business Information API, Business Profile Performance API, Google My Business API (v4, for reviews and posts) and My Business Verifications API (for verifying new profiles). Creating profiles and business groups needs no extra API, but Google may ask for a separate quota increase for `accounts.locations.create` and the Verifications API; request it in the same form if creation returns a quota error.
4. In APIs & Services → OAuth consent screen, add the scope `https://www.googleapis.com/auth/business.manage` along with `openid` and `email`, and submit the app for verification. `business.manage` is a sensitive scope.
5. Create an OAuth client (Web application) and add this redirect URI: `https://treevook.com/api/v1/business/oauth/callback`. Locally, add `http://localhost:3200/api/v1/business/oauth/callback` as well.
6. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and set `GBP_MOCK=false`.

TreeVook's project is approved with Google's standard quota of 300 requests per minute for each Business Profile API. `GoogleBusinessClient` waits for a slot before every call, using a sliding one-minute window in Redis per API host, so all API replicas and the background job share one budget. The limit is `GBP_REQUESTS_PER_MINUTE` (default 300); raise it when Google grants more. A call that would wait longer than two minutes fails with a `quota` error instead.

Without credentials, `GBP_MOCK=true` serves two sample dental clinic locations, with reviews, posts and insights, so the whole product can be used and tested. The mock also has a fixed category list, three Google Maps listings to search ("Sharma Dental", "Gupta"), dry-run rejection of any name containing `REJECT_ON_GOOGLE`, idempotent creation by `requestId`, business groups, and verification by text, call, email or postcard where the code is always `123456`.

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
| `list_business_locations`, `list_business_reviews`, `get_business_profile`, `get_business_insights`, `find_business_on_google` | Read |
| `save_business_review_drafts`, `sync_business` | Write, no confirmation |
| `send_business_review_reply`, `create_business_post` (now or scheduled), `update_business_info`, `update_business_reply_settings`, `create_business_profile`, `start_business_verification`, `complete_business_verification` | Two-step, with `confirm_token` |

`create_business_profile` runs Google's dry run before it returns the summary, so problems come back as `status: invalid` instead of a confirmation. `start_business_verification` without a method returns the ways Google offers. `test/business-mcp.e2e-spec.ts` covers every tool end to end over OAuth.

Posting a reply through Claude also needs the owner to turn on "Allow agents to post replies".
