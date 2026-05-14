# Web Version Implementation Plan

## Objective
Build a web product version of `Idealista Brain` that allows a user to:
- analyze an individual Idealista sale listing
- analyze a sale-results zone URL
- execute the use cases defined in [functionalRequirements.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/functionalRequirements.md)

## Critical product constraint
Idealista live pages are not reliably accessible from a generic backend scraper.

Because of that, the recommended product architecture is:
- **Web app** for product UI, authentication, jobs, persistence, reporting, and results
- **Browser companion** based on the current Chrome extension for live Idealista access in the user's real browser session

This avoids building a fragile backend-only scraper product that breaks under bot protection.

## V1 product decision

The v1 user experience target is:
- the user pastes one Idealista URL into the web app
- the web app creates a job
- the browser companion executes the live Idealista workflow locally in the user's browser session
- the browser companion reports progress and final result back to the backend
- the web app renders the final result

The user should **not** need to:
- copy JSON manually between the extension and the web app
- log in inside the extension
- treat the extension popup as the main product surface

This means the extension is not a second user-facing product in web mode.
It is an **invisible execution companion**.

## Recommended v1 stack

- `Next.js App Router` + `TypeScript`
- `Supabase Auth` for web authentication
- `Supabase Postgres` for jobs and persisted results
- `@supabase/ssr` + `@supabase/supabase-js`
- `TanStack Table` for rankings and opportunity tables

V1 transport recommendation:
- use simple polling from the web app to the backend for job status

V1 should avoid:
- backend-only scraping as the primary execution strategy
- auth inside the extension
- manual JSON transfer as the main workflow
- unnecessary background-job infrastructure before the companion flow works end to end

---

## Recommended architecture

### 1. Shared domain engine
Extract shared logic from the extension into reusable modules:
- listing normalization
- comparable validation rules
- rent estimation
- profitability estimation
- zone scan ranking logic

This shared engine should be used by:
- the browser companion
- the web backend
- future tests

### 2. Browser companion
The current extension evolves into a browser-side execution agent.

Responsibilities:
- open Idealista URLs in the user's real session
- read listing pages and result pages from live DOM
- execute listing and zone workflows
- receive short-lived job instructions from the web app
- report progress and final results back to the web backend

Non-responsibilities:
- no user account
- no persistent job history
- no product-level settings
- no requirement to expose the full product workflow in the popup

### 3. Web backend
The backend becomes the orchestration layer.

Responsibilities:
- authentication
- job creation
- job lifecycle management
- persistence of results
- result retrieval APIs
- export APIs
- user-level settings and assumptions
- short-lived execution-token issuance for companion runs

### 4. Web frontend
The web frontend becomes the main product surface.

Responsibilities:
- let the user paste either:
  - an individual listing URL
  - a zone URL
- create jobs
- detect whether the browser companion is available
- show job status
- show results and rankings
- allow sorting and filtering
- allow JSON export
- later allow saved analyses and history

---

## Product modes

### Mode A. Single listing analysis
Input:
- an Idealista listing URL

Output:
- normalized asset
- comparable rentals
- rent estimate
- profitability metrics
- exportable JSON

Mapped use cases:
- `UC-01`
- `UC-02`
- `UC-03`
- `UC-04`
- `UC-06`

### Mode B. Zone scan
Input:
- an Idealista zone or municipality sale-results URL

Output:
- scanned opportunities
- ranked table
- sort by ROI metric
- direct links to analyzed listings
- exportable JSON

Mapped use cases:
- `UC-05`
- `UC-06`

---

## Implementation phases

## Phase 0. Product and architecture alignment
Goal:
Lock the technical direction before writing production code.

Deliverables:
- confirmed architecture: web app + invisible browser companion
- confirmed use case scope for v1
- confirmed MVP constraints

Decisions to lock:
- web auth provider
- whether results are persisted per user
- whether zone scan is limited to current page in v1 web product
- whether v1 status uses polling or realtime
- what web origins are allowed to talk to the extension

---

## Phase 1. Shared analysis core
Goal:
Move business logic out of the popup/content-script monolith into reusable modules.

Tasks:
- extract normalized asset schema
- extract comparable schema
- extract rent estimation functions
- extract profitability functions
- extract zone ranking functions
- define a stable internal result contract

Deliverables:
- shared `src/core/` package or equivalent
- deterministic unit-testable functions
- JSON contracts for:
  - listing analysis result
  - comparable-search result
  - profitability result
  - zone-scan result

Why this phase matters:
- the web product cannot be maintainable if all logic stays inside the extension popup/content script

---

## Phase 2. Browser companion API
Goal:
Turn the extension into a callable worker for the web product.

Tasks:
- define extension commands:
  - run listing analysis job
  - run zone scan job
- let the extension receive job instructions from the web page
- let the extension report progress and final results to the backend
- add `externally_connectable` support for the allowed web origin
- add short-lived execution-token validation

Deliverables:
- browser companion command protocol
- stable payload exchange format
- progress events for long-running zone scans

