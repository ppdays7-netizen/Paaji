/**
 * store.js — central data-access layer for Operation DHURANDAR.
 * --------------------------------------------------------------
 * Persistence now lives in a Neon (Postgres) database instead of flat files,
 * so every write survives — including on Vercel's read-only filesystem, which
 * is why "Add Officer", "Create Mission" and the Command Centre used to fail.
 *
 * Tables (created by scripts/init-db.js):
 *   officers     -> credentials + full profile + points (one row per officer)
 *   missions     -> the mission board
 *   completions  -> which officer completed which mission (for XP de-dup)
 *
 * Every public function is async and returns the SAME shapes the EJS views
 * already expect, so the templates did not need to change.
 */

const bcrypt = require('bcryptjs');
const { query } = require('./db');

const HASH_PASSWORDS = String(process.env.HASH_PASSWORDS).toLowerCase() === 'true';

/* --------------------------- row -> view shapes ------------------------- */

function rowToProfile(row) {
  return {
    callsign: row.callsign || (row.username || '').toUpperCase(),
    rank: row.rank || 'Recruit',
    posting: row.posting || 'Awaiting Assignment',
    years: row.years == null ? 1 : Number(row.years),
    clearance: row.clearance || 'CHARLIE — CONFIDENTIAL',
    status: row.status || 'ACTIVE — RESERVE',
    achievements: Array.isArray(row.achievements) ? row.achievements : [],
    contribution: Array.isArray(row.contribution) ? row.contribution : [],
    currentMission: row.current_mission || 'Operation DHURANDAR — Orientation',
    sector: row.sector || { x: 50, y: 50 },
    geo: row.geo || null,
    badge: row.badge || '★',
    accent: row.accent || '#3fff9f',
  };
}

function defaultProfile(username, rank) {
  const accents = ['#ffd23f', '#3fb950', '#58a6ff', '#ff7b54', '#bc8cff', '#ff6b6b'];
  const badgeByRank = { Brigadier: '★★★', Colonel: '★★★', Major: '★★', Captain: '★★', Lieutenant: '★' };
  return {
    callsign: username.toUpperCase(),
    rank: rank || 'Recruit',
    posting: 'Awaiting Assignment',
    years: 1,
    clearance: 'CHARLIE — CONFIDENTIAL',
    status: 'ACTIVE — RESERVE',
    achievements: ['Newly Commissioned Officer'],
    contribution: ['Pending First Assignment'],
    currentMission: 'Operation DHURANDAR — Orientation',
    sector: { x: 40 + Math.round(Math.random() * 20), y: 40 + Math.round(Math.random() * 20) },
    geo: null,
    badge: badgeByRank[rank] || '★',
    accent: accents[Math.floor(Math.random() * accents.length)],
  };
}

/* ------------------------------- users ---------------------------------- */

async function loadUsers() {
  const { rows } = await query(
    'SELECT username, password, rank FROM officers ORDER BY created_at ASC, username ASC'
  );
  return rows.map((r) => ({ username: r.username, password: r.password, rank: r.rank || 'Recruit' }));
}

async function verifyUser(username, password) {
  const { rows } = await query(
    'SELECT username, password, rank FROM officers WHERE LOWER(username) = LOWER($1) LIMIT 1',
    [String(username || '')]
  );
  const user = rows[0];
  if (!user) return null;
  let ok;
  if (HASH_PASSWORDS && user.password.startsWith('$2')) {
    ok = await bcrypt.compare(password, user.password);
  } else {
    ok = user.password === password;
  }
  return ok ? { username: user.username, rank: user.rank } : null;
}

async function addUser(opts) {
  const username = String((opts && opts.username) || '').trim();
  const password = opts && opts.password;
  const rank = String((opts && opts.rank) || 'Recruit').trim();
  if (!username || !password) return { ok: false, error: 'Name and password are required.' };

  const exists = await query('SELECT 1 FROM officers WHERE LOWER(username) = LOWER($1) LIMIT 1', [username]);
  if (exists.rowCount > 0) return { ok: false, error: 'An officer with that name already exists.' };

  const stored = HASH_PASSWORDS ? await bcrypt.hash(password, 10) : password;
  const p = defaultProfile(username, rank);
  try {
    await query(
      'INSERT INTO officers (username, password, rank, points, callsign, posting, years, clearance, status, achievements, contribution, current_mission, sector, geo, badge, accent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
      [username, stored, rank, 0, p.callsign, p.posting, p.years, p.clearance, p.status,
        JSON.stringify(p.achievements), JSON.stringify(p.contribution), p.currentMission,
        JSON.stringify(p.sector), p.geo ? JSON.stringify(p.geo) : null, p.badge, p.accent]
    );
  } catch (err) {
    console.error('[store] addUser failed:', err.message);
    return { ok: false, error: 'Database error while commissioning officer.' };
  }
  return { ok: true };
}

