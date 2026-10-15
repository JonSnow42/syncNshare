# Project state

Updated: 2026-10-15

## Works

- Self-contained Node.js web app with responsive home, discovery, people, profile, and room screens.
- Server-side account signup/login, scrypt password hashes, HttpOnly session cookies, profile edits, follow/unfollow, and activity privacy checks.
- Persistent public/private rooms, invitation-code join, membership-gated room content, host-only playback state and queue removal.
- YouTube URL/ID queue, member voting, member-only messages, participant list, and four-second room refresh.
- Official YouTube iframe embed.
- Refined visual hierarchy and typography; Google OAuth sign-in flow is available when server credentials are configured.
- Queue accepts individual YouTube videos or complete playlist URLs. Playlist queue items play through YouTube's official playlist embed.

## Does not work / limitations

- No public deployment URL. Vercel and Supabase credentials/CLI setup were not present. Current JSON persistence is not durable serverless storage and is only intended for a single-process demonstration.
- Google OAuth code is implemented but was not verified against a Google Cloud client; `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_URL` must be configured to enable it.
- Playlist embedding was not tested against real YouTube playlists; only embed-eligible public/unlisted playlists can play, and playlist items are queued/voted as a group.
- No Supabase migration/RLS, managed database backups, or multi-instance realtime.
- Playback state is coordinated, but video position/device playback is not synchronized; autoplay and embed eligibility depend on YouTube/browser policy.
- Automated full-browser UI verification and external YouTube playback were not performed.

## Changed files and data model

- `server.js`: built-in HTTP API, authentication, authorization, and JSON file persistence.
- `public/index.html`, `public/style.css`, `public/refined.css`, `public/app.js`: app UI and client behavior.
- `package.json`, `.gitignore`, `.env.example`: run scripts and configuration.
- `README.md`, `DEMO_TEST_CHECKLIST.md`, `CHANGELOG.md`: setup, demo, and progress records.
- JSON collections: users, follows, rooms, members, queue, votes, messages.

## Verification results

- Passed: `npm run check` (Node syntax checks for server and browser JavaScript).
- Passed: isolated local API smoke test for Google provider configuration state, page/refined CSS serving, individual video queue addition, and playlist queue addition; provider correctly reports unavailable and the OAuth start route returns 503 without credentials.
- Passed: local API smoke test with two separate users: registration (201 each), sign-in (200), private room ID denied to nonmember (403), invite-code join (200), queue addition (201), member chat (201), vote (200), follow (200).
- Not tested: profile form via browser, privacy with a third-party browser session, production build (no framework build configured), external embed playability, public deployment.

## Deployment and next action

- Deployment: not deployed; no verified URL.
- Required next step: provision a persistent Node host and durable database, or provide/configure Supabase and a hosting account; migrate persistence before deploying this app to a multi-instance/serverless platform. Then run the two-account checklist against the public URL.
- Git: no commit created; repository currently has no commits. The workspace exposes `.git` read-only, so `git commit` could not create its index lock.
