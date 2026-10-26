# Daily Plate

Personal meal, workout and progress journal with visual guides. Existing meals, training schedule, macro targets and charts are preserved.

## Cloud saving

Hosted on Sites with Cloudflare D1. Sign in with ChatGPT to save fitness and nutrition records to your account. Each API operation scopes records to the dispatch-authenticated user. Guests can continue using browser storage.

Existing browser records are imported only when the user selects **Import browser data**. Account caches are separate from guest records and from other accounts. Edits are cached locally until uploaded. Revision checks reject conflicting changes rather than overwriting newer records. On conflict, download a backup before reloading cloud records. The app needs a connection to verify identity at page load; offline startup uses guest browser data.

## Source

- `public/`: existing interface, visual guides, cloud sync client.
- `app/api/progress/route.ts`: authenticated API entrypoint.
- `lib/progress.mjs`: bounded validation, ownership checks and revision-based persistence.
- `db/schema.ts`, `drizzle/`: D1 schema and migration history.

## Validation

`node tests-progress.mjs` checks authentication, user isolation, origin enforcement, validation, persistence and conflicting writes using SQLite.

Use the Sites build and publish workflow. Hosted migrations are applied during deployment. Browser QA could not be completed in the authoring environment.

This version uses Sites authentication and D1; it is not a Vercel-compatible deployment without adapting those integrations.
