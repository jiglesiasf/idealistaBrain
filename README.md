# Idealista Brain

`Idealista Brain` is an Idealista buy-to-rent analysis product built around:

- a web app for auth, jobs, persistence, and results
- a browser companion extension for live Idealista execution in the user's real browser session

The old indexed-search mini web and CLI have been removed from this repository because they were obsolete and no longer matched the approved product direction.

## Current source of truth

- Live execution logic: [extension](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension)
- Shared analysis core: [src/core](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/src/core)
- Functional scope: [Documentation/functionalRequirements.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/functionalRequirements.md)
- Web-product architecture: [Documentation/webVersionImplementationPlan.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webVersionImplementationPlan.md)
- Web-companion contract: [Documentation/webCompanionJobContract.md](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/Documentation/webCompanionJobContract.md)

## Repository focus

This repo currently contains:

- the Next.js web app shell
- the Chrome extension companion that runs against the user's real Idealista browser session
- the shared domain core reused by both surfaces
- the product documentation that defines the approved use cases

## Run the web app

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run build
npm run sync:core
```

## Web environment

Minimum environment variables for the web app:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_COMPANION_EXTENSION_ID=
IMAP_HOST=
IMAP_PORT=
IMAP_SECURE=true
IMAP_USER=
IMAP_PASSWORD=
IMAP_MAILBOX=INBOX
IDEALISTA_ALERTS_FROM_FILTER=idealista
IMAP_POLL_MAX_MESSAGES=20
```

Notes:

- `NEXT_PUBLIC_COMPANION_EXTENSION_ID` is needed for page-to-extension dispatch from the web app.
- `SUPABASE_SERVICE_ROLE_KEY` is used by companion-facing backend endpoints to accept progress and result writes.
- `IMAP_*` variables are used by the alert-ingestion poller for the dedicated Idealista inbox.
- `IDEALISTA_ALERTS_FROM_FILTER` lets the poller ignore non-Idealista messages in the mailbox.

## Load the extension

1. Open `chrome://extensions`.
2. Enable developer mode.
3. Click `Load unpacked`.
4. Select [extension](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension).

## Current product direction

The product should be built as:

- web app for UI, jobs, persistence, and results
- browser companion based on the extension for live Idealista access
- no user account inside the extension
- no manual JSON transfer as the main user workflow

The current implementation step in progress is:

- web app scaffold with `Next.js + Supabase Auth`
- persisted `jobs` and companion-facing APIs
- shared core extraction from the extension
- first alert-driven foundations:
  - `saved_searches`
  - inbox message persistence
  - IMAP polling endpoint at `/api/inbox/poll`
