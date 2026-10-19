# Meta App Review: Arogya System app (TreeVook)

Submit in developers.facebook.com → Arogya System → Review → App Review → Permissions and features → **Request advanced access**, one permission at a time. Each needs a usage description and a screencast.

General app details reviewers check:
- App domain `treevook.com`
- Privacy policy `https://treevook.com/privacy`
- Terms `https://treevook.com/terms`
- Data deletion `https://treevook.com/data-deletion`
- Category: Business and pages; icon set; business verified.

Test account for reviewers: create a TreeVook login for them (Settings → invite), or note "Reviewers can sign in with any Google account at https://treevook.com/login; connect Meta with Continue with Facebook".

Recording tips:
- Use English UI.
- Show the Facebook Login for Business dialog, the permission being used, and the result in TreeVook and on Facebook.
- 1–3 minutes each.
- No music needed.

---

## ads_management

**How we use it:** TreeVook AI lets business owners create and manage their own Facebook and Instagram ad campaigns from one dashboard. After the owner connects their ad account through Facebook Login for Business, we use ads_management to:
1. Create the campaign, ad set, creative and ad they reviewed in TreeVook. Everything is created paused, and nothing spends until the owner clicks Launch.
2. Pause or resume campaigns, ad sets and ads.
3. Change daily budgets within limits the owner sets.
4. Update ad text and images.

Every change is made only on the owner's explicit action or approval, and is logged.

**Screencast script:**
1. Open https://treevook.com/setup/connect-meta → Continue with Facebook → pick business, ad account, Page, Pixel → back in TreeVook, "Meta is connected".
2. Campaigns → New campaign → goal Leads, budget ₹500/day, location → Generate plan.
3. On the review screen → Create in Meta (paused) → open Ads Manager in another tab and show the new paused campaign.
4. Back in TreeVook → Campaigns → open the campaign → Pause/Resume an ad, edit the daily budget (confirm dialog) → refresh Ads Manager to show the change.

## ads_read

**How we use it:** We read campaign, ad set and ad performance (spend, results, cost per result, CTR) for the connected ad account to show the owner's reports dashboard and a daily check-up. The check-up suggests pausing ads that waste money or scaling ones that work, and the owner approves each suggestion. Data is shown only to members of that business's workspace.

**Screencast script:**
1. Logged in, connected → Reports → change the period to 30 days → show KPIs, the daily chart and the campaign table.
2. Overview → "Last 7 days" figures and a suggestion card with its evidence numbers.
3. Campaigns → campaign detail → per-ad metrics.

## business_management

**How we use it:** Facebook Login for Business issues a business system-user token. We use business_management to list the business portfolio's ad accounts, Pages, Instagram accounts and Pixels (datasets) that the owner shared during login. The owner picks which ones TreeVook works with, and can switch between their ad accounts. We don't create or modify businesses, users or assets in Business Manager.

**Screencast script:**
1. Continue with Facebook → choose the business and assets in Meta's dialog.
2. TreeVook → Meta account → Choose accounts: show the listed ad accounts, Pages, Instagram accounts and Pixels that were shared → select → Save.
3. Sidebar → Ad account switcher → switch to another shared ad account → Campaigns list updates.

## leads_retrieval

**How we use it:** For instant-form lead ads created through TreeVook, we retrieve new leads every 15 minutes so the business owner can follow up in TreeVook's Leads page, mark status, add notes and export to CSV. Optionally, a Slack alert is sent to the owner's own workspace. Lead data is only visible to that business's workspace members and is deleted on request.

**Screencast script:**
1. New campaign → goal "Instant leads" → Lead form step (name, phone, city) → create in Meta.
2. Submit a test lead using Meta's Lead Ads Testing Tool (https://developers.facebook.com/tools/lead-ads-testing).
3. TreeVook → Leads → Sync now → the test lead appears → change its status to Contacted, add a note → Export CSV.

## pages_manage_ads

**How we use it:** We use pages_manage_ads to create instant forms (lead gen forms) on the business's own Page and to run ads that represent that Page. This is only used when the owner creates an instant-form lead campaign in TreeVook.

**Screencast script:** Same as leads_retrieval steps 1, then open the Page's Publishing tools → Forms library to show the form TreeVook created.

## pages_show_list, pages_read_engagement (if not already approved)

**How we use it:**
- `pages_show_list`: list the Pages the owner manages, so they can choose the Page their ads and posts run from.
- `pages_read_engagement`: read the Page's details and posts so the owner can promote an existing post as an ad, and so we can show their Page profile checkup.

**Screencast script:** Choose accounts → Page list. New campaign → Creative → "Facebook posts" tab → pick an existing post.

---

Instagram and Facebook Autopost permissions (`pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `instagram_business_*`) can be submitted in the same review with screencasts from https://instagram.treevook.com and https://facebook.treevook.com: connect → schedule a post → it publishes → reply to a comment → insights.
