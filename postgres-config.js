const fs = require("node:fs");
const path = require("node:path");

function postgresConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be configured.");

  if (process.env.DATABASE_SSL === "disable") {
    return { connectionString, ssl: false };
  }

  const caSetting = String(process.env.DATABASE_SSL_CA || "").trim();
  if (!caSetting) return { connectionString, ssl: true };

  const ca = caSetting.includes("-----BEGIN CERTIFICATE-----")
    ? caSetting
    : fs.readFileSync(path.resolve(process.cwd(), caSetting), "utf8");

  // node-postgres lets sslmode in the URL override the explicit SSL object.
  // Remove SSL query options so the supplied CA is used for verification.
  const url = new URL(connectionString);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"])
    url.searchParams.delete(key);

  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true },
  };
}

module.exports = { postgresConfig };
