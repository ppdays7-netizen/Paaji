/** controllers/apiController.js — JSON endpoints for live UI updates (any logged-in user). */
const store = require('../server/store');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Officer marks a mission complete -> awards XP, blocks duplicates. */
exports.completeMission = wrap(async (req, res) => {
  const username = req.session.user.username;
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ ok: false, error: 'taskId required.' });

  const result = await store.completeMission(username, taskId);
  if (!result.ok) return res.status(400).json(result);

  const [points, leaderboard] = await Promise.all([store.getPoints(), store.getLeaderboard()]);
  return res.json({
    ok: true,
    xp: result.xp,
    newTotal: points[username] || 0,
    leaderboard,
  });
});

/** Live leaderboard snapshot (polled by the frontend). */
exports.leaderboard = wrap(async (req, res) => {
  res.json({ ok: true, leaderboard: await store.getLeaderboard() });
});
