/**
 * server/db.js — Neon (Postgres) connection layer.
 * --------------------------------------------------------------
 * A single shared pg Pool, created from the DATABASE_URL that Neon gives you.
 * Works the same locally and on Vercel (serverless). SSL is required by Neon.
 *
 * Set DATABASE_URL in a local .env file (see .env.example) and in the Vercel
 * project's Environment Variables. Nothing else in the app reads the DB
 * directly — everything goes through server/store.js.
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Fail loud and early — every feature now depends on the database.
  console.error(
    '\n[db] FATAL: DATABASE_URL is not set.\n' +
      '      Create a free Neon database and put its connection string in\n' +
      '      a .env file (locally) and in Vercel → Settings → Environment Variables.\n'
  );
}

// Neon requires TLS; a plain local Postgres does not. Disable SSL only for
// obvious localhost / sslmode=disable strings so testing works out of the box.
const isLocal =
  /localhost|127\.0\.0\.1/.test(connectionString || '') ||
  /sslmode=disable/.test(connectionString || '');

// One pool per process. On serverless the module is cached between warm
// invocations, so the pool is reused instead of re-created each request.
const pool = new Pool({
  connectionString,
  // rejectUnauthorized:false keeps it simple across local + Vercel without
  // bundling Neon's CA certs.
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[db] unexpected idle client error:', err.message);
});

/** Thin query helper: query(text, params) -> result. */
function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
