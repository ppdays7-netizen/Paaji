/**
 * store.js — central data-access layer for Operation DHURANDAR.
 * --------------------------------------------------------------
 * All persistence lives in flat files inside /data:
 *   - auth.txt      -> credentials (username,password,rank), one per line
 *   - points.json   -> { username: points }
 *   - tasks.json    -> { missions: [...], completions: { username: [taskId] } }
 *   - members.json  -> profile metadata keyed by username
 *
 * No external database is required. Every mutation is written back to disk
 * synchronously so the leaderboard / profiles reflect changes instantly.
 *
 * NOTE: Serverless platforms (e.g. Vercel) use a read-only filesystem, so
 * write operations are wrapped in try/catch -- the in-memory state still
 * updates for the session even if the disk write is rejected.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth.txt');
const POINTS_FILE = path.join(DATA_DIR, 'points.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');

// Flip to "true" (env var) to store/verify passwords with bcrypt instead of plain text.
const HASH_PASSWORDS = String(process.env.HASH_PASSWORDS).toLowerCase() === 'true';

// Remove stray NUL bytes that some synced filesystems leave behind when a
// shorter payload overwrites a longer one (keeps the JSON parser happy).
const NUL = String.fromCharCode(0);
function stripNul(s) {
  return s.split(NUL).join('');
}

/* ----------------------------- low-level IO ----------------------------- */

function readJSON(file, fallback) {
  try {
    let raw = stripNul(fs.readFileSync(file, 'utf8')).trim();
    const last = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (last !== -1) raw = raw.slice(0, last + 1);
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[store] could not read ' + path.basename(file) + ' -- using fallback. ' + err.message);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[store] write blocked for ' + path.basename(file) + ' (read-only FS?). ' + err.message);
    return false;
  }
}

/* ------------------------------- users ---------------------------------- */

function loadUsers() {
  let raw = '';
  try {
    raw = stripNul(fs.readFileSync(AUTH_FILE, 'utf8'));
  } catch (err) {
    console.error('[store] auth.txt missing -- no users loaded. ' + err.message);
    return [];
  }

  return raw
    .split(/\r?\n/)
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return line && !line.startsWith('#'); })
    .map(function (line) {
      const parts = line.split(',');
      const username = parts[0];
      const password = parts[1];
      const rank = parts.slice(2).join(',');
      return {
        username: (username || '').trim(),
        password: (password || '').trim(),
        rank: (rank || '').trim() || 'Recruit',
      };
    })
    .filter(function (u) { return u.username && u.password; });
}

