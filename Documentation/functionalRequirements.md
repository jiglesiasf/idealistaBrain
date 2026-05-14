# Functional Requirements

## Purpose
This document captures the functional requirements currently defined for the Chrome extension `Idealista Brain`.

The review workflow for this document is sequential:
1. We draft one use case.
2. We review and adjust it together.
3. Once approved, we move to the next one.

## Use Case Inventory
- `UC-01`: Analyze the current Idealista sale listing
- `UC-02`: Search rental comparables for the current listing
- `UC-03`: Estimate monthly rent from validated comparables
- `UC-04`: Estimate profitability metrics for the current listing
- `UC-05`: Scan a sale-results page and rank opportunities by cash-to-cash ROI
- `UC-06`: Export the current analysis as JSON

---

## UC-01: Analyze the current Idealista sale listing

### Goal
The user wants the extension to read the currently open Idealista property page and generate a normalized property profile that can be used for later comparable-search and profitability analysis.

### Primary actor
User

### Trigger
The user opens an Idealista property page and clicks `Analizar ficha actual`.

### Preconditions
- The active browser tab is an Idealista page.
- The page corresponds to an individual property listing.
- The extension popup is open.

### Main flow
1. The user opens the popup.
2. The user clicks `Analizar ficha actual`.
3. The extension reads the active tab.
4. The extension verifies that the page is an individual Idealista listing.
5. The extension extracts the listing context from the live DOM.
6. The extension normalizes the property data into a structured asset profile.
7. The extension displays the normalized result in the popup.

### Extracted data
The extension should try to extract, when available:
- Listing ID
- Canonical URL
- Listing title
- Operation type
- Property type
- Asking price
- Area in square meters
- Price per square meter
- Number of rooms
- Number of bathrooms
- Floor
- Elevator
- Exterior/interior
- Property condition
- Zone / neighborhood
- Municipality
- Province
- Coordinates
- Confidence score for the normalized asset

### Expected output
The popup should display:
- The listing identity
- A normalized property summary
- A normalized location summary
- The comparable-search strategy
- Comparable rules and guardrails
- Supporting links detected on the page

### Alternative flows
- If the active tab is not an Idealista page, the extension should show an error message.
- If the active tab is an Idealista page but not an individual listing, the extension should show an error message.
- If some fields cannot be extracted, the extension should still return a partial normalized profile and mark missing values as not detected.

### Postconditions
- The normalized analysis is available in the popup.
- The normalized analysis can be reused by later actions such as comparable search or JSON export.

### Notes
- This use case does not yet calculate rent or profitability by itself.
- This use case is the entry point for the single-listing workflow.

### Review status
Approved

---

## UC-02: Search rental comparables for the current listing

### Goal
The user wants the extension to find live rental listings in Idealista that are comparable to the currently analyzed sale listing.

### Primary actor
User

### Trigger
The user opens an analyzed sale listing and clicks `Buscar comparables`.

### Preconditions
- The active browser tab is an individual Idealista sale listing.
- The extension can extract a normalized asset profile from that listing.
- The listing has at least enough geographic information to identify a municipality.

### Main flow
1. The user opens the popup on a sale listing.
2. The user clicks `Buscar comparables`.
3. The extension analyzes the current sale listing if needed.
4. The extension derives the search scopes.
5. The extension searches rental listings in the first scope: same zone.
6. The extension reads candidate rental listings from live Idealista pages.
7. The extension validates each candidate against the comparable rules.
8. If the number of valid comparables is lower than the target threshold, the extension expands the search to the municipality scope.
9. The extension validates the municipality-level candidates.
10. The extension continues collecting comparables within the allowed scopes instead of stopping early once a minimum threshold is reached.
11. The extension stores the valid comparables, discarded candidates, and search trace.
12. The extension displays the results in the popup.

### Search scopes
The extension should search in this order:
1. Same zone
2. Same municipality

The extension must not expand beyond the municipality in the current MVP.

### Comparable rules
The extension should enforce these hard filters:
- Same municipality
- Same property family
- Listing must correspond to a full-property rental, not a room or partial rental
- Exclude 404 or unavailable listings
- Exclude temporary rentals
- Exclude room-only listings
- Exclude non-residential assets such as garages, storage units, or commercial units

The extension should apply these softer similarity criteria:
- Prioritize same zone
- Similar room count
- Similar area
- Similar condition when available

### Expected output
The popup should display:
- Estimated number of comparables found
- List of valid comparables
- List of discarded candidates with rejection reason
- Search trace including visited search URLs and candidate counts

### Alternative flows
- If Idealista blocks automated access during the search, the extension should report that block in the search trace.
- If a search URL returns 404, the extension should report that URL failure in the search trace.
- If no valid comparables are found, the extension should still show the discarded results and the search trace.
- Even if the same-zone search already produces enough valid comparables, the extension should keep collecting all available comparables within the defined search scopes.

### Postconditions
- A comparable-search result is available in the popup.
- The result includes both the accepted comparables and an explanation of the rejected ones.
- The result can be reused by rent estimation and profitability estimation.

