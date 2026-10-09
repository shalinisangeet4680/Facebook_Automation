# Meta integration

## 1. Connection model

Each workspace connects one Meta Business through a **System User access token**. A System User is a non-human user inside the customer's Business portfolio; its token does not expire when chosen as "Never" and only reaches the assets the customer assigns to it.

The customer creates the token themselves, guided by an animated walkthrough in the client. The backend serves the guide content and requirements so web and mobile show the same instructions.

## 2. Customer steps (served by `GET /api/v1/meta/requirements`)

1. Open Meta Business Suite and go to Business settings.
2. Create an app at developers.facebook.com (type Business) and link it to the business.
3. Business settings → Users → System users → Add a system user with the Admin role.
4. Assign assets to the system user with full control: ad account, Facebook Page, Instagram account, dataset (Pixel).
5. Generate a token: choose the app, expiry Never, tick the required permissions.
6. Paste the token into the product.

## 3. Permissions

| Permission | Required | Used for |
|---|---|---|
| `ads_management` | yes | Create and manage campaigns, ad sets, ads, audiences, automated rules |
| `ads_read` | yes | Insights and reporting |
| `business_management` | yes | Read the business, its assets, and datasets |
| `pages_show_list` | yes | List Pages for ad identity |
| `pages_read_engagement` | yes | Page details and engagement |
| `pages_manage_posts` | recommended | Publish posts and Reels to the Page |
| `pages_manage_engagement` | recommended | Reply to comments on posts and ads |
| `instagram_basic` | recommended | Read the linked Instagram account |
| `instagram_content_publish` | recommended | Publish to Instagram |
| `instagram_manage_comments` | optional | Reply to Instagram comments |
| `leads_retrieval` | optional | Read Facebook lead form submissions |

Missing required permissions block the connection with a precise fix message. Missing recommended permissions connect with a warning and disable the related features.

## 4. Connect flow (`POST /api/v1/meta/connection`)

1. Basic format check (`EAA…`, length).
2. `GET /me?fields=id,name` → system user identity. Error code 190 → `META_TOKEN_INVALID`.
3. `GET /me/permissions` → granted scopes; compare with the requirements table.
4. Discover assets in parallel:
   - `GET /me/businesses?fields=id,name,verification_status`
   - `GET /me/adaccounts?fields=id,account_id,name,currency,timezone_name,account_status,amount_spent,spend_cap,business{id,name}`
   - `GET /me/accounts?fields=id,name,category,picture{url},instagram_business_account{id,username,profile_picture_url}`
   - For each ad account: `GET /act_<id>/adspixels?fields=id,name,last_fired_time,is_unavailable`
5. Encrypt the token (AES-256-GCM) and upsert `meta_connections`; upsert `meta_assets`.
6. Auto-select a primary asset when exactly one of a kind exists.
7. Mark onboarding step `connect_meta` complete; emit `meta.connected`; enqueue a background asset refresh.
8. Respond with the system user, granted and missing permissions, and discovered assets.

The response includes a `checks` array (`token`, `identity`, `permissions`, `ad_accounts`, `pages`, `datasets`) with status and message so clients can animate the verification steps from real results.

## 5. Graph client

- Lives in `modules/meta/infrastructure/graph-api.client.ts`, implementing the `MetaGraph` port.
- Version from `META_GRAPH_VERSION` (currently `v23.0`).
- Token is sent in the `Authorization: Bearer` header, never in URLs or logs.
- Timeouts (10 s), retries with exponential backoff and jitter on 5xx, network errors, and Meta throttling codes (4, 17, 32, 613, 80000–80014).
- Reads `x-business-use-case-usage`, `x-ad-account-usage`, and `x-app-usage`; when usage passes 75 % the client delays further calls for that account.
- Uses Graph batch requests for multi-object reads.
- Errors are mapped to `ErrorCode` values with user-facing messages.

## 6. Mock mode

`META_MOCK=true` swaps the Graph client for `MockMetaGraph`, which returns realistic businesses, ad accounts, Pages, Instagram accounts, and datasets. A token containing `invalid` triggers the invalid-token path. Used for local UI work and tests.

## 7. Token health

A scheduled job checks every active connection daily with `GET /me`. Failures mark the connection `invalid`, create a notification, and pause automation for that workspace until the customer reconnects.