async function deleteUser(username) {
  try {
    await query('DELETE FROM completions WHERE LOWER(username) = LOWER($1)', [username]);
    const res = await query('DELETE FROM officers WHERE LOWER(username) = LOWER($1)', [username]);
    return { ok: res.rowCount > 0, error: res.rowCount > 0 ? undefined : 'Officer not found.' };
  } catch (err) {
    console.error('[store] deleteUser failed:', err.message);
    return { ok: false, error: 'Database error while decommissioning officer.' };
  }
}

async function editUser(username, updates) {
  updates = updates || {};
  const sets = [];
  const vals = [];
  let i = 1;
  if (updates.password) { sets.push('password = $' + i++); vals.push(HASH_PASSWORDS ? await bcrypt.hash(updates.password, 10) : updates.password); }
  if (updates.rank) { sets.push('rank = $' + i++); vals.push(String(updates.rank).trim()); }
  if (updates.posting !== undefined && updates.posting !== '') { sets.push('posting = $' + i++); vals.push(String(updates.posting).trim()); }
  if (updates.years !== undefined && updates.years !== '') { sets.push('years = $' + i++); vals.push(Number(updates.years)); }
  if (sets.length === 0) return { ok: true };
  vals.push(username);
  try {
    const res = await query('UPDATE officers SET ' + sets.join(', ') + ' WHERE LOWER(username) = LOWER($' + i + ')', vals);
    return { ok: res.rowCount > 0, error: res.rowCount > 0 ? undefined : 'Officer not found.' };
  } catch (err) {
    console.error('[store] editUser failed:', err.message);
    return { ok: false, error: 'Database error while updating record.' };
  }
}

async function updateProfile(username, fields) {
  fields = fields || {};
  const map = { posting: 'posting', callsign: 'callsign', status: 'status', clearance: 'clearance', currentMission: 'current_mission', badge: 'badge', accent: 'accent' };
  const sets = [];
  const vals = [];
  let i = 1;
  Object.keys(map).forEach((key) => {
    if (fields[key] !== undefined && fields[key] !== '') { sets.push(map[key] + ' = $' + i++); vals.push(String(fields[key]).trim()); }
  });
  if (fields.years !== undefined && fields.years !== '') { sets.push('years = $' + i++); vals.push(Number(fields.years)); }
  if (fields.rank) { sets.push('rank = $' + i++); vals.push(String(fields.rank).trim()); }
  if (sets.length === 0) return { ok: false, error: 'Nothing to update.' };
  vals.push(username);
  try {
    const res = await query('UPDATE officers SET ' + sets.join(', ') + ' WHERE LOWER(username) = LOWER($' + i + ')', vals);
    return { ok: res.rowCount > 0, error: res.rowCount > 0 ? undefined : 'Officer not found.' };
  } catch (err) {
    console.error('[store] updateProfile failed:', err.message);
    return { ok: false, error: 'Database error while updating profile.' };
  }
}

async function updatePosting(username, posting) {
  if (!posting || !String(posting).trim()) return { ok: false, error: 'Posting cannot be empty.' };
  return updateProfile(username, { posting });
}

/* --------------------------- achievements ------------------------------- */

async function getAchievements(username) {
  const { rows } = await query('SELECT achievements FROM officers WHERE LOWER(username) = LOWER($1) LIMIT 1', [username]);
  if (!rows[0]) return null;
  return Array.isArray(rows[0].achievements) ? rows[0].achievements : [];
}