### Notes
- The current implementation uses the real browser session and live Idealista pages instead of index-based search.
- This use case is focused on gathering comparable rental evidence, not yet on computing profitability itself.

### Review status
Approved

---

## UC-03: Estimate monthly rent from validated comparables

### Goal
The user wants the extension to estimate a realistic monthly rent for the current sale listing based on the validated rental comparables collected from Idealista.

### Primary actor
User

### Trigger
The extension has already completed a comparable-search process for the current sale listing.

### Preconditions
- A normalized sale listing exists.
- The extension has already collected and validated rental comparables.
- At least one valid comparable with usable rent data is available.

### Main flow
1. The extension gathers the validated comparables with detected rental price.
2. The extension checks whether enough comparable data exists to estimate rent per square meter.
3. If enough rent-per-square-meter data exists, the extension estimates the subject rent using the comparable rent-per-square-meter distribution.
4. If not enough rent-per-square-meter data exists, the extension falls back to a direct monthly-rent estimation based on the comparable rent distribution.
5. The extension calculates:
   - a central monthly-rent estimate
   - a lower bound
   - an upper bound
   - a confidence level
6. The extension displays the result in the popup.

### Estimation logic
The extension should:
- Use only validated comparables
- Prefer a method based on rent per square meter when enough data exists
- Fall back to direct monthly-rent comparison when the preferred method is not possible
- Use a robust central estimate rather than a naive arithmetic average

### Expected output
The popup should display:
- Estimated monthly rent
- Estimated lower and upper range
- Number of comparables used
- Confidence level
- Estimation method used

### Alternative flows
- If no valid comparable has usable rent data, the extension should return that no usable rent estimate is available.
- If only a very small number of comparables is available, the extension should still estimate rent when possible, but lower the confidence level.

### Postconditions
- A monthly-rent estimate is available for later profitability calculations.
- The estimate is tied to the comparable-search result used to produce it.

### Notes
- This use case is about rental estimation only, not profitability.
- The estimation should remain explainable to the user through method and confidence signals.

### Review status
Approved

---

## UC-04: Estimate profitability metrics for the current listing

### Goal
The user wants the extension to estimate the profitability of buying the current sale listing and renting it out, based on the estimated rent and a defined set of operating assumptions.

### Primary actor
User

### Trigger
The extension has already produced a monthly-rent estimate for the current sale listing.

### Preconditions
- A normalized sale listing exists.
- A usable monthly-rent estimate exists.
- The asking price of the property is known.

### Main flow
1. The extension takes the sale price and estimated monthly rent as inputs.
2. The extension calculates the estimated annual gross rent.
3. The extension applies the configured acquisition-cost assumption.
4. The extension applies the configured equity-contribution assumption.
5. The extension applies the configured annual operating-cost assumptions.
6. The extension calculates:
   - ROI cash to cash
   - ROI cash to cash neto
   - ROI bruto
   - ROI neto
7. The extension displays the profitability output in the popup.

### Metrics
The extension should calculate:
- `ROI cash to cash`
  Definition:
  Annual net rental income divided by estimated cash invested by the buyer.
- `ROI cash to cash neto`
  Definition:
  Annual net rental income after mortgage payments divided by estimated cash invested by the buyer.
- `ROI bruto`
  Definition:
  Annual gross rental income divided by total acquisition cost.
- `ROI neto`
  Definition:
  Annual net rental income divided by total acquisition cost.

### Current assumptions
The extension currently assumes:
- Buyer cash contribution equal to 30% of the property price, split as:
  - 20% of the property price as non-financed purchase contribution
  - 10% of the property price as taxes and acquisition costs
- Acquisition costs equal to 10% of the property price
- Mortgage financing equal to 80% of the property price
- Fixed mortgage interest rate of 2.5%
- Mortgage term of 25 years
- Vacancy cost
- Management cost
- Maintenance cost
- Local taxes and community cost
- Insurance and incident cost

### Mortgage logic
For the `ROI cash to cash neto` calculation, the extension should:
1. Estimate the financed principal as 80% of the property purchase price.
2. Calculate the monthly mortgage payment using:
   - fixed interest rate of 2.5%
   - term of 25 years
3. Convert that monthly mortgage payment into annual mortgage cost.
4. Subtract annual mortgage cost from annual net rental income.
5. Divide the resulting annual post-debt cash flow by the estimated cash invested by the buyer.

### Expected output
The popup should display:
- ROI cash to cash
- ROI cash to cash neto
- ROI bruto
- ROI neto
- Annual gross rent
- Estimated total acquisition cost
- Estimated invested cash
- Estimated annual mortgage cost
- Estimated annual post-debt cash flow
- Estimated annual operating costs
- Estimated annual net rent
- The operating-cost assumptions included in the calculation

### Alternative flows
- If the extension has no usable rent estimate, it should report that profitability cannot yet be calculated.
- If the purchase price is missing, it should report that profitability cannot yet be calculated.
- If profitability is calculated with simplified assumptions, the extension should make that explicit.

### Postconditions
- A first-pass profitability estimate is available for the current listing.
- The profitability estimate can be compared with those of other listings.

