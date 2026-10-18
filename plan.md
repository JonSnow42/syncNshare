# Cloud backend and database checklist

Goal: deploy the existing Sync & Share backend on Vercel with durable shared data, while preserving username/password login, rooms, queues, chat, and shared YouTube listening behavior.

## Backend

- [x] Extract the API routing logic from `server.js` into a handler that can run as a Vercel Node.js Function; keep local `npm start` working.
- [x] Use PostgreSQL for cloud requests; do not use function memory or `/tmp` as persistent/shared state. Keep JSON files for local development only.
- [x] Add Vercel routes for the existing `/api/*` endpoints. Keep the existing frontend API paths.
- [x] Keep authorization in the backend: audience discovery/join rules, room membership, host-only playback/queue changes, chat access, and host-only song-request approval.
- [x] Keep the current HTTP polling approach; do not add WebSockets or new product features in this work.
- [x] Read the hosted database URL only from the server environment.
- [x] Keep the existing username/password signup and login flow.

## Database

- [ ] Create a Supabase project and configure its transaction-pooler URL. The app's PostgreSQL adapter and schema are ready for this connection.
- [x] Add versioned database migrations for existing data: users and password fields, hashed login sessions, follows, Close Friends, personal playback/queue, rooms/members, room queue/votes/messages, shared sessions/participants/messages, and song requests.
- [x] Add foreign keys, uniqueness constraints, and indexes for IDs, memberships, relationships, votes, active host sessions, and session/room polling queries.
- [x] Use database transactions for state changes, including follow/unfollow with Close Friends cleanup, session membership, playback updates, and song request approval with exactly-once queue insertion.
- [x] Keep password hashes and session token hashes server-side; never return them from account/profile APIs.
- [ ] Back up `.data/database.json`, stop local app instances, then run the idempotent importer and verify its record counts before switching production traffic to PostgreSQL. The importer preserves existing IDs and refuses a different second import.

## Deploy and verify

- [ ] Add Vercel deployment configuration for the static frontend and Function routes; set the correct SPA fallback without routing API paths to `index.html`.
- [ ] Add `DATABASE_URL` in Vercel's environment settings for Preview and Production. Do not commit `.env` or database credentials.
- [ ] Deploy a Preview and verify with two accounts that signup/login, Peoples and follows, audience permissions, joining, host playback updates, rooms/queues/chat, and song-request approval work across separate browser sessions.
- [ ] Verify unauthorized API operations are rejected, reloads retain data, and a new Function instance sees the same state.
- [ ] Run `npm run check` and the existing API/browser acceptance checks before production deployment.

## Scope limits

- Preserve the current frontend and YouTube IFrame Player integration.
- Keep chat and playback updates on the existing polling mechanism for this deployment step.
- Do not add new social features, UI redesigns, or a framework migration.
