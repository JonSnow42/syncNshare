# Sync & Share

A compact social listening demo for small groups. It uses Node.js built-ins, a JSON file database, and YouTube's supported embedded player. No package install is needed.

## Features

- Username/password signup, login, and persistent browser sessions (passwords use scrypt).
- Optional Google single sign-on (OAuth 2.0 / OpenID Connect).
- Profiles with editable display name and bio; activity visibility for everyone, followers, or only yourself.
- Follow/unfollow and profile activity visibility checks on the server.
- Public rooms and private rooms protected by invitation codes.
- Room members, host permissions, shared track selection and playback status.
- YouTube video and full-playlist links in the queue, votes, host track removal, and member-only room chat.
- Responsive dark UI; room state and chat refresh every four seconds.

## Run locally

Requires Node.js 20 or newer.

```sh
npm run check
npm start
```

Open <http://localhost:3000>. Data is stored in `.data/database.json`; `.data` is ignored by Git. Copy `.env.example` to `.env` to configure the server; `npm start` loads it. Set `PORT` or `DATA_DIR` to change the defaults. Sessions survive page reloads for 30 days but are held in memory, so a server restart signs users out.

### Enable Google sign-in

Create a Google OAuth 2.0 client ID for a Web application in Google Cloud Console. Add the app origin to Authorized JavaScript origins and this callback to Authorized redirect URIs: `APP_URL/auth/google/callback` (for local development, `http://localhost:3000/auth/google/callback`). Set `APP_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in `.env` and restart the app. The client secret stays server-side. When these values are missing, the Google sign-in option is visibly unavailable; username/password sign-in continues to work. Google OAuth has not been exercised with real credentials in this workspace.

## Configuration and deployment

Copy `.env.example` for variable names if using an environment-file loader (none is required by the app). The current app is suitable for a single persistent Node server with HTTPS and a persistent writable disk. It is **not yet a Vercel deployment**: Vercel's serverless filesystem is not a durable database, and this repo does not yet use Supabase or another hosted database. No hosting account credentials were present during setup.

To make the public deployment reliable, provision a persistent Node host and durable database, or configure Supabase and migrate the tables and authorization rules. Then set `PORT`/`DATA_DIR` as appropriate, add HTTPS, deploy, and verify two-account flows on the public URL. Never put service credentials in client code. There is no verified public URL yet.

## Data and access model

The server persists users, follows, rooms, memberships, queue items, votes, and messages to a local JSON file. Password hashes use per-user random salts and Node's scrypt; session cookies are HttpOnly and SameSite=Lax. Every room content endpoint checks membership. Private-room lookup requires an invitation code; room IDs alone do not authorize access. Only the host changes shared playback or removes queue items. Follow and vote uniqueness is enforced by checking and replacing the relevant relation before save.

This local JSON store is a single-process demo database: it does not provide transactional concurrency across multiple server instances, managed backups, Supabase RLS, or horizontally scaled realtime. Do not use it for sensitive or production workloads.

## Music and sync notes

Videos and playlists are embedded with YouTube's official iframe player (privacy-enhanced domain); the app does not download or proxy audio. Add individual YouTube links one at a time, or paste a playlist link to add the complete playlist as one queue item. The embedded player plays the playlist in YouTube's order. Public or unlisted playlists that YouTube allows to embed are supported; private, deleted, restricted, or otherwise unembeddable content may fail. Playlist items are voted/queued as a group rather than expanded into separate app queue rows. The host controls selected queue item and a persisted playing/paused indicator; playback timing is not synchronized, and each listener may need to press play due to browser autoplay restrictions.

## Demo setup

Register two accounts in separate browser profiles. Follow each other on People, create a public room with one account, join it with the other, add a YouTube link, vote, and exchange chat messages. Create a private room and share its displayed invite code; room IDs do not grant access. Change activity visibility on one profile and check it from the other account.

## Verification

Run `npm run check` for JavaScript syntax checks. `DEMO_TEST_CHECKLIST.md` records the end-to-end manual scenarios and what was exercised in this workspace. A public deployment and external YouTube playback availability have not been verified.
