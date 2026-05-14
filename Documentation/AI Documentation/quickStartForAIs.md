# Quick Start for AIs

## What this project is
`Idealista Brain` is a buy-to-rent analysis product for Idealista listings.

Its purpose is to:
- analyze a sale listing
- find comparable rental listings
- estimate monthly rent
- estimate ROI metrics
- scan a sale-results page and rank opportunities

## Current source of truth
The **Chrome extension** is the current live execution surface.

Main folder:
- [extension](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension)

The old indexed-search mini web / CLI has been removed from the repo.

Do **not** rebuild the product around generic indexed-search fallbacks.

## Canonical product docs
- [functionalRequirements.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/functionalRequirements.md)
- [webVersionImplementationPlan.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webVersionImplementationPlan.md)
- [webCompanionJobContract.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webCompanionJobContract.md)
- [idealistaAlertsIntegrationPlan.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/idealistaAlertsIntegrationPlan.md)
- [projectKnowledgeHandoff.md](</Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/AI Documentation/projectKnowledgeHandoff.md>)

## Core product constraints
- Idealista blocks generic backend scraping.
- The safest execution layer is the user's real browser session.
- That is why the extension exists.
- For the web product, that extension should act as an invisible browser companion rather than as a second authenticated product.

## Current approved use cases
- `UC-01` Analyze current sale listing
- `UC-02` Search rental comparables
- `UC-03` Estimate monthly rent
- `UC-04` Estimate profitability
- `UC-05` Scan a zone and rank opportunities
- `UC-06` Export current analysis as JSON

## Critical business rules

### Comparable search
- Search same zone first
- Then same municipality
- Do not leave the municipality in the current MVP
- Keep collecting comparables; do not stop early once the minimum is reached
- Comparable must be a full-property rental
- Exclude:
  - temporary rentals
  - room-only rentals
  - non-residential assets
  - 404/unavailable listings

### Profitability assumptions
- Buyer cash contribution = 30% of property price
  - 20% down payment
  - 10% taxes/acquisition costs
- Mortgage = 80% of property price
- Mortgage type = fixed 2.5%
- Mortgage term = 25 years

### Ranking color signal
Based on `ROI cash to cash`:
- green if `> 25%`
- yellow if `15% - 25%`
- soft red if `< 15%`

### Ranking sort options
- `ROI cash to cash`
- `ROI cash to cash neto`
- `ROI bruto`
- `ROI neto`

## Important files in the extension
- [manifest.json](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/manifest.json)
- [background.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/background.js)
- [content-script.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/content-script.js)
- [popup.html](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.html)
- [popup.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.js)
- [popup.css](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/popup.css)

## Mental model of the current architecture
- `content-script.js` contains most extraction and business logic
- `background.js` orchestrates tabs and long-running actions
- `popup.js` renders the UI and triggers workflows
- `src/core/` is now the first extracted shared domain layer

## Current implementation limitations
- extension logic is still too concentrated in `content-script.js`
- zone scan is page-level only
- no automatic pagination yet
- no full web product yet

## Recommended next steps

### If continuing extension work
1. Extract shared core logic from `content-script.js`
2. Improve scan persistence and exports
3. Add configurable profitability assumptions
4. Improve the ranking table UX

### If starting the web product
1. Keep extension as browser companion
2. Build shared domain core
3. Define the job contract between web, backend, and companion
4. Build backend jobs and persistence
5. Build web frontend on top of that

## One-sentence summary
This is an Idealista investment analysis engine that should evolve into a web product powered by shared logic and an invisible browser companion for live execution.

## Current next strategic layer
The next major product layer is an alert-driven pipeline:

- Idealista alert emails land in a dedicated inbox
- the system ingests and parses them
- new listings trigger automatic `listing-analysis`
- the web eventually becomes a daily radar for new opportunities