async function addAchievement(username, text) {
  const value = String(text || '').trim();
  if (!value) return { ok: false, error: 'Achievement text is required.' };
  const current = await getAchievements(username);
  if (current === null) return { ok: false, error: 'Officer not found.' };
  const next = current.concat([value]);
  try {
    await query('UPDATE officers SET achievements = $1 WHERE LOWER(username) = LOWER($2)', [JSON.stringify(next), username]);
    return { ok: true };
  } catch (err) {
    console.error('[store] addAchievement failed:', err.message);
    return { ok: false, error: 'Database error while adding achievement.' };
  }
}

async function removeAchievement(username, index) {
  const current = await getAchievements(username);
  if (current === null) return { ok: false, error: 'Officer not found.' };
  const idx = Number(index);
  if (Number.isNaN(idx) || idx < 0 || idx >= current.length) return { ok: false, error: 'Invalid achievement index.' };
  const next = current.slice(0, idx).concat(current.slice(idx + 1));
  try {
    await query('UPDATE officers SET achievements = $1 WHERE LOWER(username) = LOWER($2)', [JSON.stringify(next), username]);
    return { ok: true };
  } catch (err) {
    console.error('[store] removeAchievement failed:', err.message);
    return { ok: false, error: 'Database error while removing achievement.' };
  }
}

/* ------------------------------- points --------------------------------- */

async function getPoints() {
  const { rows } = await query('SELECT username, points FROM officers');
  const out = {};
  rows.forEach((r) => { out[r.username] = Number(r.points) || 0; });
  return out;
}

async function adjustPoints(username, delta) {
  const { rows } = await query(
    'UPDATE officers SET points = GREATEST(0, points + $1) WHERE LOWER(username) = LOWER($2) RETURNING points',
    [Number(delta || 0), username]
  );
  return rows[0] ? Number(rows[0].points) : 0;
}

async function resetPoints(username) {
  if (username) {
    await query('UPDATE officers SET points = 0 WHERE LOWER(username) = LOWER($1)', [username]);
  } else {
    await query('UPDATE officers SET points = 0');
    await query('DELETE FROM completions');
  }
  return getPoints();
}

/* ------------------------------- missions ------------------------------- */

async function getTasks() {
  const missionsRes = await query('SELECT id, title, xp, category FROM missions ORDER BY created_at ASC, id ASC');
  const compRes = await query('SELECT username, task_id FROM completions');
  const completions = {};
  const officers = await query('SELECT username FROM officers');
  officers.rows.forEach((o) => { completions[o.username] = []; });
  compRes.rows.forEach((c) => {
    if (!completions[c.username]) completions[c.username] = [];
    completions[c.username].push(c.task_id);
  });
  return {
    missions: missionsRes.rows.map((m) => ({ id: m.id, title: m.title, xp: Number(m.xp), category: m.category })),
    completions,
  };
}

async function completeMission(username, taskId) {
  const mres = await query('SELECT id, xp FROM missions WHERE id = $1 LIMIT 1', [taskId]);
  const mission = mres.rows[0];
  if (!mission) return { ok: false, error: 'Mission not found.' };
  const dup = await query('SELECT 1 FROM completions WHERE LOWER(username) = LOWER($1) AND task_id = $2 LIMIT 1', [username, taskId]);
  if (dup.rowCount > 0) return { ok: false, error: 'Mission already completed -- no duplicate XP.' };
  await query('INSERT INTO completions (username, task_id) VALUES ($1, $2)', [username, taskId]);
  await adjustPoints(username, Number(mission.xp));
  return { ok: true, xp: Number(mission.xp) };
}

async function addMission(opts) {
  const title = opts && opts.title;
  const xp = opts && opts.xp;
  const category = opts && opts.category;
  if (!title || xp === undefined) return { ok: false, error: 'Title and XP are required.' };
  const id = 'm' + Date.now().toString(36);
  try {
    await query('INSERT INTO missions (id, title, xp, category) VALUES ($1,$2,$3,$4)', [id, String(title).trim(), Math.max(0, Number(xp) || 0), (category || 'General').trim()]);
    return { ok: true, id };
  } catch (err) {
    console.error('[store] addMission failed:', err.message);
    return { ok: false, error: 'Database error while creating mission.' };
  }
}

async function deleteMission(taskId) {
  await query('DELETE FROM completions WHERE task_id = $1', [taskId]);
  const res = await query('DELETE FROM missions WHERE id = $1', [taskId]);
  return { ok: res.rowCount > 0 };
}

