# Campaign plans

Claude, on the customer's own Claude plan through the connector, proposes every setting of a new campaign with a reason for each choice. The plan is saved in Autopilot. The owner reviews and edits it in the app. Our API then creates the campaign in Meta exactly as approved, paused, and launches it after one confirmation.

Plans come from two places:
- Claude through the connector, where Claude does the thinking.
- The in-app builder at `/campaigns/new`, where our backend writes the plan (see below).

Either way, Autopilot validates, stores, creates and launches.

## Flow

1. The user asks Claude something like "Plan a campaign to get clinic owners in Bihar to book a demo, about ₹15,000 a month."
2. Claude calls `get_planning_context` to get the ad account, Page, Pixel events, past campaign results, guardrails and the allowed values (goals, conversion events, calls to action).
3. Claude uses `search_targeting` for location and interest keys, and can read the website itself.
4. Claude calls `propose_campaign_plan`. We validate the plan, save it as a draft and return a review link.
5. The owner opens `/campaigns/plans/{id}`, edits any field, adds an image and saves.
6. The owner selects **Create in Meta**. Our API builds the campaign, ad set, creative and ad, all paused.
7. The owner selects **Launch** and confirms. The campaign and its children are turned on.

Claude can revise a draft with `update_campaign_plan` while it is still a draft.

## Plan shape

```json
{
  "name": "Clinic owners – Bihar – Demo sign-ups",
  "summary": "Why this plan, in two or three sentences",
  "goal": "leads",
  "conversionEvent": "COMPLETE_REGISTRATION",
  "dailyBudget": 500,
  "targeting": {
    "countries": [],
    "regions": [{ "key": "1730", "name": "Bihar" }],
    "cities": [{ "key": "1035921", "name": "Patna", "radiusKm": 25 }],
    "ageMin": 28,
    "ageMax": 55,
    "genders": "all",
    "interests": [{ "id": "6003107902433", "name": "Physician" }]
  },
  "creative": {
    "primaryText": "…",
    "alternatives": ["…", "…"],
    "headline": "Free demo clinic",
    "description": "…",
    "linkUrl": "https://arogyasystem.com/",
    "imageUrl": null,
    "videoUrl": null,
    "imageIdea": "Doctor at a clean front desk using the app on a tablet",
    "callToAction": "SIGN_UP"
  },
  "variants": [
    { "enabled": true, "primaryText": "…", "headline": "…", "imageUrl": null, "videoUrl": null }
  ],
  "reasons": {
    "goal": "…",
    "audience": "…",
    "budget": "…",
    "creative": "…"
  },
  "expectedResults": "About 15–25 sign-ups a week at ₹150–250 each"
}
```

