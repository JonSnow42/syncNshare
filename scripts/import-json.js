const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Pool } = require("pg");
const { postgresConfig } = require("../postgres-config");
const { persistStateDiff } = require("../postgres-store");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set before importing local data.");
  process.exit(1);
}

const keys = [
  "users", "authSessions", "follows", "closeFriends", "rooms", "members",
  "queue", "votes", "messages", "sessions", "listenerSessions",
  "sessionMessages", "sessionRequests",
];
const pool = new Pool({
  ...postgresConfig(),
  max: 1,
  connectionTimeoutMillis: 8000,
});

async function main() {
  const defaultSource = path.resolve(
    process.env.DATA_DIR || ".data",
    "database.json",
  );
  const sourceFile = path.resolve(process.env.LEGACY_DATA_FILE || defaultSource);
  let lockHandle = null;
  let lockNonce = null;
  try {
    if (sourceFile === defaultSource) {
      lockNonce = crypto.randomBytes(12).toString("hex");
      try {
        lockHandle = await fs.promises.open(sourceFile + ".lock", "wx", 0o600);
      } catch (error) {
        if (error.code === "EEXIST")
          throw new Error("The local database is currently in use. Stop the app and retry the import.");
        throw error;
      }
      await lockHandle.writeFile(JSON.stringify({ pid: process.pid, nonce: lockNonce, createdAt: Date.now() }));
    }

    const source = await fs.promises.readFile(sourceFile);
    const digest = crypto.createHash("sha256").update(source).digest("hex");
    const state = JSON.parse(source.toString("utf8"));
    for (const key of keys) if (!Array.isArray(state[key])) state[key] = [];
    state.authSessions = state.authSessions.filter((session) => Number(session.expires) > Date.now());
    if (!state.users.length)
      throw new Error("The source JSON contains no user accounts; refusing to import it.");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(734821, 3)");
      const prior = await client.query("SELECT source_sha256 FROM legacy_import_runs WHERE source = $1", ["database.json"]);
      if (prior.rowCount) {
        await client.query("COMMIT");
        if (prior.rows[0].source_sha256 === digest) {
          console.log("This exact database.json was already imported; no changes made.");
          return;
        }
        throw new Error("A different database.json was already imported. Refusing to overwrite cloud data.");
      }

    const blank = Object.fromEntries(keys.map((key) => [key, []]));
    await persistStateDiff(client, blank, state);
    await client.query("INSERT INTO legacy_import_runs(source, source_sha256) VALUES ($1, $2)", ["database.json", digest]);
    await client.query("COMMIT");
    console.log(`Imported ${state.users.length} accounts, ${state.rooms.length} rooms, ${state.sessions.length} shared sessions, and related records.`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (lockHandle) {
      await lockHandle.close().catch(() => {});
      try {
        const held = JSON.parse(await fs.promises.readFile(sourceFile + ".lock", "utf8"));
        if (held.nonce === lockNonce) await fs.promises.unlink(sourceFile + ".lock");
      } catch {}
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Import failed: ${error.message}`);
  process.exitCode = 1;
});
