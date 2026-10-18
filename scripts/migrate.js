const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { postgresConfig } = require("../postgres-config");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set before running migrations.");
  process.exit(1);
}

const pool = new Pool({
  ...postgresConfig(),
  max: 1,
  connectionTimeoutMillis: 8000,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const dir = path.join(__dirname, "..", "db", "migrations");
    const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const exists = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [file]);
      if (exists.rowCount) continue;
      await client.query("BEGIN");
      try {
        await client.query("SELECT pg_advisory_xact_lock(734821, 2)");
        const checkAgain = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [file]);
        if (!checkAgain.rowCount) {
          await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
          await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [file]);
          console.log(`Applied ${file}`);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
