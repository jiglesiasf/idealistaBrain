# Idealista Brain: AI Project Knowledge Handoff

## Purpose of this document
This file is a handoff artifact for future AI agents working on this project, including:
- other Codex accounts
- Claude Code
- any other engineering-focused AI assistant

The goal is to provide enough context to continue work without reconstructing the project history from scratch.

---

## 1. Project identity

### Product name
`Idealista Brain`

### Core product idea
Analyze Idealista sale listings to evaluate their attractiveness as buy-to-rent opportunities.

### Current implementation surfaces
The current repo contains:

- the current executable extension:
  - [extension](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension)
- the first extracted shared core:
  - [src/core](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/src/core)

### Important truth
The **extension is still the current source of truth for live Idealista execution**.

The **web app is the target primary product surface**.

The intended architecture is:
- web app as the main user-facing product
- browser companion extension as an invisible execution layer for live Idealista work

The next product layer after manual URL-driven jobs is an alert-driven workflow:
- dedicated Idealista alert inbox
- saved searches in the web app
- automatic `listing-analysis` for listings extracted from alert emails
- a bird's-eye daily radar of new opportunities

The old indexed-search mini web / CLI was removed from the repository because it was materially less faithful than the extension approach.

---

## 2. Why the extension exists

The extension exists because Idealista blocks generic scraping and backend-style automation.

The working product insight was:
- backend-only scraping is unreliable
- indexed search is not accurate enough
- the most reliable execution layer is the user's **real browser session**

That led to the companion-based architecture:
- read live DOM from the user's actual Idealista session
- open search pages and listings in real browser tabs
- validate candidates live
- compute rental and ROI estimates from that browser context

---

## 3. Current product goal

The current product goal is:

> Take an Idealista sale listing or a sale-results zone URL and estimate whether the asset looks attractive for rental investment.

This is broken into:
- extract sale listing data
- search rental comparables
- estimate monthly rent
- estimate ROI metrics
- rank opportunities in zone scans

For the web product, the user experience target is:

> Paste one Idealista URL in the web app and get the result there, without manually copying JSON from the extension.

---

## 4. Current functional scope

The approved functional requirements live in:
- [Documentation/functionalRequirements.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/functionalRequirements.md)

Approved use cases:
- `UC-01` Analyze the current Idealista sale listing
- `UC-02` Search rental comparables for the current listing
- `UC-03` Estimate monthly rent from validated comparables
- `UC-04` Estimate profitability metrics for the current listing
- `UC-05` Scan a sale-results page and rank opportunities by cash-to-cash ROI
- `UC-06` Export the current analysis as JSON

### Important approved rule changes
Future AI agents should preserve these decisions unless explicitly changed by the user:

#### Comparable search scope
- search first in the same zone
- then expand to the same municipality
- do not leave the municipality in the current MVP

#### Comparable search behavior
- do not stop early once the minimum threshold is reached
- keep collecting as many comparables as possible within the allowed scopes

#### Comparable filtering
- municipality match is required
- province match is **not** a functional requirement anymore
- comparable must be a **full-property rental**
- exclude:
  - temporary rentals
  - room-only rentals
  - non-residential listings
  - 404/unavailable results

#### Rent estimation
- prefer a rent-per-square-meter approach when possible
- fall back to direct rent comparison when needed

#### Profitability assumptions
- buyer cash contribution = 30% of property price
  - 20% of property price as down payment
  - 10% of property price as taxes/acquisition costs
- mortgage = 80% of property price
- mortgage type for simplified model = fixed 2.5%
- mortgage term = 25 years

#### Zone scan ranking
- ranking must support sort by:
  - ROI cash to cash
  - ROI cash to cash neto
  - ROI bruto
  - ROI neto
- ranking color signal remains tied to **ROI cash to cash**
  - green if `> 25%`
  - yellow if `15% - 25%`
  - soft red if `< 15%`

---

## 5. Current extension architecture

