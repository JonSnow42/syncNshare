# Sync & Share
https://sync-nshare.vercel.app/
A compact social listening demo for small groups. It uses Node.js, a local JSON database for development or PostgreSQL for cloud hosting, and YouTube's supported embedded player.

## Features

- Username/password signup, login, and persistent browser sessions (passwords use scrypt).
- Profiles with editable display name and bio; activity visibility for everyone, followers, or only yourself.
- Follow/unfollow and profile activity visibility checks on the server.
- Public and private rooms with invitation codes, host close/restart, member permissions, and shared playback state.
- Personal listening, audience-controlled sharing, account discovery, followers and Close Friends access.
- Shared listening sessions with join/leave, participants, chat, approximate single-video playback sync, and host-approved song requests.
- YouTube video and full-playlist links in the queue, votes, host track removal, and member-only room chat.
- Responsive dark UI; room state and chat refresh every four seconds.

## Run locally

Requires Node.js 20 or newer.

```sh
npm run check
npm start
```

Open <http://localhost:3000>. Data is stored in `.data/database.json`; `.data` is ignored by Git. Copy `.env.example` to `.env` to configure the server; `npm start` loads it. Set `PORT` or `DATA_DIR` to change the defaults. Login sessions last up to 30 days and are stored as SHA-256 token hashes in the JSON data file.

For local multi-port testing, run each process with a different `PORT` and the same `DATA_DIR`, for example `DATA_DIR=.data PORT=3001 npm start` and `DATA_DIR=.data PORT=3002 npm start`. API requests reload the shared JSON data while holding a local file lock. Instances using different data directories do not share accounts, sessions, or playback state.

## Configuration and deployment

Local development uses `.data/database.json` when `DATABASE_URL` is unset. For cloud mode, configure `DATABASE_URL` with the Supabase PostgreSQL transaction-pooler connection string, then run `npm run db:migrate` and `npm run db:import` before deployment. The importer reads `.data/database.json` and records a one-time import marker. Keep `.env` and the JSON database out of Git.

Vercel serves `public/` as static files and dispatches `/api/*` to the Node.js Function in `api/[...path].js`. Cloud requests require `DATABASE_URL`; the local JSON file is never used as a Vercel persistence fallback. Configure `DATABASE_URL` in Vercel's server-side environment settings for Preview and Production. No database secret is used in browser code.

## Data and access model

The local JSON store persists users, follows, rooms, memberships, queue items, votes, sessions, and messages. Cloud mode stores those records in PostgreSQL tables with foreign keys, uniqueness constraints, and row-level security enabled. Password hashes use per-user random salts and Node's scrypt; session cookies are HttpOnly and SameSite=Lax. Every room content endpoint checks membership. Private-room lookup requires an invitation code; room IDs alone do not authorize access. Only the host changes shared playback or removes queue items.

The JSON store remains for local development only. Cloud requests use short PostgreSQL transactions so Vercel instances share durable state. Chat and playback status continue to refresh through the existing HTTP polling; no WebSocket service is required for this deployment stage.

## Music and sync notes

Videos and playlists are embedded from YouTube; the app does not download or proxy audio. Single videos use the YouTube IFrame Player API and synchronize playback state and approximate position through server polling. Playlist links use YouTube's playlist embed and are queued as one item; playlist player state is not corrected through the JavaScript synchronization callbacks. Autoplay, buffering, ads, embedding restrictions, and network delay can affect playback; listeners may need to activate playback manually.

## Demo setup

Register two accounts in separate browser profiles. Follow each other on People, create a public room with one account, join it with the other, add a YouTube link, vote, and exchange chat messages. Create a private room and share its displayed invite code; room IDs do not grant access. Change activity visibility on one profile and check it from the other account.

## Verification

Run `npm run check` for JavaScript syntax checks. `DEMO_TEST_CHECKLIST.md` records the end-to-end manual scenarios and what was exercised in this workspace. A public deployment and external YouTube playback availability have not been verified.
