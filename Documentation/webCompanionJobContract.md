# Web Companion Job Contract

## Purpose
This document defines the first contract between:
- the web frontend
- the web backend
- the browser companion extension

It exists to support the v1 product goal:
- the user pastes an Idealista URL in the web app
- the web app creates a job
- the companion executes the live browser work
- the web app shows progress and persisted results

The user should not need to manually copy JSON between surfaces.

---

## Participants

### 1. Web frontend
Responsibilities:
- authenticated product UI
- create jobs
- detect whether the companion is available
- dispatch a job to the companion
- poll backend job status
- render results

### 2. Web backend
Responsibilities:
- authenticate the user
- create and own jobs
- mint short-lived execution tokens
- receive companion progress and final results
- persist job state and outputs
- serve results to the web app

### 3. Browser companion
Responsibilities:
- receive a job from the web page
- open and read live Idealista pages in the real browser session
- execute the relevant use case with the shared core
- report progress and completion to the backend

Non-responsibilities:
- no user account
- no long-term job history
- no product-level persistence

---

## Supported v1 job types
- `listing-analysis`
- `zone-scan`

### `listing-analysis`
Input:
- one Idealista sale listing URL

Output:
- normalized asset
- comparables
- rent estimate
- profitability

### `zone-scan`
Input:
- one Idealista sale-results URL

Output:
- scanned listings from the current visible results page
- ranked opportunities
- failures

---

## High-level flow
1. The user pastes a URL into the web app.
2. The web app calls `POST /api/jobs`.
3. The backend creates a job and returns:
   - `jobId`
   - `jobType`
   - `targetUrl`
   - `executionToken`
   - `executionTokenExpiresAt`
4. The web app tries to send that payload to the companion.
5. The companion acknowledges the job.
6. The companion posts progress and final result to the backend.
7. The web app polls `GET /api/jobs/:id`.
8. The backend returns the latest job status and result metadata.
9. The web app loads the final analysis view.

---

## Companion availability
The web page should talk directly to the extension through Chrome page-to-extension messaging.

The extension manifest should:
- declare the production web origin in `externally_connectable`
- only allow the intended app origins

If the companion is unavailable, the web app should:
- show a clear install prompt
- explain that live Idealista execution requires the companion

---

## Job statuses
V1 statuses:
- `queued`
- `dispatching`
- `running`
- `completed`
- `failed`

Optional progress stages:
- `accepted`
- `opening-target`
- `extracting-context`
- `searching-comparables`
- `estimating-rent`
- `estimating-profitability`
- `scanning-zone`
- `persisting-result`

---

## Web-to-companion message
The web page sends a single message to the extension.

Example shape:

```json
{
  "type": "IDEALISTA_BRAIN_EXECUTE_JOB",
  "payload": {
    "jobId": "job_123",
    "jobType": "listing-analysis",
    "targetUrl": "https://www.idealista.com/inmueble/123456789/",
    "executionToken": "opaque-short-lived-token",
    "backendBaseUrl": "https://app.example.com",
    "apiBasePath": "/api/companion"
  }
}
```

### Required payload fields
- `jobId`
- `jobType`
- `targetUrl`
- `executionToken`
- `backendBaseUrl`

### Companion immediate response
Success:

```json
{
  "ok": true,
  "accepted": true,
  "jobId": "job_123"
}
```

Failure:

```json
{
  "ok": false,
  "error": "Unsupported job type."
}
```

---

## Companion-to-backend APIs
All companion write APIs must require:
- `jobId`
- `executionToken`

The token should be:
- short-lived
- one-job scoped
- invalid after completion or failure

### Accept job
`POST /api/companion/jobs/:id/accepted`

Example body:

```json
{
  "executionToken": "opaque-short-lived-token",
  "payload": {
    "companionVersion": "0.1.0"
  }
}
```

### Progress update
`POST /api/companion/jobs/:id/progress`

Example body:

```json
{
  "executionToken": "opaque-short-lived-token",
  "payload": {
    "stage": "searching-comparables",
    "message": "Searching same-zone rental listings.",
    "progress": 45
  }
}
```

### Completion
`POST /api/companion/jobs/:id/completed`

Example body:

```json
{
  "executionToken": "opaque-short-lived-token",
  "payload": {
    "resultType": "listing-analysis",
    "result": {
      "subject": {},
      "comparables": [],
      "discarded": [],
      "estimate": {},
      "profitability": {},
      "searchTrace": []
    }
  }
}
```

### Failure
`POST /api/companion/jobs/:id/failed`

Example body:

```json
{
  "executionToken": "opaque-short-lived-token",
  "payload": {
    "stage": "opening-target",
    "message": "Idealista blocked access for this browser session."
  }
}
```

---

## Result persistence
V1 should store final outputs as JSON payloads tied to the job.

Recommended first tables:
- `jobs`
- `job_events`
- `listing_analyses`
- `zone_scans`

The normalized breakdown into more tables can come later if product needs justify it.

---

## Security notes
- The companion should not receive a web user session.
- The companion should only receive a job-scoped execution token.
- The token should only authorize:
  - accepting the assigned job
  - pushing progress for that job
  - completing or failing that job
- The companion should not be able to list user jobs or read user history.
- The extension should only be callable from approved web origins.

---

## V1 delivery constraints
- use polling from the web app first
- do not require realtime infrastructure before the first end-to-end flow works
- start with `listing-analysis` end to end
- add `zone-scan` once the listing workflow is stable