Notes:
- in v1, the companion should remain stateless from a product perspective
- the extension should not require its own user account
- the popup can remain useful for manual/debug use cases without becoming the main web workflow

---

## Phase 3. Web backend and job model
Goal:
Create the service that stores and serves analyses.

Tasks:
- define database schema
- create job table
- create job event table
- create analysis result tables/documents
- create APIs:
  - `POST /api/jobs`
  - `GET /api/jobs/:id`
  - `POST /api/companion/jobs/:id/accepted`
  - `POST /api/companion/jobs/:id/progress`
  - `POST /api/companion/jobs/:id/completed`
  - `POST /api/companion/jobs/:id/failed`
  - `GET /api/analyses/:id`
  - `GET /api/zone-scans/:id`
  - `GET /api/exports/:id.json`
- support job statuses:
  - `queued`
  - `dispatching`
  - `running`
  - `completed`
  - `failed`

Deliverables:
- API layer
- persistence layer
- job orchestration contract

Recommended data model:
- users
- jobs
- job_events
- listing_analyses
- zone_scans

V1 storage note:
- prefer storing first-pass analysis outputs as JSON payloads tied to jobs
- normalize further only when product needs justify it

---

## Phase 4. Web frontend MVP
Goal:
Build the first usable product surface.

Pages:
- analyze single listing
- analyze zone
- analysis result page
- zone scan result page
- dashboard/history

Core components:
- URL input with mode selector
- companion availability / install prompt
- job progress card
- rent estimate card
- profitability card
- comparables table
- zone opportunity ranking table
- ROI sort dropdown
- export button

Deliverables:
- single-listing workflow in browser
- zone-scan workflow in browser
- results persisted and reloadable

---

## Phase 5. Result UX and product hardening
Goal:
Make the product usable beyond a demo.

Tasks:
- add saved history
- add retries for failed jobs
- add clearer incomplete-result states
- add assumption visibility
- add assumption editing for profitability
- improve ranking table with filters
- add CSV export later if needed

Deliverables:
- durable user experience
- repeatable workflows
- reduced ambiguity in results

---

## Use-case implementation mapping

### `UC-01` Analyze current listing
Web implementation:
- user pastes listing URL
- backend creates job
- web app dispatches the job to the companion
- browser companion opens the listing
- shared core extracts normalized asset
- backend stores result
- frontend displays analysis result

### `UC-02` Search rental comparables
Web implementation:
- browser companion executes live search from listing context
- shared core validates candidates
- backend stores valid and discarded sets inside the persisted result payload
- frontend shows results and trace

### `UC-03` Estimate monthly rent
Web implementation:
- shared core computes rent estimate from validated comparables
- frontend displays estimate card

### `UC-04` Estimate profitability
Web implementation:
- shared core computes ROI metrics
- frontend displays profitability card

### `UC-05` Zone scan and ranking
Web implementation:
- user pastes zone URL
- backend creates scan job
- web app dispatches the job to the companion
- browser companion opens the zone page
- browser companion processes listings sequentially
- backend stores opportunities
- frontend shows ranking table and sort dropdown

### `UC-06` JSON export
Web implementation:
- backend exposes exportable JSON for a job or analysis result
- frontend provides download/copy action

---

## V1 MVP boundaries
To keep the first web product realistic, v1 should:
- require the browser companion
- support only Idealista
- support single listing and current-page zone scan
- persist results
- support JSON export
- support ROI-based sorting in zone ranking
- use web auth only
- use polling for job status first
- avoid forcing the user into manual data transfer between extension and web app

V1 should not yet include:
- full multi-page crawling
- cloud browser execution
- collaborative workspaces
- financial customization per user
- mortgage product comparison
- extension-side user accounts or companion history

---

## Main technical risks

### Risk 1. Idealista anti-bot behavior
Mitigation:
- use the real browser session through the browser companion

### Risk 2. Logic duplication
Mitigation:
- extract a shared core before building the web product

### Risk 3. Long-running scans
Mitigation:
- model scans as jobs with progress
- process sequentially
- allow partial results

### Risk 4. Product confusion between extension and web
Mitigation:
- define the extension as an invisible browser companion
- define the web app as the primary product surface

---

## Recommended implementation order
1. Extract shared core from extension code
2. Define result schemas
3. Define the web-to-companion job contract
4. Add browser companion command interface
5. Build backend job orchestration
6. Build web frontend for single listing
7. Build web frontend for zone scan
8. Add persistence, history, and export polish

---

## Companion contract
The initial protocol and payload shapes for jobs should live in:
- [webCompanionJobContract.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webCompanionJobContract.md)

## Recommendation
The best path is not to rebuild the extension UI inside a web page directly.

The best path is:
- keep the extension as the live Idealista execution layer
- make the web app the real product
- centralize all business logic in a shared core
- let the web app dispatch jobs to the extension without making the user move data manually

That gives us:
- reliability
- a scalable product direction
- a migration path away from popup-only UX
