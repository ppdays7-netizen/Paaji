/** controllers/dashboardController.js — landing, dashboard, profile, map, leaderboard. */
const store = require('../server/store');

/** Public landing page (pre-login). */
exports.landing = (req, res) => {
  res.render('landing', {
    title: 'Operation DHURANDAR',
    leaderboard: store.getLeaderboard().slice(0, 4),
    members: store.getMembers(),
  });
};

/** Main control dashboard (post-login). */
exports.dashboard = (req, res) => {
  const me = req.session.user;
  const profile = store.getMember(me.username) || {};
  const points = store.getPoints();
  const tasks = store.getTasks();

  res.render('dashboard', {
    title: 'MISSION CONTROL',
    profile,
    myXP: points[me.username] || 0,
    myLevel: store.levelFromXP(points[me.username] || 0),
    leaderboard: store.getLeaderboard(),
    missions: tasks.missions,
    completed: tasks.completions[me.username] || [],
    memberCount: store.loadUsers().length,
  });
};

/** Individual officer profile (own or another officer's record). */
exports.profile = (req, res) => {
  const username = req.params.username || req.session.user.username;
  const profile = store.getMember(username);
  if (!profile) {
    return res.status(404).render('404', { title: 'RECORD NOT FOUND' });
  }
  const points = store.getPoints();
  const tasks = store.getTasks();
  const completedIds = tasks.completions[profile.username] || [];
  const completedMissions = tasks.missions.filter((m) => completedIds.includes(m.id));

  res.render('profile', {
    title: `DOSSIER — ${profile.username}`,
    profile,
    xp: points[profile.username] || 0,
    level: store.levelFromXP(points[profile.username] || 0),
    completedMissions,
    isSelf: profile.username.toLowerCase() === req.session.user.username.toLowerCase(),
  });
};

/** Stylized fictional posting map. */
exports.map = (req, res) => {
  res.render('map', {
    title: 'SECTOR MAP',
    members: store.getMembers(),
  });
};

/** Full animated leaderboard. */
exports.leaderboard = (req, res) => {
  res.render('leaderboard', {
    title: 'LEADERBOARD',
    leaderboard: store.getLeaderboard(),
  });
};
