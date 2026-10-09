# facebook_automation

Meta marketing automation for Arogya System (arogyasystem.com): ads, Page and Instagram publishing, comment replies, and daily performance reports via the Meta Marketing and Graph APIs.

## Setup

1. Copy `.env.example` to `.env` and fill in the system user token, ad account, Page and Instagram IDs.
2. `.env` is git-ignored; never commit tokens.

## Guardrails

- Campaigns are created paused; launching or raising spend needs explicit approval.
- Pausing or reducing spend can be automated.
- Account spending limit is set in Ads Manager, not here.
