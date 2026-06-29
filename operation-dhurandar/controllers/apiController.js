/** controllers/apiController.js — JSON endpoints for live UI updates (any logged-in user). */
const store = require('../server/store');

/** Officer marks a mission complete → awards XP, blocks duplicates. */
exports.completeMission = (req, res) => {
  const username = req.session.user.username;
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ ok: false, error: 'taskId required.' });

  const result = store.completeMission(username, taskId);
  if (!result.ok) return res.status(400).json(result);

  return res.json({
    ok: true,
    xp: result.xp,
    newTotal: store.getPoints()[username] || 0,
    leaderboard: store.getLeaderboard(),
  });
};

/** Live leaderboard snapshot (polled by the frontend). */
exports.leaderboard = (req, res) => {
  res.json({ ok: true, leaderboard: store.getLeaderboard() });
};