async function editMission(taskId, updates) {
  updates = updates || {};
  const sets = [];
  const vals = [];
  let i = 1;
  if (updates.title) { sets.push('title = $' + i++); vals.push(String(updates.title).trim()); }
  if (updates.xp !== undefined && updates.xp !== '') { sets.push('xp = $' + i++); vals.push(Math.max(0, Number(updates.xp))); }
  if (updates.category) { sets.push('category = $' + i++); vals.push(String(updates.category).trim()); }
  if (sets.length === 0) return { ok: true };
  vals.push(taskId);
  const res = await query('UPDATE missions SET ' + sets.join(', ') + ' WHERE id = $' + i, vals);
  return { ok: res.rowCount > 0, error: res.rowCount > 0 ? undefined : 'Mission not found.' };
}

/* ------------------------------- members -------------------------------- */

async function getMembers() {
  const { rows } = await query('SELECT * FROM officers ORDER BY created_at ASC, username ASC');
  const out = {};
  rows.forEach((r) => { out[r.username] = rowToProfile(r); });
  return out;
}

async function getMember(username) {
  const { rows } = await query('SELECT * FROM officers WHERE LOWER(username) = LOWER($1) LIMIT 1', [String(username)]);
  if (!rows[0]) return null;
  return Object.assign({ username: rows[0].username }, rowToProfile(rows[0]));
}

/* -------------------------- composite views ----------------------------- */

function levelFromXP(xp) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

async function getLeaderboard() {
  const { rows } = await query('SELECT username, rank, points, accent FROM officers');
  const out = rows.map((r) => {
    const xp = Number(r.points) || 0;
    return { username: r.username, militaryRank: r.rank || 'Recruit', points: xp, level: levelFromXP(xp), accent: r.accent || '#3fff9f' };
  });
  out.sort((a, b) => b.points - a.points);
  out.forEach((r, idx) => { r.position = idx + 1; });
  return out;
}

/* ------------------------------- chat ----------------------------------- */
// Messages are stored in one table. A GROUP (war-room) message has
// channel='group' and recipient=NULL. A DIRECT message has channel='dm' and
// recipient set to the other officer's username. Conversations between two
// officers are keyed by a stable, order-independent pair id (lower|higher).

/** Stable conversation key for a DM between two usernames. */
function dmKey(a, b) {
  const x = String(a || '').toLowerCase();
  const y = String(b || '').toLowerCase();
  return x < y ? x + '|' + y : y + '|' + x;
}

// Max attachment size: 5 MB (measured against the base64 string length ≈ 6.7 MB stored).
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Persist a message. opts: { recipient?, attachment?: { name, type, data } } */
async function sendMessage(sender, body, opts) {
  const text = String(body || '').trim();
  const attachment = (opts && opts.attachment) || null;

  // Must have text OR attachment.
  if (!text && !attachment) return { ok: false, error: 'Message cannot be empty.' };
  if (text.length > 2000) return { ok: false, error: 'Message too long (2000 char max).' };

  // Validate attachment.
  if (attachment) {
    if (!attachment.name || !attachment.type || !attachment.data) {
      return { ok: false, error: 'Malformed attachment.' };
    }
    const byteLen = Math.round((attachment.data.length * 3) / 4);
    if (byteLen > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: 'Attachment too large (5 MB max).' };
    }
  }

  const channel = opts && opts.recipient ? 'dm' : 'group';
  const recipient = channel === 'dm' ? String(opts.recipient).trim() : null;
  const convo = channel === 'dm' ? dmKey(sender, recipient) : 'group';

  if (channel === 'dm') {
    const exists = await query('SELECT 1 FROM officers WHERE LOWER(username)=LOWER($1) LIMIT 1', [recipient]);
    if (exists.rowCount === 0) return { ok: false, error: 'Recipient not found.' };
  }

  // Build attachment JSONB: store name/type/size as metadata + data separately inside same object.
  const attachJson = attachment
    ? JSON.stringify({ name: attachment.name, type: attachment.type, size: attachment.size || 0, data: attachment.data })
    : null;

  try {
    const { rows } = await query(
      `INSERT INTO messages (sender, recipient, channel, convo, body, attachment)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, sender, recipient, channel, convo, body,
                 attachment - 'data' AS attachment_meta,
                 created_at`,
      [sender, recipient, channel, convo, text, attachJson]
    );
    return { ok: true, message: rowToMessage(rows[0]) };
  } catch (err) {
    console.error('[store] sendMessage failed:', err.message);
    return { ok: false, error: 'Database error while sending message.' };
  }
}