`targeting` can also hold `customAudiences` and `excludedCustomAudiences` (`{ id, name }` from the ad account's custom audiences). The same targeting shape is used by saved audiences.

`creative.videoUrl` runs the ad as a video (an https MP4, usually from the creatives library). `imageUrl` then becomes the thumbnail; without it Meta's preferred thumbnail is used. Video works for every goal, including instant forms.

`variants` holds up to two more versions of the ad (A is the main creative). Each enabled version becomes its own paused ad in the same ad set. A version without an image or video reuses the main one. Versions can't be used with an existing post.

The same zod schema validates the tool input, app edits and the create step. Budget is in the account currency. It must be at most `ADS_MAX_DAILY_BUDGET`, and the guardrail is checked again when creating.

## Data

`campaign_plans` columns:
- `id`, `workspace_id`, `created_by`, `source` (`mcp:<client>` or `app`)
- `status`: `draft`, `created`, `launched` or `discarded`
- `plan` (jsonb), `meta` (jsonb ids after creation, including `ads: [{ label, adId, creativeId }]` and `adAccountId`), `error`
- `ad_account_id`: the ad account the plan was created in. Launch and later actions use this account even after the workspace switches its active ad account.
- `created_at`, `updated_at`

Status moves only forward. Plans can be edited only while `draft`.

## API

| Method | Path | Purpose |
| - | - | - |
| GET | `/api/v1/campaign-plans` | List plans, newest first |
| POST | `/api/v1/campaign-plans/generate` | Build a draft plan from a short brief (in-app builder) |
| GET | `/api/v1/campaign-plans/:id` | One plan with options (goals, events, calls to action, guardrails, currency) |
| PUT | `/api/v1/campaign-plans/:id` | Replace the plan while draft |
| POST | `/api/v1/campaign-plans/:id/create` | Create paused in Meta (needs an image) |
| POST | `/api/v1/campaign-plans/:id/launch` | Body `{ "confirm": true }`; turns on the campaign, ad set and ad |
| POST | `/api/v1/campaign-plans/:id/discard` | Discard a draft |
| GET | `/api/v1/ads/targeting?type&q&country` | Location and interest search for the editor |
| GET/POST | `/api/v1/ads/audiences` | Saved audiences (name and plan-shaped targeting) |
| GET/PUT/DELETE | `/api/v1/ads/audiences/:id` | One saved audience |
| GET | `/api/v1/ads/custom-audiences` | Read-only custom audiences of the active ad account |
| PUT | `/api/v1/meta/assets/ad-account` | Switch the active ad account; keeps the Page and Instagram, moves the dataset when it doesn't belong |

Create and launch are audited (`plan.created_in_meta`, `plan.launched`) and protected against double clicks with a status check inside a row lock.

## In-app builder

`POST /api/v1/campaign-plans/generate` takes a brief with these fields:
- `goal` and `dailyBudget`;
- `locations` (`countries`, `regions`, `cities`; at least one);
- optional `ageMin` and `ageMax`;
- optional `audienceNotes`;
- `offer`;
- `landingUrl`, required for traffic and sales; otherwise the ad links to the Facebook Page;
- optional `creative` (`imageUrl`, `videoUrl`, `creativeId` of an image or video, or `post`);
- optional `audienceId`: a saved audience whose targeting replaces `locations`, ages and the AI's interests;
- optional `variants` (default `true`): draft two more versions of the ad for an A/B test;
- optional `language`.

The server:
1. Clamps the budget to `maxDailyBudget` from Settings and rejects 0 or less.
2. Reads the planning context: the account, past results and Pixel events.
3. Asks the plan AI (`PLAN_AI`) for the name, copy, call to action, interest ideas and reasons. The AI uses the workspace AI key and the shared daily AI allowance; counted drafts are `plan.proposed` audit events with `ai: true`. `AI_MOCK=true`, no key or no allowance left all use the deterministic writer.
4. Resolves interests through the targeting search.
5. Validates the result with the plan schema. If the AI output is invalid, it saves a safe template plan built from the brief instead.
6. Saves the plan as a draft with source `app`.

It returns `{ id, name, dailyBudget, requestedDailyBudget, budgetClamped, currency, ai, usedTemplate }`.

## MCP tools

| Tool | Scope |
| - | - |
| `get_planning_context` | read |
| `propose_campaign_plan` | write |
| `update_campaign_plan` | write |
| `list_campaign_plans` | read |
| `list_saved_audiences` | read |

## Video ads

On create, every distinct video url is uploaded once with `POST /act_{id}/advideos` (`file_url`), polled with `GET /{video_id}?fields=status` every 3 seconds until `status.video_status` is `ready` (about two minutes at most), and its thumbnail read from `GET /{video_id}?fields=picture,thumbnails`. The creative uses `object_story_spec.video_data` (`video_id`, `image_url`, `message`, `title`, `link_description`, `call_to_action`). Lead ads put `lead_gen_form_id` in the button value. Editing a video ad's text creates a new creative that keeps the same `video_id`.

## A/B versions

The campaign page compares the ads of every ad set with two or more ads. The winner so far has the lowest cost per result among ads with at least 5 results; without that, the highest click-through rate among ads with 1,000 impressions; otherwise it says there isn't enough data yet. The daily inbox check adds a `variant_loser` suggestion when a version costs at least 1.5 times the winner per result (with 3 or more results), spent twice the winner's cost without a result, or, before there are results, gets 60% or fewer of the winner's clicks over 2,000 impressions each. Applying it pauses that ad.

The tool descriptions tell Claude to share the review link and to leave creation and launch to the owner in the app.

## Web

- `/campaigns`: plans list with status, a **New campaign** button, and how to ask Claude for a plan (prompt to copy).
- `/campaigns/new`: five-step builder (goal, budget, who and where, offer, image or video) that generates a draft and opens its review page. The last step can test three versions of the ad, and the audience step can use or save a saved audience.
- `/campaigns/plans/:id`: review and edit. It has sections for Goal, Audience, Budget and Ad, each with Claude's reason. The ad section includes a preview. A sticky footer holds Save, Create in Meta and Launch.
