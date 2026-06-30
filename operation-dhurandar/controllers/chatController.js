/**
 * controllers/chatController.js — secure comms (group war-room + private DMs).
 *
 * The page renders the chat shell; the browser then polls the JSON endpoints
 * for new messages (same live-update pattern the leaderboard uses, which works
 * on Vercel's serverless platform where websockets aren't available).
 */
const store = require('../server/store');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Render the chat page. */
exports.page = wrap(async (req, res) => {
  const me = req.session.user.username;
  const conversations = await store.getConversations(me);
  res.render('chat', {
    title: 'SECURE COMMS',
    conversations,
  });
});

/** Group war-room messages (optionally only newer than ?after=). */
exports.groupFeed = wrap(async (req, res) => {
  const messages = await store.getGroupMessages(req.query.after);
  res.json({ ok: true, messages });
});

/** DM thread with :username (optionally only newer than ?after=). */
exports.dmFeed = wrap(async (req, res) => {
  const me = req.session.user.username;
  const other = req.params.username;
  const member = await store.getMember(other);
  if (!member) return res.status(404).json({ ok: false, error: 'Officer not found.' });
  const messages = await store.getDirectMessages(me, other, req.query.after);
  res.json({ ok: true, messages, with: member.username });
});

/** Send a message. Body: { body, to? } — `to` present => DM, else group. */
exports.send = wrap(async (req, res) => {
  const me = req.session.user.username;
  const { body, to } = req.body || {};
  const opts = to ? { recipient: to } : {};
  const result = await store.sendMessage(me, body, opts);
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true, message: result.message });
});

/** Sidebar conversation list (for live refresh of last-message previews). */
exports.conversations = wrap(async (req, res) => {
  const me = req.session.user.username;
  res.json({ ok: true, conversations: await store.getConversations(me) });
});