function rowToMessage(r) {
  return {
    id: Number(r.id),
    sender: r.sender,
    recipient: r.recipient,
    channel: r.channel,
    body: r.body,
    // attachment_meta contains name/type/size but NOT data (stripped at query time).
    attachment: r.attachment_meta || (r.attachment ? { name: r.attachment.name, type: r.attachment.type, size: r.attachment.size } : null),
    createdAt: r.created_at,
  };
}

/** Fetch the raw attachment data for a single message (for download/inline display). */
async function getMessageAttachment(messageId) {
  const { rows } = await query(
    `SELECT id, sender, attachment->>'name' AS name, attachment->>'type' AS type,
            attachment->>'data' AS data
     FROM messages WHERE id = $1 LIMIT 1`,
    [Number(messageId)]
  );
  if (!rows[0] || !rows[0].data) return null;
  return { id: Number(rows[0].id), sender: rows[0].sender, name: rows[0].name, type: rows[0].type, data: rows[0].data };
}

/** Latest group messages, oldest-first. Pass afterId to fetch only newer ones. */
async function getGroupMessages(afterId) {
  const after = Number(afterId) || 0;
  const { rows } = await query(
    `SELECT * FROM (
       SELECT id, sender, recipient, channel, body,
              attachment - 'data' AS attachment_meta,
              created_at
       FROM messages
       WHERE channel='group' AND id > $1
       ORDER BY id DESC
       LIMIT 200
     ) t ORDER BY id ASC`,
    [after]
  );
  return rows.map(rowToMessage);
}

/** DM thread between `me` and `other`, oldest-first. */
async function getDirectMessages(me, other, afterId) {
  const after = Number(afterId) || 0;
  const convo = dmKey(me, other);
  const { rows } = await query(
    `SELECT * FROM (
       SELECT id, sender, recipient, channel, body,
              attachment - 'data' AS attachment_meta,
              created_at
       FROM messages
       WHERE channel='dm' AND convo=$1 AND id > $2
       ORDER BY id DESC
       LIMIT 200
     ) t ORDER BY id ASC`,
    [convo, after]
  );
  return rows.map(rowToMessage);
}

/**
 * Sidebar list for `me`: every other officer with their last DM (if any),
 * sorted by most-recent activity then name.
 */
async function getConversations(me) {
  const members = await query(
    `SELECT username, rank, accent, badge FROM officers
     WHERE LOWER(username) <> LOWER($1) ORDER BY username ASC`,
    [me]
  );
  const last = await query(
    `SELECT DISTINCT ON (convo) convo, sender, recipient, body, created_at
     FROM messages
     WHERE channel='dm' AND (LOWER(sender)=LOWER($1) OR LOWER(recipient)=LOWER($1))
     ORDER BY convo, id DESC`,
    [me]
  );
  const lastByConvo = {};
  last.rows.forEach((r) => { lastByConvo[r.convo] = r; });

  return members.rows.map((m) => {
    const r = lastByConvo[dmKey(me, m.username)];
    return {
      username: m.username,
      rank: m.rank || 'Recruit',
      accent: m.accent || '#3fff9f',
      badge: m.badge || '★',
      lastBody: r ? r.body : null,
      lastAt: r ? r.created_at : null,
    };
  }).sort((a, b) => {
    if (a.lastAt && b.lastAt) return new Date(b.lastAt) - new Date(a.lastAt);
    if (a.lastAt) return -1;
    if (b.lastAt) return 1;
    return a.username.localeCompare(b.username);
  });
}

module.exports = {
  HASH_PASSWORDS,
  loadUsers, verifyUser, addUser, deleteUser, editUser,
  updateProfile, updatePosting, getAchievements, addAchievement, removeAchievement,
  getPoints, adjustPoints, resetPoints,
  getTasks, completeMission, addMission, deleteMission, editMission,
  getMembers, getMember, getLeaderboard, levelFromXP,
  sendMessage, getGroupMessages, getDirectMessages, getConversations, getMessageAttachment,
};
