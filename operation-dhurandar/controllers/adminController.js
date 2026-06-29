/** controllers/adminController.js — Brigadier-only command centre. */
const store = require('../server/store');

/** Render the admin panel with members, points, missions. */
exports.panel = (req, res) => {
  res.render('admin', {
    title: 'COMMAND CENTRE',
    members: store.getMembers(),
    points: store.getPoints(),
    tasks: store.getTasks(),
    users: store.loadUsers(),
  });
};

/* ----------------------------- members ---------------------------------- */

exports.addMember = async (req, res) => {
  const { username, password, rank } = req.body;
  const result = await store.addUser({ username, password, rank });
  req.session.flash = result.ok
    ? { type: 'success', message: `Officer ${username} commissioned.` }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
};

exports.editMember = (req, res) => {
  const { username, password, rank, posting, years } = req.body;
  const result = store.editUser(username, { password, rank, posting, years });
  req.session.flash = result.ok
    ? { type: 'success', message: `Record for ${username} updated.` }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
};

exports.deleteMember = (req, res) => {
  const { username } = req.body;
  if (username.toLowerCase() === req.session.user.username.toLowerCase()) {
    req.session.flash = { type: 'error', message: 'A Brigadier cannot delete their own command record.' };
    return res.redirect('/admin');
  }
  const result = store.deleteUser(username);
  req.session.flash = result.ok
    ? { type: 'success', message: `Officer ${username} decommissioned.` }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
};

/* ------------------------------ points ---------------------------------- */

exports.adjustPoints = (req, res) => {
  const { username, delta } = req.body;
  store.adjustPoints(username, Number(delta));
  req.session.flash = { type: 'success', message: `Points updated for ${username}.` };
  res.redirect('/admin');
};

exports.resetPoints = (req, res) => {
  const { username } = req.body; // empty → reset all
  store.resetPoints(username || null);
  req.session.flash = { type: 'success', message: username ? `${username}'s XP reset.` : 'Leaderboard reset.' };
  res.redirect('/admin');
};

/* ------------------------------ missions -------------------------------- */

exports.addMission = (req, res) => {
  const { title, xp, category } = req.body;
  const result = store.addMission({ title, xp, category });
  req.session.flash = result.ok
    ? { type: 'success', message: 'Mission added to the board.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
};

exports.editMission = (req, res) => {
  const { taskId, title, xp, category } = req.body;
  const result = store.editMission(taskId, { title, xp, category });
  req.session.flash = result.ok
    ? { type: 'success', message: 'Mission reward updated.' }
    : { type: 'error', message: result.error };
  res.redirect('/admin');
};

exports.deleteMission = (req, res) => {
  const { taskId } = req.body;
  store.deleteMission(taskId);
  req.session.flash = { type: 'success', message: 'Mission removed.' };
  res.redirect('/admin');
};
