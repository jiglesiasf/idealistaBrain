# Shared Core

This folder is the first extraction of the shared domain layer for the future web product.

## Canonical source

- [domain-core.cjs](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/src/core/domain-core.cjs)

## What lives here

- comparable-search strategy and rules
- comparable validation and scoring
- rent estimation
- profitability estimation
- zone-opportunity ranking helpers

## Extension sync

The extension consumes a synced copy at:

- [extension/core/domain-core.js](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension/core/domain-core.js)

After editing the canonical source, run:

```bash
npm run sync:core
```

This keeps the extension on the same business logic that the future backend and web app will reuse.
