# Sync & Share — Project Work Log

This file records the work completed in this project during the current conversation, including the social listening work, debugging, API and synchronization audit, and room lifecycle update.

## Product and architecture

Sync & Share remains a small Node.js application with a native HTTP server, a hash-routed browser SPA, and JSON-file persistence. The server coordinates metadata and permissions. YouTube media is embedded and played in each user's browser; the server does not download, proxy, store, or rebroadcast audio.

- Server and API routes: `server.js`
- SPA routes, UI rendering, polling, player controls, and API calls: `public/app.js`
- Main styles: `public/style.css`, `public/refined.css`
- HTML shell: `public/index.html`
- Runtime data: `.data/database.json` (ignored by Git)

No framework, database, or application dependency was added.

## Work completed

### Account discovery, profiles, and social relationships

- Peoples loads accounts from persisted `db.users`, separately from the active listening sessions list. It renders accounts whether they are sharing or offline.
- Public account summaries use `safeUser`; passwords, password hashes, OAuth subject identifiers, and session cookies are not returned.
- Follow relationships use stable user IDs (`from` and `to`), are persisted, reject self-follow, and avoid duplicate relationships. Unfollowing also removes that person's Close Friends membership.
- Profiles display actual persisted account data, following lists, follow state, and only session details that the viewer may see.
- Close Friends are selected from accounts the host follows. The server validates this rule, rejects self/unknown/unfollowed accounts, and persists a deduplicated list.
- Peoples refreshes session visibility on a short polling interval and presents loading, error, retry, and empty states. Audience authorization is checked by the server for discovery and join operations.

### Your Corner and shared listening sessions

- Your Corner stores personal video, playback, position, title, and queue separately from the listener's current session.
- Sharing audiences are `everyone`, `followers`, `close-friends`, and `off`. Turning sharing off blocks discovery and new joins while an existing authorized listener can remain attached to the session.
- Shared session state stores host, video, playback state and position, update and heartbeat timestamps, audience, participants, and lifecycle status.
- A listener joins through a server-authorized operation, leaves any previous shared session, and gets a separate player view. Listener playback controls are not offered, and the server only permits the session host to write shared playback state.
- Session chat is participant-restricted. Host departure ends the session; existing listeners can continue local playback, while chat becomes read-only.
- Polling refreshes the shared session and participant/chat state. Synchronization is approximate and can be affected by YouTube buffering, network delay, browser throttling, ads, and autoplay restrictions.

### Host-approved song requests

- Listener song requests are stored in `sessionRequests`, separate from the host's playable queue.
- A listener must currently belong to the active session to submit a valid 11-character YouTube video ID. Repeated pending requests for the same video are deduplicated.
- Requesters can read their own request statuses. The host can view the session's requests and approve or reject them.
- Approval requires the authenticated session host, an active session, a pending request, and the matching session/request IDs. Queue insertion is deduplicated and repeated approval is idempotent. Rejection never enqueues the song.
- Pending requests cannot be approved after the session ends.

### Room lifecycle (latest change)

- Rooms now have a persisted `status`: `active` or `closed`. Existing JSON room records without this field are treated as active, preserving existing data.
- Hosts get a **Close room** control in the active room. Closing pauses playback and captures an estimated current position. The room, queue, members, and chat history remain stored.
- Closed rooms remain visible in the Rooms tab. Hosts can use **Start room** to reopen them; current members can open rooms they belong to. Private rooms are listed only to their existing members.
- Public and invitation-code joins are rejected while closed. Playback, queue add/remove, voting, and chat writes are also rejected until restart. Only the host can change room status.
- Restarting a room preserves its queue and resumes it in a paused state. A closed room's host membership is retained if the host leaves the closed view so the room can be reopened later.

### Multi-port synchronization fix

