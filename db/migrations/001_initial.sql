CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_ms bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_ms);

CREATE TABLE IF NOT EXISTS follows (
  from_user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  to_user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  PRIMARY KEY (from_user_id, to_user_id),
  CHECK (from_user_id <> to_user_id)
);
CREATE INDEX IF NOT EXISTS follows_target_idx ON follows(to_user_id);

CREATE TABLE IF NOT EXISTS close_friends (
  host_id text NOT NULL,
  user_id text NOT NULL,
  PRIMARY KEY (host_id, user_id),
  CHECK (host_id <> user_id),
  FOREIGN KEY (host_id, user_id) REFERENCES follows(from_user_id, to_user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES app_users(id),
  invite_code text UNIQUE,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS rooms_status_idx ON rooms((data->>'status'));

CREATE TABLE IF NOT EXISTS room_members (
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS room_members_user_idx ON room_members(user_id);

CREATE TABLE IF NOT EXISTS room_queue (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS room_queue_room_idx ON room_queue(room_id);

CREATE TABLE IF NOT EXISTS room_votes (
  queue_id text NOT NULL REFERENCES room_queue(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (queue_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_messages (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_messages_room_created_idx ON room_messages(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_corners (
  user_id text PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS personal_queue (
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  id text NOT NULL,
  ordinal integer NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, ordinal)
);

CREATE TABLE IF NOT EXISTS listening_sessions (
  id text PRIMARY KEY,
  host_id text NOT NULL REFERENCES app_users(id),
  audience text NOT NULL CHECK (audience IN ('everyone', 'followers', 'close-friends', 'off')),
  status text NOT NULL CHECK (status IN ('active', 'ended')),
  data jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS listening_sessions_one_active_host_idx
  ON listening_sessions(host_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS listening_sessions_discovery_idx ON listening_sessions(status, audience);

CREATE TABLE IF NOT EXISTS session_participants (
  session_id text NOT NULL REFERENCES listening_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS session_participants_user_idx ON session_participants(user_id);

CREATE TABLE IF NOT EXISTS listener_sessions (
  user_id text PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES listening_sessions(id) ON DELETE CASCADE,
  joined_at_ms bigint NOT NULL,
  last_seen_at_ms bigint NOT NULL,
  UNIQUE (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS listener_sessions_session_idx ON listener_sessions(session_id);

CREATE TABLE IF NOT EXISTS session_messages (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES listening_sessions(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_messages_session_created_idx ON session_messages(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS session_requests (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES listening_sessions(id) ON DELETE CASCADE,
  host_id text NOT NULL REFERENCES app_users(id),
  requester_id text NOT NULL REFERENCES app_users(id),
  video_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_requests_host_status_idx ON session_requests(host_id, session_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS session_requests_no_duplicate_pending_idx
  ON session_requests(session_id, requester_id, video_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS legacy_import_runs (
  source text PRIMARY KEY,
  source_sha256 text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- The app accesses these tables only through its server-side database role.
-- Do not expose application records through Supabase's public Data API.
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE close_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_corners ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE listener_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_import_runs ENABLE ROW LEVEL SECURITY;
