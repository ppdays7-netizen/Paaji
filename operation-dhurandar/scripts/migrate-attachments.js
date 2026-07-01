/**
 * scripts/migrate-attachments.js — add the `attachment` column to messages.
 * Safe to run on the live Neon database; uses IF NOT EXISTS.
 *
 *     node scripts/migrate-attachments.js
 */
require('dotenv').config();
const { pool, query } = require('../server/db');

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('\n[migrate-attachments] DATABASE_URL is not set. Put it in a .env file first.\n');
    process.exit(1);
  }
  try {
    console.log('[migrate-attachments] adding attachment column to messages…');
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment JSONB;`);
    console.log('[migrate-attachments] done ✓');
  } catch (err) {
    console.error('[migrate-attachments] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
