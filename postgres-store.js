const COLLECTIONS = [
  { key: "users", table: "app_users", keys: ["id"] },
  { key: "authSessions", table: "auth_sessions", keys: ["tokenHash"] },
  { key: "follows", table: "follows", keys: ["from", "to"] },
  { key: "closeFriends", table: "close_friends", keys: ["hostId", "userId"] },
  { key: "rooms", table: "rooms", keys: ["id"] },
  { key: "members", table: "room_members", keys: ["roomId", "userId"] },
  { key: "queue", table: "room_queue", keys: ["id"] },
  { key: "votes", table: "room_votes", keys: ["queueId", "userId"] },
  { key: "messages", table: "room_messages", keys: ["id"] },
  { key: "sessions", table: "listening_sessions", keys: ["id"] },
  { key: "listenerSessions", table: "listener_sessions", keys: ["userId"] },
  { key: "sessionMessages", table: "session_messages", keys: ["id"] },
  { key: "sessionRequests", table: "session_requests", keys: ["id"] },
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const toMap = (rows, keys) =>
  new Map((rows || []).map((row) => [JSON.stringify(keys.map((k) => row[k])), row]));
const json = (value) => JSON.stringify(value ?? null);

function valuesFor(key, row) {
  switch (key) {
    case "users": {
      const { id, username, password, corner, ...data } = row;
      return [id, username, password || null, json(data)];
    }
    case "authSessions":
      return [row.tokenHash, row.userId, Number(row.expires)];
    case "follows":
      return [row.from, row.to];
    case "closeFriends":
      return [row.hostId, row.userId];
    case "rooms":
      return [row.id, row.ownerId, row.code || null, json(row)];
    case "members":
      return [row.roomId, row.userId, row.role || "member"];
    case "queue":
      return [row.id, row.roomId, json(row)];
    case "votes":
      return [row.queueId, row.userId, row.value];
    case "messages":
      return [row.id, row.roomId, json(row)];
    case "sessions": {
      const { participants, ...data } = row;
      return [row.id, row.hostId, row.audience, row.status, json(data)];
    }
    case "listenerSessions":
      return [row.userId, row.sessionId, Number(row.joinedAt) || 0, Number(row.lastSeenAt) || 0];
    case "sessionMessages":
      return [row.id, row.sessionId, json(row)];
    case "sessionRequests":
      return [row.id, row.sessionId, row.hostId, row.requesterId, row.videoId, row.status, json(row)];
    default:
      throw new Error(`Unknown database collection: ${key}`);
  }
}

const TABLES = {
  users: { columns: ["id", "username", "password_hash", "data"], conflict: ["id"] },
  authSessions: { columns: ["token_hash", "user_id", "expires_ms"], conflict: ["token_hash"] },
  follows: { columns: ["from_user_id", "to_user_id"], conflict: ["from_user_id", "to_user_id"] },
  closeFriends: { columns: ["host_id", "user_id"], conflict: ["host_id", "user_id"] },
  rooms: { columns: ["id", "owner_id", "invite_code", "data"], conflict: ["id"] },
  members: { columns: ["room_id", "user_id", "role"], conflict: ["room_id", "user_id"] },
  queue: { columns: ["id", "room_id", "data"], conflict: ["id"] },
  votes: { columns: ["queue_id", "user_id", "value"], conflict: ["queue_id", "user_id"] },
  messages: { columns: ["id", "room_id", "data"], conflict: ["id"] },
  sessions: { columns: ["id", "host_id", "audience", "status", "data"], conflict: ["id"] },
  listenerSessions: { columns: ["user_id", "session_id", "joined_at_ms", "last_seen_at_ms"], conflict: ["user_id"] },
  sessionMessages: { columns: ["id", "session_id", "data"], conflict: ["id"] },
  sessionRequests: { columns: ["id", "session_id", "host_id", "requester_id", "video_id", "status", "data"], conflict: ["id"] },
};

async function loadState(client, blank) {
  const state = blank();
  // A pg Client only runs one query at a time. Keep these sequential so the
  // transaction has deterministic ordering without pg's deprecated query queue.
  const users = await client.query("SELECT id, username, password_hash, data FROM app_users");
  const authSessions = await client.query("SELECT token_hash, user_id, expires_ms FROM auth_sessions WHERE expires_ms > $1", [Date.now()]);
  const follows = await client.query("SELECT from_user_id, to_user_id FROM follows");
  const closeFriends = await client.query("SELECT host_id, user_id FROM close_friends");
  const rooms = await client.query("SELECT id, data FROM rooms");
  const members = await client.query("SELECT room_id, user_id, role FROM room_members");
  const queue = await client.query("SELECT id, data FROM room_queue");
  const votes = await client.query("SELECT queue_id, user_id, value FROM room_votes");
  const messages = await client.query("SELECT data FROM room_messages ORDER BY created_at");
  const sessions = await client.query("SELECT id, data FROM listening_sessions");
  const participants = await client.query("SELECT session_id, user_id FROM session_participants");
  const listenerSessions = await client.query("SELECT user_id, session_id, joined_at_ms, last_seen_at_ms FROM listener_sessions");
  const sessionMessages = await client.query("SELECT data FROM session_messages ORDER BY created_at");
  const sessionRequests = await client.query("SELECT data FROM session_requests ORDER BY created_at");
  state.users = users.rows.map((r) => ({ ...r.data, id: r.id, username: r.username, password: r.password_hash }));
  state.authSessions = authSessions.rows.map((r) => ({ tokenHash: r.token_hash, userId: r.user_id, expires: Number(r.expires_ms) }));
  state.follows = follows.rows.map((r) => ({ from: r.from_user_id, to: r.to_user_id }));
  state.closeFriends = closeFriends.rows.map((r) => ({ hostId: r.host_id, userId: r.user_id }));
  state.rooms = rooms.rows.map((r) => r.data);
  state.members = members.rows.map((r) => ({ roomId: r.room_id, userId: r.user_id, role: r.role }));
  state.queue = queue.rows.map((r) => r.data);
  state.votes = votes.rows.map((r) => ({ queueId: r.queue_id, userId: r.user_id, value: r.value }));
  state.messages = messages.rows.map((r) => r.data);
  state.sessions = sessions.rows.map((r) => ({ ...r.data, id: r.id, participants: [] }));
  for (const link of participants.rows) {
    const s = state.sessions.find((x) => x.id === link.session_id);
    if (s) s.participants.push(link.user_id);
  }
  state.listenerSessions = listenerSessions.rows.map((r) => ({ userId: r.user_id, sessionId: r.session_id, joinedAt: Number(r.joined_at_ms), lastSeenAt: Number(r.last_seen_at_ms) }));
  state.sessionMessages = sessionMessages.rows.map((r) => r.data);
  state.sessionRequests = sessionRequests.rows.map((r) => r.data);
  for (const user of state.users) {
    const corner = await client.query("SELECT data FROM user_corners WHERE user_id = $1", [user.id]);
    if (corner.rowCount) {
      const items = await client.query("SELECT data FROM personal_queue WHERE user_id = $1 ORDER BY ordinal", [user.id]);
      user.corner = { ...corner.rows[0].data, queue: items.rows.map((r) => r.data) };
    }
  }
  return state;
}

async function persistDiff(client, key, before, after, phase) {
  const spec = COLLECTIONS.find((item) => item.key === key);
  const table = TABLES[key];
  const oldRows = toMap(before[key], spec.keys);
  const newRows = toMap(after[key], spec.keys);
  const keyColumns = table.conflict;
  const keyPositions = keyColumns.map((column) => table.columns.indexOf(column));

  if (phase === "delete") {
    for (const [encoded, row] of oldRows) {
      if (!newRows.has(encoded)) {
        const keyValues = keyPositions.map((i) => valuesFor(key, row)[i]);
        const where = keyColumns.map((column, i) => `${column} = $${i + 1}`).join(" AND ");
        await client.query(`DELETE FROM ${spec.table} WHERE ${where}`, keyValues);
      }
    }
    return;
  }

  for (const [encoded, row] of newRows) {
    const prior = oldRows.get(encoded);
    if (prior && JSON.stringify(prior) === JSON.stringify(row)) continue;
    const values = valuesFor(key, row);
    const names = table.columns.join(", ");
    const placeholders = table.columns.map((column, i) => `$${i + 1}${["data"].includes(column) ? "::jsonb" : ""}`).join(", ");
    const updates = table.columns.filter((column) => !keyColumns.includes(column)).map((column) => `${column} = EXCLUDED.${column}`);
    const conflict = keyColumns.join(", ");
    const suffix = updates.length ? `DO UPDATE SET ${updates.join(", ")}` : "DO NOTHING";
    await client.query(`INSERT INTO ${spec.table} (${names}) VALUES (${placeholders}) ON CONFLICT (${conflict}) ${suffix}`, values);
  }
}

async function persistStateDiff(client, before, after) {
  // Remove child records before parents; insert parent records before children.
  const order = ["users", "rooms", "sessions", "authSessions", "follows", "closeFriends", "members", "queue", "votes", "messages", "listenerSessions", "sessionMessages", "sessionRequests"];
  const remainingUserIds = new Set((after.users || []).map((u) => u.id));
  for (const user of before.users || []) {
    if (!remainingUserIds.has(user.id)) {
      await client.query("DELETE FROM personal_queue WHERE user_id = $1", [user.id]);
      await client.query("DELETE FROM user_corners WHERE user_id = $1", [user.id]);
    }
  }
  for (const key of [...order].reverse()) await persistDiff(client, key, before, after, "delete");
  for (const key of order) await persistDiff(client, key, before, after, "upsert");

  const participantRows = (state) => (state.sessions || []).flatMap((session) =>
    [...new Set(session.participants || [])].map((userId) => ({ sessionId: session.id, userId })),
  );
  const oldParticipants = toMap(participantRows(before), ["sessionId", "userId"]);
  const newParticipants = toMap(participantRows(after), ["sessionId", "userId"]);
  for (const [encoded, row] of oldParticipants) {
    if (!newParticipants.has(encoded))
      await client.query("DELETE FROM session_participants WHERE session_id = $1 AND user_id = $2", [row.sessionId, row.userId]);
  }
  for (const [encoded, row] of newParticipants) {
    if (!oldParticipants.has(encoded))
      await client.query("INSERT INTO session_participants (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [row.sessionId, row.userId]);
  }

  const oldCorners = new Map((before.users || []).map((u) => [u.id, u.corner || null]));
  for (const user of after.users || []) {
    const oldCorner = oldCorners.get(user.id);
    const corner = user.corner || null;
    if (JSON.stringify(oldCorner) === JSON.stringify(corner)) continue;
    if (!corner) {
      await client.query("DELETE FROM user_corners WHERE user_id = $1", [user.id]);
      await client.query("DELETE FROM personal_queue WHERE user_id = $1", [user.id]);
      continue;
    }
    const { queue = [], ...data } = corner;
    await client.query("INSERT INTO user_corners (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data", [user.id, json(data)]);
    const ids = queue.map((item) => item.id);
    if (ids.length) await client.query("DELETE FROM personal_queue WHERE user_id = $1 AND NOT (id = ANY($2::text[]))", [user.id, ids]);
    else await client.query("DELETE FROM personal_queue WHERE user_id = $1", [user.id]);
    for (let ordinal = 0; ordinal < queue.length; ordinal++) {
      const item = queue[ordinal];
      await client.query("INSERT INTO personal_queue (id, user_id, ordinal, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (user_id, id) DO UPDATE SET ordinal = EXCLUDED.ordinal, data = EXCLUDED.data", [item.id, user.id, ordinal, json(item)]);
    }
  }
}

module.exports = { clone, loadState, persistStateDiff };
