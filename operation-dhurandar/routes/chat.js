/** routes/chat.js — secure comms page + JSON endpoints (logged-in officers). */
const express = require('express');
const router = express.Router();
const chat = require('../controllers/chatController');
const { ensureAuth } = require('../middleware/auth');

// Page
router.get('/', ensureAuth, chat.page);

// JSON API (polled by the browser)
router.get('/api/group', ensureAuth, chat.groupFeed);
router.get('/api/conversations', ensureAuth, chat.conversations);
router.get('/api/dm/:username', ensureAuth, chat.dmFeed);
router.post('/api/send', ensureAuth, chat.send);
router.get('/api/file/:id', ensureAuth, chat.getFile);

module.exports = router;