The reported ports 3001 and 3002 were separate Node processes from the same project directory, both using the default `.data` directory. Before the fix, each process loaded `database.json` once at startup and held a separate in-memory copy. The login cookie token was validated through a process-local `Map`. Thus, writes from the host process could reach disk but remain invisible to the listener process, and a login created on one process was invalid on the other. This was the root cause of “Unavailable” and failed joins in the two-port setup; the Everyone audience and client field names were consistent.

The native JSON persistence is now coordinated across processes that use the same `DATA_DIR`: each API request acquires an exclusive sidecar lock (`database.json.lock`), reloads current JSON state before routing, and releases the lock after completion. This serializes updates and prevents stale process snapshots from overwriting each other. Login session tokens are represented by SHA-256 hashes in the shared JSON state, allowing either process to validate a cookie without persisting the raw token. Logout removes the shared token record. Existing database files are normalized in place and remain compatible.

Both server processes must use the same `DATA_DIR`. Processes with different data directories still represent separate installations and cannot discover or join one another's sessions. You can keep using ports 3001 and 3002 when both processes run from this project with the default data directory.

### Local startup issue diagnosed during this chat

Port 3000 was held by PID 12098, the project's Node server, but it was in a stopped process state (`T`). It still held the listening socket while HTTP requests timed out. A normal `kill` remained pending while the process was stopped. Resuming it allowed termination to complete; Sync & Share then started successfully. This was a local process-state issue, not a Peoples API failure.

## Synchronization methods

There are no WebSockets in this project. Synchronization uses HTTP polling and the YouTube IFrame Player API.

| Flow | Mechanism | Where used |
| --- | --- | --- |
| Cross-process JSON state | Each `/api/*` request reloads the shared JSON file while holding an exclusive sidecar lock, then serializes any mutation. The login token hash is persisted in that same file so separate local server processes sharing `DATA_DIR` authenticate the same cookies. | `server.js`: `withFreshDb`, `acquireDbLock`, `normalizeDb`, auth session helpers |
| Standard room single-video state | Browser polls `GET /api/rooms/:id` about every 2 seconds. The host writes playback status/position through `POST /api/rooms/:id/play`; listeners receive server state and the player seeks/plays/pauses to correct drift. Playlist embeds render directly from YouTube and do not use these player correction callbacks. | `public/app.js`: `room`, `refreshRoom`, `syncPlayer`, `postPlayback`; `server.js`: room view/play routes |
| Personal playback | Your Corner controls the user's own YouTube player and writes personal playback through `POST /api/corner/play`. | `public/app.js`: `corner`, `startSocialPlayer`, `sendSocialState`; `server.js`: corner routes |
| Shared session state | The session page posts a heartbeat and receives the current session about every 2.5 seconds. Host player state changes are written through `POST /api/sessions/:id/play`. Listeners apply playback updates and periodically correct larger drift. | `public/app.js`: `socialSession`, `applySocialState`, `sendSocialState`; `server.js`: session heartbeat/play routes |
| Session participants and chat | Included session view data and refreshed with the shared-session polling; messages are stored per session. | `server.js`: `sessionView`, session message routes; `public/app.js`: session rendering/polling |
| Song request status | Polled alongside session updates. Pending requests remain separate until host approval. | `public/app.js`: `loadSessionRequests`; `server.js`: session request routes |
| Peoples availability | Account cards refresh about every 6 seconds so visible sharing status updates. | `public/app.js`: `peoples`; `server.js`: `/api/peoples` |
| Room lifecycle | Room status arrives in room and discovery responses. The room poll rebuilds the view when status changes, including host close and restart. | `public/app.js`: `discover`, `room`, `closedRoom`, `refreshRoom`; `server.js`: room status route |

The YouTube IFrame Player API controls a browser-embedded YouTube video. Each participant receives media directly from YouTube. No separate YouTube Music app is controlled. The room playlist path embeds YouTube’s playlist iframe directly; unlike single-video playback, that playlist iframe is not currently driven through the JavaScript player synchronization/correction callbacks.

## HTTP API inventory and usage