### Key files
- [extension/manifest.json](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/manifest.json)
- [extension/background.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/background.js)
- [extension/content-script.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/content-script.js)
- [extension/popup.html](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.html)
- [extension/popup.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.js)
- [extension/popup.css](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.css)
- [extension/README.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/README.md)

### Execution model

#### `content-script.js`
Runs inside Idealista pages.

Responsibilities:
- extract listing context from sale or rental pages
- normalize location and asset data
- scrape comparable candidate cards from live search/result pages
- run full listing analysis

It contains most of the business logic today.

#### `background.js`
Acts as the orchestrator.

Responsibilities:
- communicate with the active tab
- open hidden/inactive tabs for live page reading
- run scans and per-listing analysis in sequence
- pass messages between popup and content scripts

#### `popup.js` / `popup.html` / `popup.css`
Current UI layer.

Responsibilities:
- trigger actions
- render single-listing analysis
- render comparable search
- render rent estimate
- render profitability estimate
- render zone scan ranking
- export JSON

### Important architectural note
The extension currently mixes:
- extraction logic
- domain logic
- orchestration
- UI formatting

This is acceptable for prototype stage but should be refactored if the product continues.

---

## 6. Current extension capabilities

### Single listing mode
The extension can:
- analyze a sale listing page
- normalize the asset
- search rental comparables
- validate comparables
- estimate rent
- estimate profitability

### Zone scan mode
The extension can:
- read an Idealista sale-results page
- detect visible sale listings
- queue listing analyses
- run listing analyses sequentially
- compute per-opportunity rental and profitability outputs
- rank results by cash-to-cash ROI

### Export
The extension can copy a JSON payload containing currently available data.

---

## 7. Current UI state

The popup was recently redesigned toward:
- more formal visual tone
- less gradient-heavy UI
- more compact and legible layout
- KPI-first presentation
- Apple-inspired cleanliness

Important UI behaviors:
- zone ranking entries are clickable
- ranking cards have ROI color coding
- there is now explicit distinction between:
  - single listing mode
  - zone scan mode

---

## 8. Current zone scan behavior

This is important because it is a deliberate MVP constraint.

### Current MVP behavior
- scan only the currently visible sale-results page
- do not paginate automatically
- do not run in massive parallel
- process listings one by one

### Current scan limit
There is an internal scan limit in the background orchestrator:
- `ZONE_SCAN_LIMIT = 12`

If future AI agents change scanning behavior, they should consider:
- anti-bot risk
- speed vs reliability tradeoff
- partial results and failure handling

---

## 9. Current profitability model

The extension currently computes these profitability metrics:
- `ROI cash to cash`
- `ROI cash to cash neto`
- `ROI bruto`
- `ROI neto`

### Operational costs currently modeled
- vacancy
- management
- maintenance
- local taxes and community
- insurance and incidents

### Mortgage assumptions
- loan-to-value = 80% of property price
- user cash = 20% down payment + 10% taxes/costs
- interest = 2.5% fixed
- term = 25 years

### Important limitation
This is still a **screening model**, not a full underwriting engine.

Not yet modeled:
- real mortgage offer conditions
- renovation budget
- region-specific tax detail
- user-custom financing structure
- legal/commercial expenses beyond simplified assumptions

---

## 10. Current known constraints and risks

### 1. Idealista anti-bot behavior
This is the central product constraint.

Implications:
- direct backend scraping is not reliable
- generic `fetch()` against live pages often triggers blocks
- real browser session access is the most durable execution method found so far

### 2. Legacy indexed-search stack was removed
The repo used to contain an older fallback path based on indexed search.

That approach should be treated only as historical context, not as the preferred product architecture.

### 3. Business logic is too concentrated in `content-script.js`
This makes:
- testing harder
- future web-product reuse harder
- maintenance harder

### 4. UI and domain logic are still tightly coupled
This is manageable for prototype stage, but not ideal for scaling.