### Notes
- The `ROI cash to cash neto` uses a simplified fixed-rate mortgage assumption rather than a real bank offer.
- The mortgage calculation should assume an 80% loan-to-value over the property price, while the buyer contributes 20% of the property price plus 10% of the property price in taxes and acquisition costs.
- The current calculation does not yet include renovation budget, actual taxes by region, or user-specific financing structure.
- This use case is intentionally a first-pass investment screen, not a complete financial underwriting model.

### Review status
Approved

---

## UC-05: Scan a sale-results page and rank opportunities by cash-to-cash ROI

### Goal
The user wants the extension to scan a sale-results page in Idealista, analyze each visible sale listing, estimate its rental potential and profitability, and return a ranked list of opportunities ordered by cash-to-cash profitability.

### Primary actor
User

### Trigger
The user opens a sale-results page in Idealista and clicks `Escanear zona`.

### Preconditions
- The active browser tab is an Idealista sale-results page.
- The page contains visible sale listings.
- The extension can open and analyze the individual sale listings from that page.

### Main flow
1. The user opens an Idealista sale-results page.
2. The user opens the popup.
3. The user clicks `Escanear zona`.
4. The extension reads the currently visible sale listings from the live results page.
5. The extension creates a processing queue from those visible listings.
6. The extension opens each listing one by one in the real browser session.
7. For each listing, the extension:
   - extracts and normalizes the property
   - searches rental comparables
   - estimates monthly rent
   - estimates profitability
8. The extension stores the successful analyses and the failed analyses separately.
9. The extension sorts the successfully analyzed opportunities using the currently selected profitability metric.
10. The extension displays the ranked opportunities in the popup.
11. The user can change the sort criterion from the popup without rerunning the full scan.

### Scope of the MVP
In the current MVP, the extension should:
- Scan only the listings visible on the currently open results page
- Not paginate automatically to the next page
- Process listings sequentially rather than in parallel

### Ranking logic
The extension should:
- Present the ranking in a table-like opportunity view
- Include a dropdown menu that lets the user choose the sort metric
- Support sorting by the ROI metrics currently defined in the extension
- Display the corresponding listing link for each ranked opportunity
- Surface a profitability color signal in the ranking:
  - Green when `ROI cash to cash > 25%`
  - Yellow when `ROI cash to cash` is between `15%` and `25%`
  - Soft red when `ROI cash to cash < 15%`

### Sort options
The extension should support sorting by:
- `ROI cash to cash`
- `ROI cash to cash neto`
- `ROI bruto`
- `ROI neto`

### Expected output
The popup should display:
- Number of listings detected on the page
- Number of listings queued
- Number of listings successfully analyzed
- Ranked opportunity list
- Sort dropdown for profitability metric selection
- Failure list for listings that could not be analyzed
- Link to each ranked listing

### Alternative flows
- If the current page is not a sale-results page, the extension should show an error.
- If no sale listings are detected on the page, the extension should report that no scannable listings were found.
- If some listings fail during analysis, the extension should continue scanning the rest of the queue and report the failures separately.
- If some listings cannot produce a usable profitability estimate, they may still appear in the result set but should be clearly marked as incomplete or non-rankable.

### Postconditions
- A zone-scan result is available in the popup.
- The result contains both a ranked list of opportunities and a list of failures.
- The result can be copied as part of the JSON export.

### Notes
- This use case reuses the same listing-analysis, comparable-search, rent-estimation, and profitability-estimation logic used in the single-listing workflow.
- The current MVP is a page-level scanner, not yet a full multi-page crawler.
- The ranking is intended as a first-pass prioritization mechanism, not as a final investment decision.
- The profitability color signal remains tied to `ROI cash to cash`, even when the list is sorted by another ROI metric.

### Review status
Approved

---

## UC-06: Export the current analysis as JSON

### Goal
The user wants to export the currently available analysis data from the extension in JSON format so it can be inspected, saved, or reused outside the popup.

### Primary actor
User

### Trigger
The user clicks `Copiar JSON`.

### Preconditions
- At least one analysis context exists in the extension:
  - single-listing analysis
  - comparable-search result
  - zone-scan result

### Main flow
1. The user opens the popup.
2. The user clicks `Copiar JSON`.
3. The extension determines which analysis payloads are currently available.
4. The extension builds the export payload from the available data.
5. The extension copies the JSON payload to the clipboard.
6. The extension confirms success in the popup status area.

### Export contents
The extension should export the currently available data, including when present:
- Single-listing analysis
- Comparable-search result
- Rent estimate
- Profitability estimate
- Zone-scan result

### Expected output
The extension should:
- Copy a valid JSON payload to the clipboard
- Preserve the available analysis structure
- Inform the user whether the copy operation succeeded or failed

### Alternative flows
- If no analysis data is available, the extension should show an error and not attempt export.
- If clipboard access fails, the extension should show an error message.

### Postconditions
- The current analysis payload is available in the system clipboard as JSON.

### Notes
- The export should reflect only the data currently available in the popup session.
- The export format is intended for transparency and interoperability, not yet as a final public API contract.

### Review status
Draft