The frontend's `api()` helper in `public/app.js` sends same-origin JSON requests to `/api/*` with the signed-in session cookie. The server is implemented with Node's native HTTP server in `server.js`. Routes below are relative to `/api` unless shown otherwise.

### Authentication and profile

| Endpoint | Used for |
| --- | --- |
| `GET /health` | Lightweight server health check (`ok`). This route is outside `/api`. |
| `GET /auth/providers` | Tells the sign-in screen whether optional Google sign-in is configured. |
| `POST /auth/signup` | Creates a username/password account, stores a salted scrypt password hash, and sets the session cookie. |
| `POST /auth/login` | Verifies username/password and sets the session cookie. |
| `POST /auth/logout` | Clears the current in-memory login session and cookie. |
| `GET /me` | Loads the signed-in user's safe profile, following list, follower count, and own activity. |
| `PATCH /profile` | Updates the signed-in user's display name, bio, and profile visibility. |
| `GET /people` | Legacy account list used by the home page. Peoples itself uses `/peoples`. |
| `GET /people/:usernameOrId` | Loads a profile and its persisted following list, with activity filtered by session permissions. |
| `POST /people/:userId/follow` | Toggles follow/unfollow for the authenticated user; server resolves and validates target identity. |
| `GET /peoples` | Lists safe account summaries and only session activity visible to the current viewer. |
| `GET /close-friends` | Loads the signed-in user's followed accounts and Close Friends selection state. |
| `PUT /close-friends` | Replaces the signed-in user's Close Friends list after server-side validation against their following list. |

Optional Google OAuth, when configured, uses `/auth/google` and `/auth/google/callback`. Google OAuth is not required for password login or the listening features. The project does not use the YouTube Data API and needs no YouTube API key for known video IDs.

### Personal listening and shared sessions

| Endpoint | Used for |
| --- | --- |
| `GET /corner` | Loads the user's personal playback, queue, active host session, and Close Friends IDs. |
| `PUT /corner` | Loads/changes the personal current video and title. Valid video IDs are added to the personal queue if absent. |
| `POST /corner/queue` | Adds a valid YouTube video ID to the personal queue. |
| `POST /corner/next` | Advances personal playback to the next queued item and updates any active hosted session. |
| `POST /corner/play` | Writes the user's personal play/pause/position and propagates it to their active session when hosting. |
| `POST /share` | Starts or updates the current host session audience, including Off. |
| `POST /corner/end` | Ends the host session and turns off sharing. |
| `GET /sessions/:id` | Returns the session view only to the host or an authorized participant. |
| `POST /sessions/:id/join` | Authorizes audience and adds the listener, leaving their previous listener session first. |
| `POST /sessions/:id/leave` | Removes the current listener from the session and participant list. |
| `POST /sessions/:id/heartbeat` | Refreshes host last-seen playback or listener membership/last-seen data. |
| `POST /sessions/:id/play` | Writes shared playback state; server allows only the active host. |
| `GET /sessions/:id/messages` | Reads chat only for authorized session participants; ended sessions are read-only. |
| `POST /sessions/:id/messages` | Adds a text message only for authorized participants while the session is active. |
| `GET /sessions/:id/requests` | Host gets requests for their session; a listener gets only their own statuses. |
| `POST /sessions/:id/requests` | Submits a listener song request; it does not modify the active queue. |
| `POST /sessions/:id/requests/:requestId` | Host approves/rejects a request; approval adds its item to the host queue once. |

### Rooms