---

## 11. Recommended next technical direction

The web product plan lives in:
- [Documentation/webVersionImplementationPlan.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webVersionImplementationPlan.md)

### Key strategic decision
Do **not** build the web product as a pure backend scraper.

Recommended architecture:
- web app as the real product
- extension as an invisible browser companion
- shared analysis core reused by both

### Recommended next implementation order
1. Extract shared core from extension logic
2. Define stable internal schemas
3. Define the web-to-companion job contract
4. Turn extension into browser companion / execution agent
5. Build backend job orchestration
6. Build web UI

---

## 12. What is canonical vs non-canonical right now

### Canonical documents
- [Documentation/functionalRequirements.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/functionalRequirements.md)
- [Documentation/webVersionImplementationPlan.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webVersionImplementationPlan.md)
- [Documentation/webCompanionJobContract.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webCompanionJobContract.md)

### Canonical implementation surfaces
- [extension](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension)
- [src/core](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/src/core)

### Removed legacy surface
The old indexed-search mini web / CLI is no longer present in the repository and should not drive future architecture decisions.

---

## 13. Current repository structure

### Root
- [package.json](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/package.json)
- [package-lock.json](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/package-lock.json)
- [README.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/README.md)

### Product documentation
- [Documentation/functionalRequirements.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/functionalRequirements.md)
- [Documentation/webVersionImplementationPlan.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webVersionImplementationPlan.md)
- [Documentation/webCompanionJobContract.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webCompanionJobContract.md)
- [Documentation/AI Documentation/projectKnowledgeHandoff.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/AI%20Documentation/projectKnowledgeHandoff.md)

### Shared core
- [src/core/domain-core.cjs](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/src/core/domain-core.cjs)
- [src/core/README.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/src/core/README.md)

### Extension
- [extension/manifest.json](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/manifest.json)
- [extension/background.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/background.js)
- [extension/content-script.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/content-script.js)
- [extension/core/domain-core.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/core/domain-core.js)
- [extension/popup.html](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.html)
- [extension/popup.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.js)
- [extension/popup.css](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.css)
- [extension/README.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/README.md)

---

## 14. Current npm scripts

Current root scripts:

- `npm run sync:core`

The extension is loaded manually through Chrome:
- `chrome://extensions`
- developer mode
- load unpacked from the `extension/` directory

---

## 15. Guidance for future AI agents

### If continuing extension work
Priorities should likely be:
1. refactor shared analysis logic out of `content-script.js`
2. improve ranking table UX
3. add assumption editing
4. improve long scan management
5. add better persistence/export options

### If starting the web product
Do this first:
1. treat the extension as an invisible browser companion
2. do not rebuild scraping logic in a backend first
3. keep auth and persistence in the web app, not in the extension
4. extract a shared core before building orchestration

### If reviewing architecture
Do not assume:
- the old root README describes the main product direction
- a removed indexed-search stack should be revived as the foundation for the web app
- the extension popup itself is the intended user-facing web workflow

Do assume:
- the extension runtime is the current live execution truth
- the documentation under `Documentation/` is canonical
- the web app should own jobs, persistence, and user state

---

## 16. Recommended immediate next tasks

If another AI picks up the work, good next actions are:

### Option A. Productize the extension further
- add sort dropdown for the ROI ranking if not yet implemented in the live UI
- add richer zone scan table
- add configurable profitability assumptions
- add CSV export

### Option B. Start the web product properly
- create a shared domain core
- define result schemas
- define browser companion API between web, extension, and backend
- choose stack for backend and frontend

### Option C. Stabilize and document
- add technical requirements document
- add acceptance criteria per use case
- add test plan and manual QA scenarios

---

## 17. Final takeaway

This project should be understood as:

> a live-browser-based Idealista analysis engine for buy-to-rent screening, with a web app as the target product surface and a browser companion as the live execution layer.

That framing is the safest high-level mental model for any future AI contributor.