async function verifyUser(username, password) {
  const user = loadUsers().find(function (u) {
    return u.username.toLowerCase() === String(username || '').toLowerCase();
  });
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

  if (!username || !password) {
    return { ok: false, error: 'Name and password are required.' };
  }
  if (/[,\n\r]/.test(username) || /[,\n\r]/.test(rank)) {
    return { ok: false, error: 'Name and rank cannot contain commas or line breaks.' };
  }
  if (loadUsers().some(function (u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
    return { ok: false, error: 'An officer with that name already exists.' };
  }

  const stored = HASH_PASSWORDS ? await bcrypt.hash(password, 10) : password;
  try {
    fs.appendFileSync(AUTH_FILE, '\n' + username + ',' + stored + ',' + rank, 'utf8');
  } catch (err) {
    return { ok: false, error: 'Could not write to auth.txt (read-only filesystem?).' };
  }

  const points = getPoints();
  if (points[username] === undefined) {
    points[username] = 0;
    writeJSON(POINTS_FILE, points);
  }

  const members = getMembers();
  if (!members[username]) {
    members[username] = defaultProfile(username, rank);
    writeJSON(MEMBERS_FILE, members);
  }

  const tasks = getTasks();
  if (!tasks.completions[username]) {
    tasks.completions[username] = [];
    writeJSON(TASKS_FILE, tasks);
  }

  return { ok: true };
}

function deleteUser(username) {
  const target = String(username || '').toLowerCase();

  try {
    const lines = stripNul(fs.readFileSync(AUTH_FILE, 'utf8')).split(/\r?\n/);
    const kept = lines.filter(function (line) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return true;
      return trimmed.split(',')[0].trim().toLowerCase() !== target;
    });
    fs.writeFileSync(AUTH_FILE, kept.join('\n'), 'utf8');
  } catch (err) {
    return { ok: false, error: 'Could not update auth.txt.' };
  }

  const points = getPoints();
  Object.keys(points).forEach(function (key) { if (key.toLowerCase() === target) delete points[key]; });
  writeJSON(POINTS_FILE, points);

  const members = getMembers();
  Object.keys(members).forEach(function (key) { if (key.toLowerCase() === target) delete members[key]; });
  writeJSON(MEMBERS_FILE, members);

  const tasks = getTasks();
  Object.keys(tasks.completions).forEach(function (key) { if (key.toLowerCase() === target) delete tasks.completions[key]; });
  writeJSON(TASKS_FILE, tasks);

  return { ok: true };
}

function editUser(username, updates) {
  updates = updates || {};
  const target = String(username || '').toLowerCase();
  let found = false;

  try {
    const lines = stripNul(fs.readFileSync(AUTH_FILE, 'utf8')).split(/\r?\n/);
    const next = lines.map(function (line) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      const parts = trimmed.split(',');
      const u = parts[0];
      const p = parts[1];
      const r = parts.slice(2).join(',');
      if (u.trim().toLowerCase() !== target) return line;
      found = true;
      const newPass = updates.password ? updates.password : p;
      const newRank = updates.rank ? updates.rank : r.trim();
      return u.trim() + ',' + newPass + ',' + newRank;
    });
    fs.writeFileSync(AUTH_FILE, next.join('\n'), 'utf8');
  } catch (err) {
    return { ok: false, error: 'Could not update auth.txt.' };
  }

  if (!found) return { ok: false, error: 'Officer not found.' };

  const members = getMembers();
  const key = Object.keys(members).find(function (k) { return k.toLowerCase() === target; });
  if (key) {
    const m = members[key];
    if (updates.rank) m.rank = updates.rank;
    if (updates.posting) m.posting = updates.posting;
    if (updates.years !== undefined && updates.years !== '') m.years = Number(updates.years);
    writeJSON(MEMBERS_FILE, members);
  }

  return { ok: true };
}

/* ------------------------------- points --------------------------------- */

function getPoints() {
  return readJSON(POINTS_FILE, {});
}

function setPoints(points) {
  return writeJSON(POINTS_FILE, points);
}

function adjustPoints(username, delta) {
  const points = getPoints();
  const key = Object.keys(points).find(function (k) { return k.toLowerCase() === username.toLowerCase(); }) || username;
  points[key] = Math.max(0, (points[key] || 0) + Number(delta || 0));
  setPoints(points);
  return points[key];
}

function resetPoints(username) {
  const points = getPoints();
  if (username) {
    const key = Object.keys(points).find(function (k) { return k.toLowerCase() === username.toLowerCase(); });
    if (key) points[key] = 0;
  } else {
    Object.keys(points).forEach(function (key) { points[key] = 0; });
    const tasks = getTasks();
    Object.keys(tasks.completions).forEach(function (key) { tasks.completions[key] = []; });
    writeJSON(TASKS_FILE, tasks);
  }
  setPoints(points);
  return points;
}

/* ------------------------------- missions ------------------------------- */

function getTasks() {
  const data = readJSON(TASKS_FILE, { missions: [], completions: {} });
  if (!data.missions) data.missions = [];
  if (!data.completions) data.completions = {};
  return data;
}

function saveTasks(data) {
  return writeJSON(TASKS_FILE, data);
}