| Endpoint | Used for |
| --- | --- |
| `GET /rooms` | Lists public rooms and private rooms only for current members, with lifecycle status and host/member flags. Closed rooms remain listed. |
| `POST /rooms` | Creates a public/private room and assigns the creator host role. |
| `POST /rooms/join` | Joins a private room by invitation code; closed rooms reject joins. |
| `GET /rooms/:id` | Gets room, queue, member, and chat state for a current member. Closed rooms remain viewable by their members so the host can restart. |
| `POST /rooms/:id/status` | Host-only `active`/`closed` transition. Closing pauses playback and retains the room and queue. |
| `POST /rooms/:id/join` | Joins an active public room; closed rooms reject joins. |
| `POST /rooms/:id/leave` | Leaves a room. A closed room is retained rather than being deleted when its host leaves its closed view. |
| `POST /rooms/:id/queue` | Adds a valid YouTube video or playlist to an active room queue. |
| `POST /rooms/:id/play` | Host-only queue selection and playback status/position update. |
| `POST /rooms/:id/queue/:queueId/vote` | Adds, changes, or removes a member's vote on a queue item. |
| `DELETE /rooms/:id/queue/:queueId` | Host-only removal of a queue item. |
| `POST /rooms/:id/messages` | Adds a member chat message while the room is active. |

All room/session state changes use the local JSON persistence helper. Writes are serialized in-process and atomically replace the JSON file via a temporary file and rename.

## External APIs and credentials

- **YouTube IFrame Player API**: loaded by the browser from `https://www.youtube.com/iframe_api`; used for embedded playback controls and player state callbacks. No API key is needed for the current URL-pasting and known-video-ID workflow.
- **YouTube embeds**: use YouTube-hosted iframe URLs (including `youtube-nocookie.com` where used). Playback audio/video goes directly to each browser from YouTube.
- **YouTube Data API**: not used; the app accepts video/playlist URLs or IDs and does not perform YouTube search or metadata lookup.
- **Google OAuth**: optional existing sign-in integration only; it requires environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_URL`. Username/password authentication remains independent.
- No external credentials were added or required for room lifecycle or session coordination.

## Verification performed

- `npm run check` passed (`node --check server.js` and `node --check public/app.js`).
- `git diff --check` passed after implementation.
- An isolated two-account API lifecycle check passed: create room, add a queue item, play, host closes, playback pauses and queue remains, closed room remains listed, join while closed returns 409, non-host restart returns 403, closed-room queue mutation returns 409, host restarts, and listener joins successfully.
- Earlier checks in this conversation covered safe account listing, follow persistence, self-follow rejection, Close Friends access and revocation after unfollow, audience authorization, song request isolation, host-only approval, idempotent queue insertion, and rejection without enqueueing.
- Browser smoke checks earlier covered Peoples, follow state, profiles, Close Friends UI, and shared-session host controls.
- Two separate server processes on ports 3181 and 3182, using the same isolated temporary `DATA_DIR`, passed a two-account end-to-end API check: cross-process signup visibility, cross-port cookie authentication, Everyone session discovery, join, host playback updates reaching the listener heartbeat, and rejection of listener playback writes.
- Live YouTube media playback between two simultaneously open browser sessions has not been verified in this environment. YouTube embedding restrictions and browser autoplay permission remain external variables.

## Running and manual room test

Start the app with `npm run dev` (or `npm start`) and open `http://localhost:3000`. To reproduce a two-port setup, start each instance with a different `PORT` but the same `DATA_DIR`; for example, `DATA_DIR=.data PORT=3001 npm run dev` and `DATA_DIR=.data PORT=3002 npm run dev`. If port 3000 is already occupied, identify its owner before terminating it. A stopped Node process can retain its socket; inspect `ps -o pid,state,args -p <PID>`, and if it is in state `T`, resume it with `kill -CONT <PID>` before terminating it.

To verify room lifecycle with two accounts:

1. Sign in as the host and create a public room.
2. Add a YouTube link and start playback; join it from a second account.
3. As host, click **Close room**. Confirm playback pauses and the queue stays saved.
4. On the second account, confirm the room remains listed as closed and joining is unavailable. Direct `POST /api/rooms/:id/join` should return 409.
5. As host, open the room from Rooms and click **Start room**. Confirm the queue remains and playback is paused.
6. Confirm a listener can join after it is active and the host can resume playback.
