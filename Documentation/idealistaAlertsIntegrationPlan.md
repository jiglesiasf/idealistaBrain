# Idealista Alerts Integration Plan

## Goal

Turn a dedicated Idealista alert inbox into a continuous source of new investment opportunities.

The system should:

- ingest alert emails from Idealista
- map each alert to a saved search owned by the user
- extract listing URLs and alert metadata
- deduplicate listings across emails and time
- launch `listing-analysis` automatically for new or relevant listings
- surface the results in a bird's-eye dashboard focused on "what is new today and worth opening now"

## Product Direction

This is not just "run more jobs". It is a monitoring product.

The core user-facing concept should be:

- `Saved search` / `watched search`

Each watched search represents:

- a name
- an Idealista search-results URL
- a dedicated Idealista alert
- active/paused state
- optional alert rules and thresholds

The web should later expose a daily radar page that answers:

- what new listings arrived today
- which ones look profitable
- which watched searches produced good opportunities
- what changed compared with the previous day

## Architecture

The alert-driven flow should be split into 4 parts.

### 1. Inbox ingestion

Responsibility:

- connect to the dedicated mailbox
- fetch new Idealista emails
- persist the raw message content
- mark messages as pending / processed / ignored / failed

Initial recommendation:

- use a dedicated mailbox
- start with IMAP polling
- keep the mailbox provider-agnostic

This is the simplest v1 and avoids early lock-in to Gmail-only APIs.

### 2. Alert parser

Responsibility:

- detect whether an email is an Idealista alert
- classify the alert as `new-listings`, `price-drops`, or `mixed`
- extract listing URLs
- extract any helpful metadata present in the email
- resolve which saved search the alert belongs to

The parser should store both:

- raw extracted items
- parse confidence / parse errors

### 3. Analysis orchestrator

Responsibility:

- deduplicate listings by `listing_id`
- decide whether a listing needs a fresh analysis
- create `listing-analysis` jobs
- dispatch them to the browser companion / runner
- persist outputs

Initial decision rules:

- analyze when a listing is seen for the first time
- later: re-analyze on meaningful price drops or refresh windows

### 4. Radar UI

Responsibility:

- show new opportunities today
- group them by watched search
- highlight best ROI
- highlight novelty and changes
- let the user jump straight to Idealista or to the analysis detail

## Recommended Data Model

### `saved_searches`

Stores user-owned watched searches.

Suggested fields:

- `id`
- `user_id`
- `name`
- `idealista_search_url`
- `idealista_alert_label`
- `is_active`
- `created_at`
- `updated_at`

### `inbox_messages`

Stores raw inbox ingestion results.

Suggested fields:

- `id`
- `user_id`
- `provider`
- `provider_message_id`
- `from_address`
- `subject`
- `received_at`
- `raw_html`
- `raw_text`
- `status`
- `parse_error`
- `created_at`
- `updated_at`

### `search_alert_events`

Represents one Idealista alert email interpreted as a product event.

Suggested fields:

- `id`
- `user_id`
- `saved_search_id`
- `inbox_message_id`
- `event_type`
- `detected_at`
- `created_at`

### `search_alert_listings`

Represents each listing extracted from one alert event.

Suggested fields:

- `id`
- `alert_event_id`
- `listing_id`
- `listing_url`
- `title`
- `price_hint_eur`
- `is_new`
- `is_price_drop`
- `created_at`

### `listing_watch_state`

Maintains long-lived knowledge about previously seen listings.

Suggested fields:

- `id`
- `user_id`
- `listing_id`
- `listing_url`
- `first_seen_at`
- `last_seen_at`
- `last_price_seen_eur`
- `times_seen`
- `latest_saved_search_id`
- `latest_alert_event_id`
- `created_at`
- `updated_at`

## Main Product Flows

### Save a watched search

1. User creates a saved search in the web app.
2. The search stores the canonical Idealista results URL.
3. The user configures the equivalent alert in Idealista using the dedicated mailbox.

### Process an incoming alert

1. Inbox poller fetches a new email.
2. The email is stored in `inbox_messages`.
3. Parser extracts listings and creates `search_alert_events` + `search_alert_listings`.
4. Deduplication compares extracted listings against `listing_watch_state`.
5. New or relevant listings trigger `listing-analysis`.
6. Results appear in the web dashboard.

### Daily radar

The dashboard should eventually show:

- new listings today
- profitable listings today
- best opportunity by watched search
- listings with price drops
- changes vs previous day

## Recommended MVP Sequence

### Phase 1

- persist `saved_searches`
- persist raw `inbox_messages`
- expose authenticated CRUD for watched searches

### Phase 2

- implement IMAP poller
- ingest and store Idealista emails
- add message processing statuses

### Phase 3

- implement alert parser
- extract listing URLs and normalize them
- create alert events and listing rows

### Phase 4

- deduplicate against `listing_watch_state`
- create automatic `listing-analysis` jobs
- persist resulting opportunities

### Phase 5

- build `Radar diario`
- group by search
- sort by ROI / novelty / priority

## Key Decisions

### What should trigger a fresh analysis?

Initial answer:

- first time a listing is seen

Later:

- large price drop
- configurable refresh interval
- manual re-run

### Should we replace zone scans completely?

No.

Recommended strategy:

- use Idealista alerts as the main fast trigger
- keep a smaller number of backup `zone-scan` runs for critical searches

### Should we depend on a page being open in the browser?

No.

Longer term, automatic alert processing should target a local runner / companion runtime, not a manually opened web tab.

## Risks

- Idealista email templates may change
- some listing URLs may arrive with tracking / redirects and need normalization
- one listing may appear in multiple alerts
- price drops need careful re-analysis rules

## What we are starting now

The first implementation block should focus on:

- document the alert-driven architecture
- create the persistence model for watched searches and inbox alerts
- expose the first backend surface for `saved_searches`

That gives us a stable base before implementing mailbox polling and parsing.