function completeMission(username, taskId) {
  const tasks = getTasks();
  const mission = tasks.missions.find(function (m) { return m.id === taskId; });
  if (!mission) return { ok: false, error: 'Mission not found.' };

  if (!tasks.completions[username]) tasks.completions[username] = [];
  if (tasks.completions[username].indexOf(taskId) !== -1) {
    return { ok: false, error: 'Mission already completed -- no duplicate XP.' };
  }

  tasks.completions[username].push(taskId);
  saveTasks(tasks);
  adjustPoints(username, mission.xp);
  return { ok: true, xp: mission.xp };
}

function addMission(opts) {
  const title = opts && opts.title;
  const xp = opts && opts.xp;
  const category = opts && opts.category;
  if (!title || xp === undefined) return { ok: false, error: 'Title and XP are required.' };
  const tasks = getTasks();
  const id = 'm' + Date.now().toString(36);
  tasks.missions.push({
    id: id,
    title: String(title).trim(),
    xp: Math.max(0, Number(xp) || 0),
    category: (category || 'General').trim(),
  });
  saveTasks(tasks);
  return { ok: true, id: id };
}

function deleteMission(taskId) {
  const tasks = getTasks();
  const before = tasks.missions.length;
  tasks.missions = tasks.missions.filter(function (m) { return m.id !== taskId; });
  Object.keys(tasks.completions).forEach(function (key) {
    tasks.completions[key] = tasks.completions[key].filter(function (id) { return id !== taskId; });
  });
  saveTasks(tasks);
  return { ok: tasks.missions.length < before };
}

function editMission(taskId, updates) {
  updates = updates || {};
  const tasks = getTasks();
  const mission = tasks.missions.find(function (m) { return m.id === taskId; });
  if (!mission) return { ok: false, error: 'Mission not found.' };
  if (updates.title) mission.title = String(updates.title).trim();
  if (updates.xp !== undefined && updates.xp !== '') mission.xp = Math.max(0, Number(updates.xp));
  if (updates.category) mission.category = String(updates.category).trim();
  saveTasks(tasks);
  return { ok: true };
}

/* ------------------------------- members -------------------------------- */

function getMembers() {
  return readJSON(MEMBERS_FILE, {});
}

function getMember(username) {
  const members = getMembers();
  const key = Object.keys(members).find(function (k) { return k.toLowerCase() === String(username).toLowerCase(); });
  return key ? Object.assign({ username: key }, members[key]) : null;
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
    badge: badgeByRank[rank] || '★',
    accent: accents[Math.floor(Math.random() * accents.length)],
  };
}

/* -------------------------- composite views ----------------------------- */

function getLeaderboard() {
  const points = getPoints();
  const members = getMembers();
  const users = loadUsers();

  const rows = users.map(function (u) {
    const xp = points[u.username] || 0;
    const profile = members[u.username] || {};
    return {
      username: u.username,
      militaryRank: profile.rank || u.rank,
      points: xp,
      level: levelFromXP(xp),
      accent: profile.accent || '#3fff9f',
    };
  });

  rows.sort(function (a, b) { return b.points - a.points; });
  rows.forEach(function (r, i) { r.position = i + 1; });
  return rows;
}

function levelFromXP(xp) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

module.exports = {
  HASH_PASSWORDS: HASH_PASSWORDS,
  loadUsers: loadUsers,
  verifyUser: verifyUser,
  addUser: addUser,
  deleteUser: deleteUser,
  editUser: editUser,
  getPoints: getPoints,
  setPoints: setPoints,
  adjustPoints: adjustPoints,
  resetPoints: resetPoints,
  getTasks: getTasks,
  completeMission: completeMission,
  addMission: addMission,
  deleteMission: deleteMission,
  editMission: editMission,
  getMembers: getMembers,
  getMember: getMember,
  getLeaderboard: getLeaderboard,
  levelFromXP: levelFromXP,
};
