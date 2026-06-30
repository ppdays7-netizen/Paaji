/**
 * scripts/migrate-chat.js — add the chat `messages` table without touching
 * existing officers/missions data. Safe to run on the live Neon database.
 *
 *     node scripts/migrate-chat.js
 */
require('dotenv').config();
const { pool, query } = require('../server/db');

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('\n[migrate-chat] DATABASE_URL is not set. Put it in a .env file first.\n');
    process.exit(1);
  }
  try {
    console.log('[migrate-chat] creating messages table…');
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id         BIGSERIAL PRIMARY KEY,
        sender     TEXT NOT NULL,
        recipient  TEXT,
        channel    TEXT NOT NULL DEFAULT 'group',
        convo      TEXT NOT NULL DEFAULT 'group',
        body       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await query(`CREATE INDEX IF NOT EXISTS "IDX_messages_group" ON messages (channel, id);`);
    await query(`CREATE INDEX IF NOT EXISTS "IDX_messages_convo" ON messages (convo, id);`);
    console.log('[migrate-chat] done. Comms channel online.');
  } catch (err) {
    console.error('[migrate-chat] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
