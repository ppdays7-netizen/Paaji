/** controllers/adminController.js — Brigadier-only command centre. */
const store = require('../server/store');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Render the admin panel with members, points, missions. */
exports.panel = wrap(async (req, res) => {
  const [members, points, tasks, users] = await Promise.all([
    store.getMembers(),
    store.getPoints(),
    store.getTasks(),
    store.loadUsers(),
  ]);
  res.render('admin', { title: 'COMMAND CENTRE', members, points, tasks, users });
});

/* ----------------------------- members ---------------------------------- */

exports.addMember = wrap(async (req, res) => {
  const { username, password, rank } = req.body;
  const result = await store.addUser({ username, password, rank });
  req.session.flash = result.ok
    ? { type: 'success', message: 'Officer ' + username + ' commissioned. Open their dossier below to add achievements & posting.' }
    : { type: 'error', message: result.error };
  res.redirect(result.ok ? '/admin#officer-' + encodeURIComponent(username) : '/admin');
});

exports.editMember = wrap(async (req, res) => {
  const { username, password, rank, posting, years } = req.body;
  const result = await store.editUser(username, { password, rank, posting, years });
  req.session.flash = result.ok
    ? { type: 'success', message: 'Record for ' + username + ' updated.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
});

exports.deleteMember = wrap(async (req, res) => {
  const { username } = req.body;
  if (username.toLowerCase() === req.session.user.username.toLowerCase()) {
    req.session.flash = { type: 'error', message: 'A Brigadier cannot delete their own command record.' };
    return res.redirect('/admin');
  }
  const result = await store.deleteUser(username);
  req.session.flash = result.ok
    ? { type: 'success', message: 'Officer ' + username + ' decommissioned.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
});

/* ------------------- advanced profile / posting / achievements ---------- */

exports.updateProfile = wrap(async (req, res) => {
  const { username, posting, callsign, status, clearance, currentMission, years, rank, badge, accent } = req.body;
  const result = await store.updateProfile(username, {
    posting, callsign, status, clearance, currentMission, years, rank, badge, accent,
  });
  req.session.flash = result.ok
    ? { type: 'success', message: 'Dossier for ' + username + ' updated.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin#officer-' + encodeURIComponent(username));
});

exports.updatePosting = wrap(async (req, res) => {
  const { username, posting } = req.body;
  const result = await store.updatePosting(username, posting);
  req.session.flash = result.ok
    ? { type: 'success', message: 'Posting updated for ' + username + '.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin#officer-' + encodeURIComponent(username));
});

exports.addAchievement = wrap(async (req, res) => {
  const { username, achievement } = req.body;
  const result = await store.addAchievement(username, achievement);
  req.session.flash = result.ok
    ? { type: 'success', message: 'Achievement awarded to ' + username + '.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin#officer-' + encodeURIComponent(username));
});

exports.removeAchievement = wrap(async (req, res) => {
  const { username, index } = req.body;
  const result = await store.removeAchievement(username, index);
  req.session.flash = result.ok
    ? { type: 'success', message: 'Achievement removed from ' + username + "'s dossier." }
    : { type: 'error', message: result.error };
  res.redirect('/admin#officer-' + encodeURIComponent(username));
});

/* ------------------------------ points ---------------------------------- */

exports.adjustPoints = wrap(async (req, res) => {
  const { username, delta } = req.body;
  await store.adjustPoints(username, Number(delta));
  req.session.flash = { type: 'success', message: 'Points updated for ' + username + '.' };
  res.redirect('/admin');
});

exports.resetPoints = wrap(async (req, res) => {
  const { username } = req.body; // empty -> reset all
  await store.resetPoints(username || null);
  req.session.flash = { type: 'success', message: username ? username + "'s XP reset." : 'Leaderboard reset.' };
  res.redirect('/admin');
});

/* ------------------------------ missions -------------------------------- */

exports.addMission = wrap(async (req, res) => {
  const { title, xp, category } = req.body;
  const result = await store.addMission({ title, xp, category });
  req.session.flash = result.ok
    ? { type: 'success', message: 'Mission added to the board.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
});

exports.editMission = wrap(async (req, res) => {
  const { taskId, title, xp, category } = req.body;
  const result = await store.editMission(taskId, { title, xp, category });
  req.session.flash = result.ok
    ? { type: 'success', message: 'Mission reward updated.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
});

exports.deleteMission = wrap(async (req, res) => {
  const { taskId } = req.body;
  await store.deleteMission(taskId);
  req.session.flash = { type: 'success', message: 'Mission removed.' };
  res.redirect('/admin');
});
