/**
 * scripts/init-db.js — one-time database setup + seed for Operation DHURANDAR.
 * ---------------------------------------------------------------------------
 * Run this ONCE after creating your Neon database and setting DATABASE_URL:
 *
 *     node scripts/init-db.js
 *
 * It will:
 *   1. Create the officers / missions / completions / session tables.
 *   2. Seed officers from data/auth.txt + data/members.json + data/points.json.
 *   3. Seed missions + completions from data/tasks.json.
 *
 * It is SAFE to re-run: it uses CREATE TABLE IF NOT EXISTS and ON CONFLICT
 * upserts, so existing rows are updated rather than duplicated.
 *
 * Pass --fresh to DROP and recreate everything from the seed files:
 *     node scripts/init-db.js --fresh
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, query } = require('../server/db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FRESH = process.argv.includes('--fresh');
const HASH_PASSWORDS = String(process.env.HASH_PASSWORDS).toLowerCase() === 'true';

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.warn('[init] could not read ' + path.basename(file) + ': ' + e.message);
    return fallback;
  }
}

function loadAuthUsers() {
  let raw = '';
  try {
    raw = fs.readFileSync(path.join(DATA_DIR, 'auth.txt'), 'utf8');
  } catch (e) {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const parts = l.split(',');
      return {
        username: (parts[0] || '').trim(),
        password: (parts[1] || '').trim(),
        rank: (parts.slice(2).join(',') || 'Recruit').trim(),
      };
    })
    .filter((u) => u.username && u.password);
}

async function createTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS officers (
      username        TEXT PRIMARY KEY,
      password        TEXT NOT NULL,
      rank            TEXT NOT NULL DEFAULT 'Recruit',
      points          INTEGER NOT NULL DEFAULT 0,
      callsign        TEXT,
      posting         TEXT DEFAULT 'Awaiting Assignment',
      years           INTEGER DEFAULT 1,
      clearance       TEXT DEFAULT 'CHARLIE — CONFIDENTIAL',
      status          TEXT DEFAULT 'ACTIVE — RESERVE',
      achievements    JSONB NOT NULL DEFAULT '[]'::jsonb,
      contribution    JSONB NOT NULL DEFAULT '[]'::jsonb,
      current_mission TEXT,
      sector          JSONB,
      geo             JSONB,
      badge           TEXT DEFAULT '★',
      accent          TEXT DEFAULT '#3fff9f',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS missions (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      xp         INTEGER NOT NULL DEFAULT 0,
      category   TEXT DEFAULT 'General',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS completions (
      username     TEXT NOT NULL,
      task_id      TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (username, task_id)
    );
  `);

  // Chat: one table for both the group "war room" and private DMs.
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         BIGSERIAL PRIMARY KEY,
      sender     TEXT NOT NULL,
      recipient  TEXT,
      channel    TEXT NOT NULL DEFAULT 'group',
      convo      TEXT NOT NULL DEFAULT 'group',
      body       TEXT NOT NULL DEFAULT '',
      attachment JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migration safety: add attachment column to any existing messages table.
  await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment JSONB;`);
  await query(`CREATE INDEX IF NOT EXISTS "IDX_messages_group" ON messages (channel, id);`);
  await query(`CREATE INDEX IF NOT EXISTS "IDX_messages_convo" ON messages (convo, id);`);

  // Session store table used by connect-pg-simple (keeps logins alive on Vercel).
  await query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    varchar NOT NULL COLLATE "default",
      "sess"   json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);
}

async function dropTables() {
  await query('DROP TABLE IF EXISTS completions;');
  await query('DROP TABLE IF EXISTS missions;');
  await query('DROP TABLE IF EXISTS officers;');
  // Leave the session table alone so active logins survive a --fresh reseed.
}

async function seed() {
  const authUsers = loadAuthUsers();
  const members = readJSON(path.join(DATA_DIR, 'members.json'), {});
  const points = readJSON(path.join(DATA_DIR, 'points.json'), {});
  const tasks = readJSON(path.join(DATA_DIR, 'tasks.json'), { missions: [], completions: {} });

  // ---- officers ----
  for (const u of authUsers) {
    const m = members[u.username] || {};
    const pwd = HASH_PASSWORDS && !u.password.startsWith('$2') ? await bcrypt.hash(u.password, 10) : u.password;
    await query(
      `INSERT INTO officers
         (username, password, rank, points, callsign, posting, years, clearance, status,
          achievements, contribution, current_mission, sector, geo, badge, accent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (username) DO UPDATE SET
         password = EXCLUDED.password,
         rank = EXCLUDED.rank,
         points = EXCLUDED.points,
         callsign = EXCLUDED.callsign,
         posting = EXCLUDED.posting,
         years = EXCLUDED.years,
         clearance = EXCLUDED.clearance,
         status = EXCLUDED.status,
         achievements = EXCLUDED.achievements,
         contribution = EXCLUDED.contribution,
         current_mission = EXCLUDED.current_mission,
         sector = EXCLUDED.sector,
         geo = EXCLUDED.geo,
         badge = EXCLUDED.badge,
         accent = EXCLUDED.accent`,
      [
        u.username,
        pwd,
        m.rank || u.rank || 'Recruit',
        Number(points[u.username]) || 0,
        m.callsign || u.username.toUpperCase(),
        m.posting || 'Awaiting Assignment',
        m.years == null ? 1 : Number(m.years),
        m.clearance || 'CHARLIE — CONFIDENTIAL',
        m.status || 'ACTIVE — RESERVE',
        JSON.stringify(Array.isArray(m.achievements) ? m.achievements : []),
        JSON.stringify(Array.isArray(m.contribution) ? m.contribution : []),
        m.currentMission || 'Operation DHURANDAR — Orientation',
        m.sector ? JSON.stringify(m.sector) : JSON.stringify({ x: 50, y: 50 }),
        m.geo ? JSON.stringify(m.geo) : null,
        m.badge || '★',
        m.accent || '#3fff9f',
      ]
    );
  }

  // ---- missions ----
  for (const mission of tasks.missions || []) {
    await query(
      `INSERT INTO missions (id, title, xp, category)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, xp = EXCLUDED.xp, category = EXCLUDED.category`,
      [mission.id, mission.title, Number(mission.xp) || 0, mission.category || 'General']
    );
  }

  // ---- completions ----
  const completions = tasks.completions || {};
  for (const username of Object.keys(completions)) {
    for (const taskId of completions[username] || []) {
      await query(
        `INSERT INTO completions (username, task_id) VALUES ($1,$2)
         ON CONFLICT (username, task_id) DO NOTHING`,
        [username, taskId]
      );
    }
  }

  return { officers: authUsers.length, missions: (tasks.missions || []).length };
}

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('\n[init] DATABASE_URL is not set. Put it in a .env file first.\n');
    process.exit(1);
  }
  try {
    if (FRESH) {
      console.log('[init] --fresh: dropping officers/missions/completions…');
      await dropTables();
    }
    console.log('[init] creating tables…');
    await createTables();
    console.log('[init] seeding from data/ files…');
    const counts = await seed();
    console.log(`[init] done ✓  seeded ${counts.officers} officers, ${counts.missions} missions.`);
  } catch (err) {
    console.error('[init] FAILED:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
