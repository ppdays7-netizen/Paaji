/** controllers/dashboardController.js — landing, dashboard, profile, map, leaderboard. */
const store = require('../server/store');

// Wrap async handlers so any rejected promise reaches the Express error handler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Public landing page (pre-login). */
exports.landing = wrap(async (req, res) => {
  const [leaderboard, members] = await Promise.all([store.getLeaderboard(), store.getMembers()]);
  res.render('landing', {
    title: 'Operation DHURANDAR',
    leaderboard: leaderboard.slice(0, 4),
    members,
  });
});

/** Main control dashboard (post-login). */
exports.dashboard = wrap(async (req, res) => {
  const me = req.session.user;
  const [profile, points, tasks, leaderboard, users] = await Promise.all([
    store.getMember(me.username),
    store.getPoints(),
    store.getTasks(),
    store.getLeaderboard(),
    store.loadUsers(),
  ]);

  res.render('dashboard', {
    title: 'MISSION CONTROL',
    profile: profile || {},
    myXP: points[me.username] || 0,
    myLevel: store.levelFromXP(points[me.username] || 0),
    leaderboard,
    missions: tasks.missions,
    completed: tasks.completions[me.username] || [],
    memberCount: users.length,
  });
});

/** Individual officer profile (own or another officer's record). */
exports.profile = wrap(async (req, res) => {
  const username = req.params.username || req.session.user.username;
  const profile = await store.getMember(username);
  if (!profile) {
    return res.status(404).render('404', { title: 'RECORD NOT FOUND' });
  }
  const [points, tasks] = await Promise.all([store.getPoints(), store.getTasks()]);
  const completedIds = tasks.completions[profile.username] || [];
  const completedMissions = tasks.missions.filter((m) => completedIds.includes(m.id));

  res.render('profile', {
    title: 'DOSSIER — ' + profile.username,
    profile,
    xp: points[profile.username] || 0,
    level: store.levelFromXP(points[profile.username] || 0),
    completedMissions,
    isSelf: profile.username.toLowerCase() === req.session.user.username.toLowerCase(),
  });
});

/** Stylized fictional posting map. */
exports.map = wrap(async (req, res) => {
  res.render('map', {
    title: 'SECTOR MAP',
    members: await store.getMembers(),
  });
});

/** Full animated leaderboard. */
exports.leaderboard = wrap(async (req, res) => {
  res.render('leaderboard', {
    title: 'LEADERBOARD',
    leaderboard: await store.getLeaderboard(),
  });
});
